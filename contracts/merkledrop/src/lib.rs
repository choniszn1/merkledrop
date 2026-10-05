#![no_std]

//! Merkledrop: airdrop tokens to thousands of addresses for the cost of
//! storing one hash.
//!
//! Instead of pushing a payment to every recipient (one transaction each,
//! and recipients without trustlines fail), the distributor publishes the
//! **Merkle root** of the full allocation list and funds the contract once.
//! Each recipient then claims their own allocation by presenting a short
//! proof that `(index, address, amount)` is in the list.
//!
//! Leaf encoding (matched exactly by the `tools/` tree builder):
//!
//! ```text
//! leaf = sha256( index as u32 big-endian
//!              ‖ amount as i128 big-endian
//!              ‖ address as ScVal XDR )
//! node = sha256( min(a, b) ‖ max(a, b) )      // sorted pairs, no left/right flags
//! ```
//!
//! Each index can be claimed once. After the claim window closes, the
//! distributor can sweep whatever is left back.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, xdr::ToXdr, Address,
    Bytes, BytesN, Env, String, Vec,
};

/// Longest list URI accepted.
pub const MAX_URI_LEN: u32 = 256;
/// Most claims `claim_many` processes in one call.
pub const MAX_BATCH: u32 = 20;

/// One entry for `claim_many`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimInput {
    pub index: u32,
    pub account: Address,
    pub amount: i128,
    pub proof: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Drop {
    pub admin: Address,
    pub token: Address,
    pub root: BytesN<32>,
    /// Claims are accepted until this ledger timestamp.
    pub ends_at: u64,
    pub claimed_total: i128,
    /// Where the full allocation list (with proofs) is published, if anywhere.
    pub list_uri: String,
}

#[contracttype]
pub enum DataKey {
    Drop,
    /// Claimed flags, 128 indexes per entry: bit `index % 128` of word `index / 128`.
    ClaimedWord(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Kept for stable error codes; drops are set up by their constructor.
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyClaimed = 3,
    InvalidProof = 4,
    Ended = 5,
    NotEnded = 6,
    InvalidAmount = 7,
    InvalidEnd = 8,
    UriTooLong = 9,
    InvalidBatch = 10,
}

#[contractevent(topics = ["drop", "claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    #[topic]
    pub index: u32,
    pub account: Address,
    pub amount: i128,
}

#[contractevent(topics = ["drop", "extended"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Extended {
    pub ends_at: u64,
}

#[contractevent(topics = ["drop", "swept"], data_format = "single-value")]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Swept {
    pub amount: i128,
}

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

#[contract]
pub struct Merkledrop;

#[contractimpl]
impl Merkledrop {
    /// Configure the drop and pull `funding` of `token` from the admin.
    /// Configure and fund the drop at deployment. As a constructor this runs
    /// in the deploy transaction itself: one confirmation, and no deployed
    /// contract is ever left waiting for setup.
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        root: BytesN<32>,
        funding: i128,
        ends_at: u64,
        list_uri: String,
    ) -> Result<(), Error> {
        admin.require_auth();
        if funding <= 0 {
            return Err(Error::InvalidAmount);
        }
        if ends_at <= env.ledger().timestamp() {
            return Err(Error::InvalidEnd);
        }
        if list_uri.len() > MAX_URI_LEN {
            return Err(Error::UriTooLong);
        }
        token::Client::new(&env, &token).transfer(&admin, env.current_contract_address(), &funding);
        let drop = Drop {
            admin,
            token,
            root,
            ends_at,
            claimed_total: 0,
            list_uri,
        };
        env.storage().instance().set(&DataKey::Drop, &drop);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Ok(())
    }

    pub fn claim(
        env: Env,
        index: u32,
        account: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        let mut drop = get_drop(&env)?;
        claim_one(&env, &mut drop, index, account, amount, &proof)?;
        save_drop(&env, &drop);
        Ok(())
    }

    /// Submit up to `MAX_BATCH` claims at once (e.g. to push tokens to
    /// recipients). All-or-nothing: one bad entry rejects the whole batch.
    pub fn claim_many(env: Env, claims: Vec<ClaimInput>) -> Result<(), Error> {
        if claims.is_empty() || claims.len() > MAX_BATCH {
            return Err(Error::InvalidBatch);
        }
        let mut drop = get_drop(&env)?;
        for c in claims.iter() {
            claim_one(&env, &mut drop, c.index, c.account, c.amount, &c.proof)?;
        }
        save_drop(&env, &drop);
        Ok(())
    }

    /// Push the end date back. Admin only, and only later than the current end.
    pub fn extend(env: Env, ends_at: u64) -> Result<(), Error> {
        let mut drop = get_drop(&env)?;
        drop.admin.require_auth();
        if ends_at <= drop.ends_at {
            return Err(Error::InvalidEnd);
        }
        drop.ends_at = ends_at;
        save_drop(&env, &drop);
        Extended { ends_at }.publish(&env);
        Ok(())
    }

    pub fn sweep(env: Env) -> Result<i128, Error> {
        let drop = get_drop(&env)?;
        drop.admin.require_auth();
        if env.ledger().timestamp() < drop.ends_at {
            return Err(Error::NotEnded);
        }
        let client = token::Client::new(&env, &drop.token);
        let remaining = client.balance(&env.current_contract_address());
        if remaining > 0 {
            client.transfer(&env.current_contract_address(), &drop.admin, &remaining);
        }
        Swept { amount: remaining }.publish(&env);
        Ok(remaining)
    }

    pub fn is_claimed(env: Env, index: u32) -> bool {
        is_claimed(&env, index)
    }

    /// Check a proof without claiming (useful for UIs).
    pub fn verify(
        env: Env,
        index: u32,
        account: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
    ) -> Result<bool, Error> {
        let drop = get_drop(&env)?;
        Ok(compute_root(&env, leaf_hash(&env, index, &account, amount), &proof) == drop.root)
    }

    pub fn get_drop(env: Env) -> Result<Drop, Error> {
        get_drop(&env)
    }
}

/// sha256(index u32 BE ‖ amount i128 BE ‖ address ScVal XDR)
pub fn leaf_hash(env: &Env, index: u32, account: &Address, amount: i128) -> BytesN<32> {
    let mut data = Bytes::new(env);
    data.extend_from_array(&index.to_be_bytes());
    data.extend_from_array(&amount.to_be_bytes());
    data.append(&account.clone().to_xdr(env));
    env.crypto().sha256(&data).into()
}

/// Fold a proof into a root using sorted-pair hashing.
pub fn compute_root(env: &Env, leaf: BytesN<32>, proof: &Vec<BytesN<32>>) -> BytesN<32> {
    let mut node = leaf;
    for sibling in proof.iter() {
        let mut data = Bytes::new(env);
        if node.to_array() <= sibling.to_array() {
            data.append(&node.clone().into());
            data.append(&sibling.into());
        } else {
            data.append(&sibling.into());
            data.append(&node.clone().into());
        }
        node = env.crypto().sha256(&data).into();
    }
    node
}

fn claim_one(
    env: &Env,
    drop: &mut Drop,
    index: u32,
    account: Address,
    amount: i128,
    proof: &Vec<BytesN<32>>,
) -> Result<(), Error> {
    if env.ledger().timestamp() >= drop.ends_at {
        return Err(Error::Ended);
    }
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    if is_claimed(env, index) {
        return Err(Error::AlreadyClaimed);
    }
    let leaf = leaf_hash(env, index, &account, amount);
    if compute_root(env, leaf, proof) != drop.root {
        return Err(Error::InvalidProof);
    }
    set_claimed(env, index);
    drop.claimed_total += amount;
    token::Client::new(env, &drop.token).transfer(
        &env.current_contract_address(),
        &account,
        &amount,
    );
    Claimed {
        index,
        account,
        amount,
    }
    .publish(env);
    Ok(())
}

fn is_claimed(env: &Env, index: u32) -> bool {
    let word: u128 = env
        .storage()
        .persistent()
        .get(&DataKey::ClaimedWord(index / 128))
        .unwrap_or(0);
    word & (1u128 << (index % 128)) != 0
}

fn set_claimed(env: &Env, index: u32) {
    let key = DataKey::ClaimedWord(index / 128);
    let word: u128 = env.storage().persistent().get(&key).unwrap_or(0);
    env.storage()
        .persistent()
        .set(&key, &(word | (1u128 << (index % 128))));
    env.storage()
        .persistent()
        .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
}

fn save_drop(env: &Env, drop: &Drop) {
    env.storage().instance().set(&DataKey::Drop, drop);
    env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
}

fn get_drop(env: &Env) -> Result<Drop, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Drop)
        .ok_or(Error::NotInitialized)
}

mod test;
