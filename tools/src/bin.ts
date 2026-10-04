#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { buildTree, parseCsv } from "./tree.js";

const [input, output = "drop.json"] = process.argv.slice(2);
if (!input) {
  console.error("usage: merkledrop <allocations.csv> [out.json]\n  CSV rows: address,amount_in_base_units");
  process.exit(1);
}
try {
  const tree = buildTree(parseCsv(readFileSync(input, "utf8")));
  writeFileSync(output, JSON.stringify(tree, null, 2));
  console.log(`root:   ${tree.root}`);
  console.log(`total:  ${tree.total} (fund the contract with at least this)`);
  console.log(`claims: ${tree.claims.length} → ${output}`);
} catch (err) {
  console.error(`merkledrop: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
