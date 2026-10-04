# Running an airdrop

1. **Prepare `allocations.csv`** (`address,amount` in base units; 1 XLM = 10,000,000).
2. **Build the tree:** `node tools/dist/bin.js allocations.csv drop.json`.
   Note the printed `root` and `total`.
3. **Deploy and init:** `init(admin, token, root, funding = total, ends_at)`.
   The contract pulls `funding` from the admin.
4. **Publish `drop.json`** where your claim page can fetch it, keyed by address.
5. **Users claim** with `claim(index, address, amount, proof)`. Anyone can
   submit it, so you can sponsor fees for users.
6. **After `ends_at`,** call `sweep()` to recover what's left.

## Tips

- Classic `G…` recipients need a trustline to the token before claiming.
  Say so clearly on the claim page.
- Keep a copy of `drop.json`: without it, recipients can't build proofs.
- De-duplicate addresses before building. The builder rejects duplicates.
