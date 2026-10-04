// Shared fixture (contract addresses, which hold Soroban tokens without
// trustlines, so the Rust tests can transfer to them directly): the same allocations are hard-coded in the contract's
// Rust tests, which assert the identical root, proving both sides hash
// leaves and pairs the same way.
export const FIXTURE = [
  { account: "CA44PCU2TFBNLQK3ITD2WN55BWSAYKZMUWYTV3NLG3F2NGF5ID4ZECR6", amount: 1_000_0000000n },
  { account: "CC45O2FM7GN75TCGNR4X5IXWZAZ3QZO5R7GBSPI5AJMYK5YTETNKDYXK", amount: 250_0000000n },
  { account: "CDXN7KXIDVF7GLMXLBDSN3KKE2OADULDKGEHBRQAFRHX3N73QGWLWHH7", amount: 75_0000000n },
];
