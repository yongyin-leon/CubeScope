# `0.1.0-alpha.1` Release Checklist

Status snapshot:

- local alpha verification completed on `2026-04-17`
- remaining external gate: confirm GitHub Actions on Node 22 before public tag

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
- [x] repository remains private while external release gates are still pending
