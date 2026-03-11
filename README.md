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

## Internals

`t348.mjs` is a single-file zero-dependency TypeScript + React loader, used for fast iteration on the browser version.

## Publish

```bash
npm version patch && npm publish --registry $NPM_REGISTRY
```
