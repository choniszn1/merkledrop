#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
    vec, Env, String,
};

const LIST: &str = "https://example.org/drop.json";

const NOW: u64 = 1_700_000_000;
const END: u64 = NOW + 30 * 86_400;

// Same fixture as tools/src/fixture.ts. The root and proofs below were
// produced by the TypeScript tree builder, so these tests prove the two
// implementations hash identically.
const ROOT: &str = "cc35b45ecb986cdbeebe0c3f2a5028709dfcff98d4a449e0e46a9e3de6a9c78d";
const ACCOUNTS: [&str; 3] = [
    "CA44PCU2TFBNLQK3ITD2WN55BWSAYKZMUWYTV3NLG3F2NGF5ID4ZECR6",
    "CC45O2FM7GN75TCGNR4X5IXWZAZ3QZO5R7GBSPI5AJMYK5YTETNKDYXK",
    "CDXN7KXIDVF7GLMXLBDSN3KKE2OADULDKGEHBRQAFRHX3N73QGWLWHH7",
];
const AMOUNTS: [i128; 3] = [10_000_000_000, 2_500_000_000, 750_000_000];
const TOTAL: i128 = 13_250_000_000;

// The same builder over G-account (ed25519) addresses, to cover the other
// ScAddress variant in the leaf encoding.
const G_ROOT: &str = "39e4707b430f61bd72e36fe8528192ddad4135736fff6edce3918a6e8b971ea9";
const G_ACCOUNTS: [&str; 3] = [
    "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    "GCZ67AIAJO2VKMED5LALVSVFNDATQGSIGBUR7ZJFSZNNIJLROS64Q2QH",
];
const G_PROOFS: [&[&str]; 3] = [
    &[
        "2eb137a95977361571bb2eb08451581f875923cc633573369346e13e4979f23e",
        "8569f3ded8f0e5fa671fc4d151475d8815c421f790a833708ca7fe63a25d64ed",
    ],
    &[
        "93102d5ac91df2811183514faf7a3ab1d56c0728a5564196105574cfc210afd0",
        "8569f3ded8f0e5fa671fc4d151475d8815c421f790a833708ca7fe63a25d64ed",
    ],
    &["2d90f389ac0056d57b0b42b1ccb842ba2ce99bfc9b46c64194366a04161c8226"],
];
const PROOFS: [&[&str]; 3] = [
    &[
        "730a4b4be24234004a3c33746fe55c487fe498c4c7498a9bd275d73f53a77a22",
        "f338163651521ccd16c5ea803f84644d9ded279dec80f2aa8e10e0c633f8d340",
    ],
    &[
        "25a64e0a925abb3f25394590618355cde24599244b1188e87725754d789deb52",
        "f338163651521ccd16c5ea803f84644d9ded279dec80f2aa8e10e0c633f8d340",
    ],
    &["dcba172991c5ff198adae8362f96c58a6f610a1cd39bbe5183a929f8d94338ca"],
];

fn hex32(env: &Env, hex: &str) -> BytesN<32> {
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).unwrap();
    }
    BytesN::from_array(env, &out)
}

fn account(env: &Env, i: usize) -> Address {
    Address::from_string(&String::from_str(env, ACCOUNTS[i]))
}

fn proof(env: &Env, i: usize) -> Vec<BytesN<32>> {
    let mut v = Vec::new(env);
    for h in PROOFS[i] {
        v.push_back(hex32(env, h));
    }
    v
}

struct Setup<'a> {
    env: Env,
    drop: MerkledropClient<'a>,
    token_client: token::Client<'a>,
    admin: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = NOW);
    let token = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let admin = Address::generate(&env);
    StellarAssetClient::new(&env, &token).mint(&admin, &(TOTAL + 1_000));
    let drop = MerkledropClient::new(
        &env,
        &env.register(
            Merkledrop,
            (
                admin.clone(),
                token.clone(),
                hex32(&env, ROOT),
                TOTAL,
                END,
                String::from_str(&env, LIST),
            ),
        ),
    );
    let token_client = token::Client::new(&env, &token);
    Setup {
        env,
        drop,
        token_client,
        admin,
    }
}

#[test]
fn init_pulls_the_funding() {
    let s = setup();
    assert_eq!(s.token_client.balance(&s.drop.address), TOTAL);
    assert_eq!(s.drop.get_drop().root, hex32(&s.env, ROOT));
}

#[test]
fn leaf_and_root_match_the_typescript_tree_builder() {
    let env = Env::default();
    for (i, amount) in AMOUNTS.iter().enumerate() {
        let leaf = leaf_hash(&env, i as u32, &account(&env, i), *amount);
        assert_eq!(compute_root(&env, leaf, &proof(&env, i)), hex32(&env, ROOT));
    }
}

#[test]
fn g_account_leaves_match_the_typescript_tree_builder_too() {
    let env = Env::default();
    for (i, amount) in AMOUNTS.iter().enumerate() {
        let who = Address::from_string(&String::from_str(&env, G_ACCOUNTS[i]));
        let mut p = Vec::new(&env);
        for h in G_PROOFS[i] {
            p.push_back(hex32(&env, h));
        }
        let leaf = leaf_hash(&env, i as u32, &who, *amount);
        assert_eq!(compute_root(&env, leaf, &p), hex32(&env, G_ROOT));
    }
}

#[test]
fn every_recipient_can_claim_once() {
    let s = setup();
    for (i, amount) in AMOUNTS.iter().enumerate() {
        s.drop
            .claim(&(i as u32), &account(&s.env, i), amount, &proof(&s.env, i));
        assert_eq!(s.token_client.balance(&account(&s.env, i)), *amount);
        assert!(s.drop.is_claimed(&(i as u32)));
    }
    assert_eq!(s.drop.get_drop().claimed_total, TOTAL);
    assert_eq!(s.token_client.balance(&s.drop.address), 0);

    assert_eq!(
        s.drop
            .try_claim(&0, &account(&s.env, 0), &AMOUNTS[0], &proof(&s.env, 0)),
        Err(Ok(Error::AlreadyClaimed))
    );
}

#[test]
fn rejects_a_wrong_amount_account_or_index() {
    let s = setup();
    let p = proof(&s.env, 0);
    assert_eq!(
        s.drop
            .try_claim(&0, &account(&s.env, 0), &(AMOUNTS[0] + 1), &p),
        Err(Ok(Error::InvalidProof))
    );
    assert_eq!(
        s.drop
            .try_claim(&0, &Address::generate(&s.env), &AMOUNTS[0], &p),
        Err(Ok(Error::InvalidProof))
    );
    assert_eq!(
        s.drop.try_claim(&1, &account(&s.env, 0), &AMOUNTS[0], &p),
        Err(Ok(Error::InvalidProof))
    );
    assert_eq!(
        s.drop
            .try_claim(&0, &account(&s.env, 0), &AMOUNTS[0], &vec![&s.env]),
        Err(Ok(Error::InvalidProof))
    );
}

#[test]
fn verify_checks_without_claiming() {
    let s = setup();
    assert!(s
        .drop
        .verify(&2, &account(&s.env, 2), &AMOUNTS[2], &proof(&s.env, 2)));
    assert!(!s
        .drop
        .verify(&2, &account(&s.env, 2), &1, &proof(&s.env, 2)));
    assert!(!s.drop.is_claimed(&2));
}

#[test]
fn claims_close_at_the_end_and_the_admin_sweeps_the_rest() {
    let s = setup();
    s.drop
        .claim(&1, &account(&s.env, 1), &AMOUNTS[1], &proof(&s.env, 1));
    assert_eq!(s.drop.try_sweep(), Err(Ok(Error::NotEnded)));

    s.env.ledger().with_mut(|l| l.timestamp = END);
    assert_eq!(
        s.drop
            .try_claim(&0, &account(&s.env, 0), &AMOUNTS[0], &proof(&s.env, 0)),
        Err(Ok(Error::Ended))
    );
    assert_eq!(s.drop.sweep(), TOTAL - AMOUNTS[1]);
    assert_eq!(s.token_client.balance(&s.admin), 1_000 + TOTAL - AMOUNTS[1]);
}

#[test]
#[should_panic]
fn constructor_rejects_zero_funding() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = NOW);
    let a = Address::generate(&env);
    env.register(
        Merkledrop,
        (
            a.clone(),
            a,
            hex32(&env, ROOT),
            0i128,
            END,
            String::from_str(&env, ""),
        ),
    );
}

#[test]
#[should_panic]
fn constructor_rejects_a_past_end() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|l| l.timestamp = NOW);
    let a = Address::generate(&env);
    env.register(
        Merkledrop,
        (
            a.clone(),
            a,
            hex32(&env, ROOT),
            1i128,
            NOW,
            String::from_str(&env, ""),
        ),
    );
}

#[test]
fn the_list_uri_is_stored_with_the_root() {
    let s = setup();
    assert_eq!(s.drop.get_drop().list_uri, String::from_str(&s.env, LIST));
}

#[test]
fn admin_can_extend_but_not_shorten_the_window() {
    let s = setup();
    assert_eq!(s.drop.try_extend(&(END - 1)), Err(Ok(Error::InvalidEnd)));
    s.drop.extend(&(END + 10 * 86_400));
    s.env.ledger().with_mut(|l| l.timestamp = END + 86_400);
    s.drop
        .claim(&0, &account(&s.env, 0), &AMOUNTS[0], &proof(&s.env, 0));
    assert_eq!(s.drop.try_sweep(), Err(Ok(Error::NotEnded)));
}

#[test]
fn claim_many_is_all_or_nothing() {
    let s = setup();
    let entry = |i: usize, amount: i128| ClaimInput {
        index: i as u32,
        account: account(&s.env, i),
        amount,
        proof: proof(&s.env, i),
    };
    // A wrong amount in the batch rejects every claim in it.
    assert_eq!(
        s.drop
            .try_claim_many(&vec![&s.env, entry(0, AMOUNTS[0]), entry(1, 1)]),
        Err(Ok(Error::InvalidProof))
    );
    assert!(!s.drop.is_claimed(&0));

    s.drop.claim_many(&vec![
        &s.env,
        entry(0, AMOUNTS[0]),
        entry(1, AMOUNTS[1]),
        entry(2, AMOUNTS[2]),
    ]);
    assert_eq!(s.drop.get_drop().claimed_total, TOTAL);
    assert_eq!(
        s.drop.try_claim_many(&Vec::new(&s.env)),
        Err(Ok(Error::InvalidBatch))
    );
}

#[test]
fn claimed_flags_pack_into_words() {
    let s = setup();
    s.env.as_contract(&s.drop.address, || {
        for i in [0u32, 127, 128, 255, 70_000] {
            assert!(!is_claimed(&s.env, i));
            set_claimed(&s.env, i);
            assert!(is_claimed(&s.env, i));
        }
        // Neighbours in the same and adjacent words are untouched.
        for i in [1u32, 126, 129, 254, 256, 69_999] {
            assert!(!is_claimed(&s.env, i));
        }
    });
}
