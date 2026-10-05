# Testnet deployment

The web app and the examples in the README use this deployment on **Stellar testnet**
(Test SDF Network ; September 2015). Testnet is reset periodically; redeploy with the
commands in the README and update `web/.env.example` if these stop resolving.

| | |
| --- | --- |
| Demo drop | [`CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK`](https://stellar.expert/explorer/testnet/contract/CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK) |
| Drop wasm hash (used by "Create a drop") | `f285c779874ada4e128931a52b72d9f1fc7d4ea1a83a395f37d3876d9f1ad900` (constructor build, 2026-10-05) |
| Demo list | `web/public/demo-drop.json` (3 recipients, 17.5 XLM) |

Deployed 2026-10-04. Native XLM's asset contract on testnet is
`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.

The demo drop was created from the earlier build (separate `init` call). Drops created
from the web app now use the constructor build above; a test drop from it is
`CCGLNZFOJVGDL3CAJOMKL4R7VQW4MO4ANCPZFLWZFBBYS6AL5QKRMWPG`.
