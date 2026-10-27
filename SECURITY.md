# Security Policy

Merkledrop is a Merkle-proof airdrop contract with a TypeScript tree builder. It currently targets **Stellar testnet**; there
is no audited mainnet deployment yet. Treat it accordingly before handling
real funds.

## Reporting a vulnerability

**Please don't open a public issue for security problems.**

1. Open the [Security tab](https://github.com/choniszn1/merkledrop/security) of this repository.
2. Click **Report a vulnerability** to start a private advisory.

Include what's affected, how to reproduce it (a failing test is ideal), and
the impact you expect. You'll get an acknowledgement on the advisory, and
a fix is coordinated there before anything is disclosed.

## Disclosure timeline

We aim to acknowledge reports within **3 business days** and to release a fix within **90 days** of acknowledgement. If a fix cannot be delivered in 90 days, we will coordinate an extended timeline with the reporter. Contact: security@merkledrop.example

## What's in scope

Anything in this repository, especially proof verification, double claims, leaf encoding mismatches between Rust and TypeScript.

## Supported versions

Only the latest commit on `main` is supported. There are no tagged
releases yet, so fixes land on `main`.
