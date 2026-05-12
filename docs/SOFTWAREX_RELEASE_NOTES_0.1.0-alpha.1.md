# CubeScope `0.1.0-alpha.1` Release Notes Draft

This draft is prepared for the SoftwareX submission release candidate. It is
not a Git tag or public release by itself.

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

Latest local release gate: `npm run verify:alpha` on `2026-04-24`.

| Gate | Status |
| --- | --- |
| Unit tests | `129/129` passed |
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
| Local file/blob | `6.5 ms` | `26.2 ms` | `8.4 ms` |
| Same-origin HTTP range | `6.1 ms` | `29.9 ms` | `15.2 ms` |

These values are local validation outputs rather than hardware-independent
comparative performance claims.

## Package Snapshot

`npm pack` verification produced:

- Tarball: `cubescope-web-0.1.0-alpha.1.tgz`
- Packed size: `264121` bytes
- Unpacked size: `1291282` bytes
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

## Before Public Release

- Confirm the repository is public.
- Confirm the release tag to use for the manuscript.
- Confirm support email and final author metadata.
- Confirm screenshot permissions/provenance for local real ENVI validation
  imagery.
- Add DOI/archive URL if a permanent release identifier is created.
