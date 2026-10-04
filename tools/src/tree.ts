import { createHash } from "node:crypto";
import { Address, StrKey } from "@stellar/stellar-sdk";

export interface Allocation {
  account: string;
  /** Amount in the token's smallest unit. */
  amount: bigint;
}

export interface Claim {
  index: number;
  account: string;
  amount: string;
  /** Hex-encoded sibling hashes, leaf to root. */
  proof: string[];
}

export interface DropTree {
  root: string;
  total: string;
  claims: Claim[];
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest();

/** sha256(index u32 BE ‖ amount i128 BE ‖ address ScVal XDR): matches the contract. */
export function leafHash(index: number, account: string, amount: bigint): Buffer {
  const idx = Buffer.alloc(4);
  idx.writeUInt32BE(index);
  const amt = Buffer.alloc(16);
  amt.writeBigUInt64BE((amount >> 64n) & 0xffffffffffffffffn, 0);
  amt.writeBigUInt64BE(amount & 0xffffffffffffffffn, 8);
  const addr = new Address(account).toScVal().toXDR();
  return sha256(Buffer.concat([idx, amt, addr]));
}

/** sha256(min(a, b) ‖ max(a, b)) */
export function hashPair(a: Buffer, b: Buffer): Buffer {
  return Buffer.compare(a, b) <= 0 ? sha256(Buffer.concat([a, b])) : sha256(Buffer.concat([b, a]));
}

/**
 * Build the tree. Odd nodes at any level are promoted unchanged, so proofs
 * may be shorter for some leaves; the contract handles any proof length.
 */
export function buildTree(allocations: Allocation[]): DropTree {
  if (allocations.length === 0) throw new Error("no allocations");
  const seen = new Set<string>();
  let total = 0n;
  allocations.forEach(({ account, amount }, i) => {
    if (!StrKey.isValidEd25519PublicKey(account) && !StrKey.isValidContract(account)) {
      throw new Error(`row ${i + 1}: invalid address ${account}`);
    }
    if (amount <= 0n || amount >= 2n ** 127n) throw new Error(`row ${i + 1}: amount must be positive`);
    if (seen.has(account)) throw new Error(`row ${i + 1}: duplicate address ${account}`);
    seen.add(account);
    total += amount;
  });

  const levels: Buffer[][] = [allocations.map((a, i) => leafHash(i, a.account, a.amount))];
  while (levels[levels.length - 1].length > 1) {
    const level = levels[levels.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? hashPair(level[i], level[i + 1]) : level[i]);
    }
    levels.push(next);
  }

  const claims = allocations.map((a, index) => {
    const proof: string[] = [];
    let pos = index;
    for (const level of levels.slice(0, -1)) {
      const sibling = pos % 2 === 0 ? pos + 1 : pos - 1;
      if (sibling < level.length) proof.push(level[sibling].toString("hex"));
      pos = Math.floor(pos / 2);
    }
    return { index, account: a.account, amount: a.amount.toString(), proof };
  });

  return { root: levels[levels.length - 1][0].toString("hex"), total: total.toString(), claims };
}

export function verifyClaim(root: string, claim: Claim): boolean {
  let node = leafHash(claim.index, claim.account, BigInt(claim.amount));
  for (const sibling of claim.proof) node = hashPair(node, Buffer.from(sibling, "hex"));
  return node.toString("hex") === root;
}

/** Parse `address,amount` lines (header and blank lines allowed). */
export function parseCsv(text: string): Allocation[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^address\s*,/i.test(line))
    .map((line, i) => {
      const [account, amount] = line.split(",").map((s) => s.trim());
      if (!/^\d+$/.test(amount ?? "")) throw new Error(`line ${i + 1}: amount must be a whole number of base units`);
      return { account, amount: BigInt(amount) };
    });
}
