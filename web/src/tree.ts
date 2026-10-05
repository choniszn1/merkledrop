import { Address, hash, StrKey } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

export interface Claim {
  index: number;
  account: string;
  amount: string;
  proof: string[];
}
export interface DropTree {
  root: string;
  total: string;
  claims: Claim[];
}

/** sha256(index u32 BE ‖ amount i128 BE ‖ address ScVal XDR): identical to the contract and tools/. */
export function leafHash(index: number, account: string, amount: bigint): Buffer {
  const idx = Buffer.alloc(4);
  idx.writeUInt32BE(index, 0);
  const amt = Buffer.alloc(16);
  const hi = (amount >> 64n) & 0xffffffffffffffffn;
  const lo = amount & 0xffffffffffffffffn;
  for (let i = 0; i < 8; i++) {
    amt[7 - i] = Number((hi >> BigInt(8 * i)) & 0xffn);
    amt[15 - i] = Number((lo >> BigInt(8 * i)) & 0xffn);
  }
  const addr = Buffer.from(new Address(account).toScVal().toXDR());
  return Buffer.from(hash(Buffer.concat([idx, amt, addr])));
}

export function hashPair(a: Buffer, b: Buffer): Buffer {
  return Buffer.from(hash(Buffer.compare(a, b) <= 0 ? Buffer.concat([a, b]) : Buffer.concat([b, a])));
}

export function buildTree(rows: { account: string; amount: bigint }[]): DropTree {
  if (!rows.length) throw new Error("The list is empty.");
  const seen = new Set<string>();
  let total = 0n;
  rows.forEach((r, i) => {
    if (!StrKey.isValidEd25519PublicKey(r.account) && !StrKey.isValidContract(r.account)) throw new Error(`Row ${i + 1}: invalid address`);
    if (r.amount <= 0n) throw new Error(`Row ${i + 1}: amount must be positive`);
    if (seen.has(r.account)) throw new Error(`Row ${i + 1}: duplicate address`);
    seen.add(r.account);
    total += r.amount;
  });
  const levels: Buffer[][] = [rows.map((r, i) => leafHash(i, r.account, r.amount))];
  while (levels[levels.length - 1].length > 1) {
    const lvl = levels[levels.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < lvl.length; i += 2) next.push(i + 1 < lvl.length ? hashPair(lvl[i], lvl[i + 1]) : lvl[i]);
    levels.push(next);
  }
  const claims = rows.map((r, index) => {
    const proof: string[] = [];
    let pos = index;
    for (const lvl of levels.slice(0, -1)) {
      const sib = pos % 2 === 0 ? pos + 1 : pos - 1;
      if (sib < lvl.length) proof.push(lvl[sib].toString("hex"));
      pos = Math.floor(pos / 2);
    }
    return { index, account: r.account, amount: r.amount.toString(), proof };
  });
  return { root: levels[levels.length - 1][0].toString("hex"), total: total.toString(), claims };
}

/** Split one CSV line, honouring double quotes ("1,000.5" stays one field). */
function csvFields(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') (field += '"'), i++;
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field.trim());
  return out;
}

/**
 * "address,amount" CSV where amount is a decimal in whole tokens (7 decimals).
 * A header row and blank lines are skipped; quoted amounts may use thousands
 * separators. Errors name the line as it appears in the file.
 */
export function parseCsv(text: string, toUnits: (s: string) => bigint) {
  const rows: { account: string; amount: bigint }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || /^"?address"?\s*,/i.test(line)) return;
    const [account, amountRaw = ""] = csvFields(line);
    const amount = amountRaw.replace(/[,_\s]/g, "");
    try {
      rows.push({ account, amount: toUnits(amount) });
    } catch {
      throw new Error(`Line ${i + 1}: "${amountRaw}" isn't a valid amount`);
    }
  });
  return rows;
}
