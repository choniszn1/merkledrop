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
  // process.stdout.write is used here to ensure output is flushed before exit on all platforms.
  process.stdout.write(`root:   ${tree.root}
`);
  process.stdout.write(`total:  ${tree.total} (fund the contract with at least this)
`);
  process.stdout.write(`claims: ${tree.claims.length} → ${output}
`);
} catch (err) {
  console.error(`merkledrop: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
