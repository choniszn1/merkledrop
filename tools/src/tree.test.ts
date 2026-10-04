import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { FIXTURE } from "./fixture.js";
import { buildTree, parseCsv, verifyClaim } from "./tree.js";

describe("buildTree", () => {
  it("matches the root hard-coded in the contract's Rust tests", () => {
    // contracts/merkledrop/src/test.rs asserts this exact root on-chain.
    const tree = buildTree(FIXTURE);
    expect(tree.root).toBe("cc35b45ecb986cdbeebe0c3f2a5028709dfcff98d4a449e0e46a9e3de6a9c78d");
    expect(tree.total).toBe("13250000000");
  });

  it("produces a valid proof for every allocation in a large drop", () => {
    const allocations = Array.from({ length: 257 }, (_, i) => ({
      account: i % 2 ? Keypair.random().publicKey() : StrKey.encodeContract(randomBytes(32)),
      amount: BigInt(i + 1) * 10_000_000n,
    }));
    const tree = buildTree(allocations);
    expect(tree.claims).toHaveLength(257);
    for (const claim of tree.claims) expect(verifyClaim(tree.root, claim)).toBe(true);
    // log2(257) rounded up: proofs stay tiny however big the list.
    expect(Math.max(...tree.claims.map((c) => c.proof.length))).toBeLessThanOrEqual(9);
  });

  it("rejects tampered claims", () => {
    const tree = buildTree(FIXTURE);
    const claim = tree.claims[0];
    expect(verifyClaim(tree.root, { ...claim, amount: (BigInt(claim.amount) + 1n).toString() })).toBe(false);
    expect(verifyClaim(tree.root, { ...claim, index: 1 })).toBe(false);
    expect(verifyClaim(tree.root, { ...claim, proof: claim.proof.slice(1) })).toBe(false);
  });

  it("handles a single recipient", () => {
    const tree = buildTree([FIXTURE[0]]);
    expect(tree.claims[0].proof).toEqual([]);
    expect(verifyClaim(tree.root, tree.claims[0])).toBe(true);
  });

  it("validates input", () => {
    expect(() => buildTree([])).toThrow(/no allocations/);
    expect(() => buildTree([{ account: "GNOPE", amount: 1n }])).toThrow(/invalid address/);
    expect(() => buildTree([{ ...FIXTURE[0], amount: 0n }])).toThrow(/positive/);
    expect(() => buildTree([FIXTURE[0], FIXTURE[0]])).toThrow(/duplicate/);
  });
});

describe("parseCsv", () => {
  it("parses rows, skipping a header and blank lines", () => {
    const csv = `address,amount\n${FIXTURE[0].account}, 100\n\n${FIXTURE[1].account},200\r\n`;
    expect(parseCsv(csv)).toEqual([
      { account: FIXTURE[0].account, amount: 100n },
      { account: FIXTURE[1].account, amount: 200n },
    ]);
  });

  it("rejects decimal amounts (must be base units)", () => {
    expect(() => parseCsv(`${FIXTURE[0].account},1.5`)).toThrow(/whole number/);
  });
});
