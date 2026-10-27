# Glossary

Plain-language definitions for terms used in Merkledrop.

## Merkle drop

A token distribution where the distributor publishes a single 32-byte hash (the **Merkle root**) on-chain and funds the contract once. Recipients claim their allocation later by presenting a short cryptographic proof. No one-by-one pushes, no pre-funded recipient accounts needed.

## Merkle root

The single hash at the top of a Merkle tree. It uniquely commits to the full allocation list: changing any entry changes the root. The contract stores only this hash, not the full list.

## Merkle proof

A short list of sibling hashes that lets anyone verify a single entry is part of the tree without seeing the whole list. Proof length is O(log N) for a list of N entries.

## Leaf hash

The hash representing one allocation entry: `sha256(index ‖ amount ‖ address)`. The index prevents two entries with the same address and amount from being indistinguishable.

## Allocation

One (address, amount) pair in the distribution list. The list is built off-chain with the `tools/` tree builder and published at `list_uri`.

## Claim window

The period during which recipients may submit claims. It runs from contract deployment until `ends_at` (a UNIX timestamp in seconds). After `ends_at`, the admin may sweep unclaimed tokens.

## Sweep

The admin action that reclaims unclaimed tokens after the claim window closes. Only callable after `ends_at`.

## SAC (Stellar Asset Contract)

The Soroban smart contract that wraps a classic Stellar asset, making it callable from other contracts. Merkledrop distributes tokens via a SAC.
