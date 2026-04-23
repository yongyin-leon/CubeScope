# `0.1.0-alpha.1` Release Checklist

Status snapshot:

- local alpha verification completed on `2026-04-23`
- local verification artifacts now include benchmark, browser-matrix,
  pack-consumer, and alpha summary reports under `output/`
- shipped remote-sample validation now includes both the deterministic local
  fixture and a public external ENVI sample report under `output/samples/`
- local `Node 22` verification now passes through `npm run verify:node22-local`
- GitHub Actions confirmation on Node 22 is intentionally deferred for now and
  is not part of the current execution window

- [x] package metadata matches `CubeScope` / `@cubescope/web`
- [x] README quickstart matches the verified local workflow
- [x] `CITATION.cff`, LICENSE, and package metadata are consistent
- [x] `npm run fixtures:generate` succeeds
- [x] `npm run build:wasm` succeeds
- [x] `npm run build` succeeds on a fresh local checkout
- [x] `npm run test` succeeds
- [x] `npm run report:toolchain` writes `output/toolchain/local-toolchain.json`
- [x] `npm run report:browser-matrix` writes `output/browser-matrix/latest.json`
- [x] `npm run benchmark` writes `output/benchmark/latest.json`
- [x] `npm run validate:samples` writes `output/samples/latest.json`
- [x] public-tier sample validation writes `output/samples/public-latest.json`
- [x] `npm run verify:pack` validates tarball install/import from an isolated consumer app
- [x] `npm run report:alpha` writes `output/alpha/local-alpha-summary.json`
- [x] synthetic fixture metadata is documented
- [x] registered remote-sample catalog is locally validated
- [ ] GitHub Actions CI is green on Node 22 when the project is ready for that external gate
- [x] `npm run verify:node22-local` passes when a local Node 22 runtime is available
- [x] repository remains private while external release gates are still pending

## Deferred External Gate

The current alpha can continue local hardening work without GitHub Actions.
External CI remains a public-release gate, not a blocker for private local
verification.

## CI Failure Triage

Hard blockers for a public alpha tag:

1. `npm ci`, `npm run build:wasm`, `npm run build`, `npm run test`, or
   `npm run benchmark`, or `npm run verify:pack` fails for repository reasons
2. runtime asset loading fails for the worker or WASM bundle
3. the example smoke path or isolated consumer install/import path fails
4. contract tests reveal a public API mismatch that is not documented

Retry-only failures that do not count as green until a clean rerun exists:

1. transient GitHub-hosted network or browser-download failures
2. clearly infrastructure-scoped runner instability with no repository diff

Rule:

- infra-only failures may be retried, but the checklist item stays incomplete
  until a clean successful run is recorded
