# mycelium-p2p-sql

Multimaster P2P SQLite replication with a bitemporal touch.

Works in browser (WASM) and server (Bun).

## Install

```bash
npm install mycelium-p2p-sql --registry $NPM_REGISTRY
```

## Usage

```ts
import { createReplicator } from "mycelium-p2p-sql";
```

## Publish

```bash
npm version patch && npm publish --registry $NPM_REGISTRY
```
