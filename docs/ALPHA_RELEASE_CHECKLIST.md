# `0.1.0-alpha.1` Release Checklist

Status snapshot:

- local alpha verification completed on `2026-04-17`
- remaining external gates: confirm GitHub Actions on Node 22 and verify
  install-from-another-app embedding before public tag

- [x] package metadata matches `CubeScope` / `@cubescope/web`
- [x] README quickstart matches the verified local workflow
- [x] `CITATION.cff`, LICENSE, and package metadata are consistent
- [x] `npm run fixtures:generate` succeeds
- [x] `npm run build:wasm` succeeds
- [x] `npm run build` succeeds on a fresh local checkout
- [x] `npm run test` succeeds
- [x] `npm run benchmark` writes `output/benchmark/latest.json`
- [x] synthetic fixture metadata is documented
- [ ] GitHub Actions CI is green on Node 22
- [ ] one external consumer app has successfully installed and embedded `@cubescope/web`
- [x] repository remains private while external release gates are still pending

## CI Failure Triage

Hard blockers for a public alpha tag:

1. `npm ci`, `npm run build:wasm`, `npm run build`, `npm run test`, or
   `npm run benchmark` fails for repository reasons
2. runtime asset loading fails for the worker or WASM bundle
3. the example smoke path or external consumer-app embedding path fails
4. contract tests reveal a public API mismatch that is not documented

Retry-only failures that do not count as green until a clean rerun exists:

1. transient GitHub-hosted network or browser-download failures
2. clearly infrastructure-scoped runner instability with no repository diff

Rule:

- infra-only failures may be retried, but the checklist item stays incomplete
  until a clean successful run is recorded
