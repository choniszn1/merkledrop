# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Repository health files: code of conduct, contributing guide, security
  policy, issue and pull request templates, Dependabot and editor config.
- Design documentation under `docs/`.

## [0.1.0] - 2026-10-04

### Added

- Initial release of Merkledrop: a Merkle-proof airdrop contract with a TypeScript tree builder.
- Soroban smart contract with `claim`, `claim_many`, and `sweep` entry points.
- TypeScript tree builder (`tools/`) for building Merkle trees from CSV allocation lists.
- React web app (`web/`) for claiming drops via the Freighter wallet extension.
- Documentation under `docs/` covering architecture, deployment, and running an airdrop.
