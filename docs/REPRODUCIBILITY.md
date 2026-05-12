# Reproducibility Guide

This document defines the verified local path for rebuilding and validating the
CubeScope alpha.

## Toolchain

- Node.js `22.x`
- npm `>=10`
- Rust stable managed by `rustup`
- Rust target: `wasm32-unknown-unknown`
- `wasm-bindgen-cli 0.2.100`

The runtime support policy is:

- `Node 22.x` is the official release and reproducibility baseline
- newer Node versions may still be used for local development
- passing on a newer runtime does not replace the `Node 22` gate

See `docs/RUNTIME_SUPPORT_POLICY.md` for the full policy.

## Fresh Setup

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
npm run fixtures:generate
```

## Rebuild Commands

```bash
# Rebuild the Rust/WASM runtime into src/runtime/pkg
npm run build:wasm

# Rebuild the browser SDK, worker bundle, and runtime assets into dist/
npm run build
```

## Validation Commands

```bash
# Contract tests + browser smoke
npm run test

# Local browser matrix report; Chromium/Firefox/WebKit are validated when installed
npm run report:browser-matrix

# Inspect the current local toolchain and Node 22 runtime availability
npm run report:toolchain

# Early software-paper metrics
npm run benchmark

# Generate a preview remote-sample catalog for a public candidate
npm run create:sample-catalog -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img" --output public/samples/remote-samples.preview.json

# Qualify a candidate public remote sample
npm run qualify:sample -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# Run the full candidate pipeline: preview catalog + qualification + browser validation
npm run validate:sample-candidate -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# Validate the registered remote-sample catalog locally
npm run validate:samples

# Validate a preview catalog / sample id without editing the shipped catalog
CUBESCOPE_SAMPLE_CATALOG_URL=/samples/remote-samples.preview.json CUBESCOPE_REGISTERED_SAMPLE_ID=candidate-id npm run validate:samples

# Tarball install/import verification from an isolated consumer app
npm run verify:pack

# Run the full alpha gate under a detected local Node 22 runtime
npm run verify:node22-local

# Generate the consolidated local alpha summary
npm run report:alpha

# Full local alpha gate
npm run verify:alpha
```

## Expected Outputs

- `src/runtime/pkg/envi_parser.js`
- `src/runtime/pkg/envi_parser_bg.wasm`
- `dist/cubescope.es.js`
- `dist/worker.js`
- `dist/pkg/*`
- `output/benchmark/latest.json`
- `output/browser-matrix/latest.json`
- `output/samples/latest.json`
- `output/pack-consumer/latest.json`
- `output/toolchain/local-toolchain.json`
- `output/alpha/local-alpha-summary.json`

## Notes

- `dist/` is a build artifact, not source of truth.
- Rust source under `rust/envi-parser/` remains the authority for the
  wasm runtime.
- The WASM rebuild script prefers the `rustup` toolchain when available so the
  `cargo` and `rustc` pair stays consistent across local environments.
- Both `.nvmrc` and `.node-version` are pinned to `22` so common version
  managers resolve the same target runtime.
- `wasm-bindgen-cli 0.2.100` should only be updated together with the
  reproducibility doc, CI workflow, and local verification commands in the same
  change.
- The synthetic ENVI fixture under `test-data/fixtures/` is deterministic and
  can be regenerated with `npm run fixtures:generate`.
- Runtime statistics sampling uses deterministic tile selection, so repeated
  smoke, benchmark, and screenshot visual outputs do not depend on random tile
  choices.
- That fixture now includes ENVI `map info` and `coordinate system string`
  fields so local validation covers the spatial-reference normalization path.
- The fixture generator also emits deterministic BIL and BIP variants for
  adapter/CubeStore boundary tests, while the original BSQ
  `cubescope-mini-cube` remains the smoke and benchmark baseline.
- The same fixture is mirrored into `public/fixtures/`, which gives the local
  benchmark and smoke automation a deterministic same-origin `envi-http`
  target with `HTTP range` reads and no external dependency.
- The registered remote-sample catalog currently lives at
  `public/samples/remote-samples.json`, and `npm run validate:samples`
  validates the local sample tier against both transport checks and the demo
  load path.
- The shipped catalog now also includes one validated public remote sample,
  `snowex-aviris-ng-sasp`, and `CUBESCOPE_SAMPLE_TIER=public
  CUBESCOPE_SAMPLE_REPORT_PATH=output/samples/public-latest.json npm run
  validate:samples` reproduces that external browser-visible path.
- `npm run create:sample-catalog` can generate a preview catalog for an
  external candidate, and the smoke/benchmark helpers can be redirected with
  `CUBESCOPE_SAMPLE_CATALOG_URL` plus `CUBESCOPE_REGISTERED_SAMPLE_ID`.
- `npm run validate:sample-candidate` is the preferred promotion-check path
  because it chains preview catalog generation, qualification, and browser
  validation into one reproducible command, and it removes the temporary
  preview catalog afterward unless `--keep-preview` is passed.
- `npm run report:toolchain` records whether a local Node 22 runtime is
  discoverable, and `npm run verify:node22-local` is the dedicated entrypoint
  for rerunning the alpha gate under that target runtime.
- `npm run report:browser-matrix` records a local browser matrix against the
  deterministic ENVI fixture. Chromium `webgl` and `auto` scenarios are
  required; Firefox and WebKit WebGL scenarios are verified when the local
  Playwright browser binaries are installed, and otherwise recorded as skipped.
- Candidate public sources should first pass `npm run qualify:sample` before
  they are added to the shipped catalog.
- The deterministic local gate remains separate from the public remote-sample
  gate, but the repository now ships one validated external ENVI sample and
  records its smoke output under `output/samples/public-latest.json`.
- `npm run report:alpha` records the current local verification runtime
  separately from the target toolchain, so a workstation running a newer Node
  can still document that Node 22 remains the intended public-release target.
- If the repository later changes its official Node baseline, the change should
  be reflected in `package.json`, `.nvmrc`, `.node-version`, this document, and
  the local verification/report scripts in the same update.
