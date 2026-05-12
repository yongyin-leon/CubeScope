# CubeScope `0.1.0-alpha.1` Release Notes

This release is archived on Zenodo as
[`10.5281/zenodo.20131367`](https://doi.org/10.5281/zenodo.20131367).

## Summary

CubeScope `0.1.0-alpha.1` is a browser-native, local-first viewer kernel for
ENVI hyperspectral datasets. It provides an embeddable JavaScript API backed by
Rust/WebAssembly ENVI parsing, Web Worker runtime orchestration, and
hardware-accelerated rendering with a WebGPU-preferred path and verified WebGL
fallback.

## Main Capabilities

- Local ENVI header/image loading through browser file/blob sources.
- Same-origin HTTP range-backed ENVI loading for remote sample workflows.
- Normalized cube metadata access.
- Pseudo-RGB viewing with safe initial band selection.
- Metadata-aware initial band selection from ENVI `default bands` and
  `wavelength` fields when available.
- Spectral probing for pixel inspection.
- Affine pixel/world mapping when ENVI spatial metadata is present.
- Common ENVI `map info` variants normalized for UTM and non-UTM headers, while
  full CRS conversion and reprojection remain deferred.
- Explicit runtime asset packaging for worker and WebAssembly files.
- Browser validation through Playwright smoke tests and browser-matrix reports.
- Reviewer-facing static demo page with a compact viewer workspace and
  GitHub Pages deployment workflow.

## Verification Snapshot

Latest local release gate: `npm run verify:alpha` on `2026-05-12`.

| Gate | Status |
| --- | --- |
| Unit tests | `135/135` passed |
| Smoke tests | `4/4` passed |
| Sample catalog smoke | `1/1` passed |
| Browser matrix | Chromium, Firefox, and WebKit `4/4` scenarios passed |
| Local alpha gate | `passed` |
| Package-consumer verification | `passed` |
| Node 22 local runtime | `passed` |

Validated local runtime:

- Node `v22.22.2`
- npm `10.9.7`
- Rust `1.94.0`
- wasm-bindgen-cli `0.2.100`
- Chromium `147.0.7727.15`

Deterministic fixture benchmark snapshot:

| Scenario | Header parse | Initial view | Band switch |
| --- | ---: | ---: | ---: |
| Local file/blob | `4.9 ms` | `20.0 ms` | `5.6 ms` |
| Same-origin HTTP range | `4.0 ms` | `17.8 ms` | `9.1 ms` |

These values are local validation outputs rather than hardware-independent
comparative performance claims.

## Package Snapshot

`npm pack` verification produced:

- Tarball: `cubescope-web-0.1.0-alpha.1.tgz`
- Packed size: `269302` bytes
- Unpacked size: `1315070` bytes
- Entries: `23`

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

## Known Limitations

- CubeScope is ENVI-first and not yet a broadly multi-format viewer.
- The remote workflow requires compatible CORS and HTTP range behavior.
- The current alpha is a browser SDK, not a full hyperspectral analysis
  platform.
- Benchmark values are local validation outputs, not comparative systems
  benchmarks.
- Real-data screenshots used in the manuscript are generated from local
  datasets that are not redistributed with the repository.

## Permanent Links

- GitHub repository: <https://github.com/yongyin-leon/CubeScope>
- GitHub release: <https://github.com/yongyin-leon/CubeScope/releases/tag/v0.1.0-alpha.1>
- Zenodo DOI: <https://doi.org/10.5281/zenodo.20131367>
- Recommended citation: Li, Y. (2026). *CubeScope: browser-native ENVI
  hyperspectral viewer kernel*. Zenodo.
  <https://doi.org/10.5281/zenodo.20131367>
