# SoftwareX Release Gate Report v1

Generated from `npm run verify:alpha` on `2026-05-12`.

## Verdict

The local alpha release gate passed. CubeScope is technically ready for a
release-candidate freeze, subject to the remaining author-controlled submission
items and repository-publication decision.

## Runtime

| Item | Value |
| --- | --- |
| Node | `v22.22.2` |
| npm | `10.9.7` |
| Rust | `rustc 1.94.0 (4a4ef493e 2026-03-02) (Homebrew)` |
| Browser | Chromium `147.0.7727.15` |
| Renderer used for benchmark | `webgl` |

## Release Gate Status

| Gate | Status |
| --- | --- |
| Local alpha verification | `passed` |
| Deterministic HTTP fixture | `passed` |
| Registered remote sample catalog | `passed` |
| Public remote sample | `passed` |
| WebGL fallback | `passed` |
| Local browser matrix | `passed` |
| Node 22 local runtime | `passed` |
| Node 22 external CI | `deferred` |
| Repository visibility | `private` |

## Test Summary

| Test group | Result |
| --- | --- |
| Unit tests | `32` files, `135` tests passed |
| Smoke tests | `4` tests passed |
| Sample catalog smoke | `1` test passed |
| Rust parser tests | `7` tests passed |
| Browser matrix | Chromium, Firefox, and WebKit `4/4` scenarios passed, `0` warnings |

## Benchmark Snapshot

The deterministic fixture was `48 x 48 x 32` with `bsq` interleave.

| Scenario | Header parse | Initial view | Band switch |
| --- | ---: | ---: | ---: |
| Local file/blob | `4.9 ms` | `20.0 ms` | `5.6 ms` |
| Same-origin HTTP range | `4.0 ms` | `17.8 ms` | `9.1 ms` |

These values are local validation outputs and should not be presented as a
hardware-independent comparative benchmark.

## Package Verification

`npm pack` produced:

| Item | Value |
| --- | --- |
| Tarball | `cubescope-web-0.1.0-alpha.1.tgz` |
| Packed size | `269302` bytes |
| Unpacked size | `1315070` bytes |
| Entry count | `23` |
| Integrity | `sha512-QZy1M5F53n8Yf9bIJhVZpPxz8etNpoLIwBAzxReiSdwTH2cf3hSWDLiMgd5wKQjsqJkjeeJbBpZFV4lvAykY3A==` |

Verified public exports:

- `default`
- `CubeViewer`
- `EnviViewer`

Verified package assets:

- `dist/cubescope.es.js`
- `dist/worker.js`
- `dist/pkg/envi_parser.js`
- `dist/pkg/envi_parser_bg.wasm`
- `dist/fixtures/cubescope-mini-cube.hdr`
- `dist/fixtures/cubescope-mini-cube.img`
- `dist/fixtures/cubescope-mini-cube.json`
- `dist/fixtures/cubescope-mini-cube-bil.*`
- `dist/fixtures/cubescope-mini-cube-bip.*`
- `dist/samples/remote-samples.json`
- `CITATION.cff`

## Remaining Release Decisions

- Make the GitHub repository public before submission; remote status was still
  `private` on `2026-05-12`.
- Publish/tag exactly `0.1.0-alpha.1` unless a new metadata-only release tag is
  chosen before archival.
- Decide whether to archive the release through Zenodo or another DOI provider.
- Confirm external CI if desired; local Node 22 verification is passed, but
  external CI remains explicitly deferred.
- Keep local real hyperspectral datasets excluded from Git.
