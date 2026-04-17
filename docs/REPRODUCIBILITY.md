# Reproducibility Guide

This document defines the verified local path for rebuilding and validating the
CubeScope alpha.

## Toolchain

- Node.js `22.x`
- npm `>=10`
- Rust stable managed by `rustup`
- Rust target: `wasm32-unknown-unknown`
- `wasm-bindgen-cli 0.2.100`

## Fresh Setup

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
npm run fixtures:generate
```

## Rebuild Commands

```bash
# Rebuild the Rust/WASM runtime into src/lib/pkg
npm run build:wasm

# Rebuild the browser SDK, worker bundle, and runtime assets into dist/
npm run build
```

## Validation Commands

```bash
# Contract tests + browser smoke
npm run test

# Early software-paper metrics
npm run benchmark

# Full local alpha gate
npm run verify:alpha
```

## Expected Outputs

- `src/lib/pkg/envi_parser.js`
- `src/lib/pkg/envi_parser_bg.wasm`
- `dist/cubescope.es.js`
- `dist/worker.js`
- `dist/pkg/*`
- `output/benchmark/latest.json`

## Notes

- `dist/` is a build artifact, not source of truth.
- Rust source under `rust/envi_parser_Improved/` remains the authority for the
  wasm runtime.
- The WASM rebuild script prefers the `rustup` toolchain when available so the
  `cargo` and `rustc` pair stays consistent across local environments.
- The synthetic ENVI fixture under `test-data/fixtures/` is deterministic and
  can be regenerated with `npm run fixtures:generate`.
