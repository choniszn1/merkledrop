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
    Bytes, BytesN, Env, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Drop {
    pub admin: Address,
    pub token: Address,
    pub root: BytesN<32>,
    /// Claims are accepted until this ledger timestamp.
    pub ends_at: u64,
    pub claimed_total: i128,
}

#[contracttype]
pub enum DataKey {
    Drop,
    Claimed(u32),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyClaimed = 3,
    InvalidProof = 4,
    Ended = 5,
    NotEnded = 6,
    InvalidAmount = 7,
    InvalidEnd = 8,
}

#[contractevent(topics = ["drop", "claimed"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claimed {
    #[topic]
    pub index: u32,
    pub account: Address,
    pub amount: i128,
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
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        root: BytesN<32>,
        funding: i128,
        ends_at: u64,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Drop) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        if funding <= 0 {
            return Err(Error::InvalidAmount);
        }
        if ends_at <= env.ledger().timestamp() {
            return Err(Error::InvalidEnd);
        }
        token::Client::new(&env, &token).transfer(&admin, env.current_contract_address(), &funding);
        let drop = Drop {
            admin,
            token,
            root,
            ends_at,
            claimed_total: 0,
        };
        env.storage().instance().set(&DataKey::Drop, &drop);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
        Ok(())
    }

    /// Claim allocation `index`. Anyone may submit the claim (e.g. a
    /// relayer paying the fee); tokens always go to `account`.
    pub fn claim(
        env: Env,
        index: u32,
        account: Address,
        amount: i128,
        proof: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        let mut drop = get_drop(&env)?;
        if env.ledger().timestamp() >= drop.ends_at {
            return Err(Error::Ended);
        }
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let key = DataKey::Claimed(index);
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyClaimed);
        }
        let leaf = leaf_hash(&env, index, &account, amount);
        if compute_root(&env, leaf, &proof) != drop.root {
            return Err(Error::InvalidProof);
        }

        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, BUMP_THRESHOLD, BUMP_TO);
        drop.claimed_total += amount;
        env.storage().instance().set(&DataKey::Drop, &drop);
        env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);

        token::Client::new(&env, &drop.token).transfer(
            &env.current_contract_address(),
            &account,
            &amount,
        );
        Claimed {
            index,
            account,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    /// After the window closes, return unclaimed tokens to the admin.
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
        env.storage().persistent().has(&DataKey::Claimed(index))
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

fn get_drop(env: &Env) -> Result<Drop, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Drop)
        .ok_or(Error::NotInitialized)
}

mod test;
