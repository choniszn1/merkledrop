import { describe, expect, it } from "vitest";
import { buildTree, parseCsv } from "./tree";

// Same fixture as contracts/merkledrop/src/test.rs and tools/src/fixture.ts.
const FIXTURE = [
  { account: "CA44PCU2TFBNLQK3ITD2WN55BWSAYKZMUWYTV3NLG3F2NGF5ID4ZECR6", amount: 10_000_000_000n },
  { account: "CC45O2FM7GN75TCGNR4X5IXWZAZ3QZO5R7GBSPI5AJMYK5YTETNKDYXK", amount: 2_500_000_000n },
  { account: "CDXN7KXIDVF7GLMXLBDSN3KKE2OADULDKGEHBRQAFRHX3N73QGWLWHH7", amount: 750_000_000n },
];

describe("browser tree builder", () => {
  it("produces the exact root the contract tests assert", () => {
    expect(buildTree(FIXTURE).root).toBe("cc35b45ecb986cdbeebe0c3f2a5028709dfcff98d4a449e0e46a9e3de6a9c78d");
  });
  it("rejects duplicates", () => {
    expect(() => buildTree([FIXTURE[0], FIXTURE[0]])).toThrow(/duplicate/);
  });
});

describe("parseCsv details", () => {
  const units = (s: string) => {
    if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("bad");
    return BigInt(Math.round(Number(s) * 1e7));
  };
  it("reports the line number as it appears in the file", () => {
    const text = "address,amount\n\nGA,1\n\nGB,oops\n";
    expect(() => parseCsv(text, units)).toThrow('Line 5: "oops"');
  });
  it("accepts quoted amounts with thousands separators and a quoted header", () => {
    const rows = parseCsv('"address","amount"\nGA,"1,000.5"\nGB,2', units);
    expect(rows).toEqual([
      { account: "GA", amount: 10_005_000_000n },
      { account: "GB", amount: 20_000_000n },
    ]);
  });
});
