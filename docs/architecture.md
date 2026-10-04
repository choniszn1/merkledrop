# Architecture

## On-chain state

```text
instance:   Drop { admin, token, root: BytesN<32>, ends_at, claimed_total }
persistent: Claimed(index) → true
```

The full allocation list never touches the chain. The contract stores one
32-byte root and one flag per claimed index.

## Hashing

```text
leaf = sha256( index:u32 BE ‖ amount:i128 BE ‖ ScVal-XDR(address) )
node = sha256( min(a,b) ‖ max(a,b) )
```

- The **index** makes every leaf unique (the same address can't collide)
  and lets claims be tracked with one key per index.
- **ScVal XDR** gives one canonical byte encoding for both `G…` accounts
  and `C…` contracts, identical in Rust (`to_xdr`) and TypeScript
  (`Address.toScVal().toXDR()`).
- **Sorted pairs** remove left/right flags from proofs.
- **Odd nodes are promoted** unchanged, so some proofs are one hash shorter.

## Cross-implementation guarantee

`contracts/merkledrop/src/test.rs` hard-codes a root and proofs produced by
`tools/`, and `tools/src/tree.test.ts` asserts the same root. A change to
either side's encoding fails CI.
