# CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets

## Title Page Draft

Authors: `[To be completed]`

Affiliations: `[To be completed]`

Corresponding author: `[To be completed]`

## Abstract

CubeScope is a browser-native viewer kernel for ENVI hyperspectral datasets.
The software addresses a gap between heavyweight desktop or server-centered
remote-sensing environments and lightweight web image viewers by providing
local-first, embeddable interaction with multi-band image cubes in modern
browsers. CubeScope combines a Rust/WebAssembly ENVI parser, Web Workers for
background loading and tile-oriented runtime work, and a hardware-accelerated
rendering path that prefers WebGPU while retaining a verified WebGL
compatibility fallback. The current alpha release supports local ENVI loading,
HTTP range-backed remote ENVI access, normalized cube metadata, spectral
probing, affine pixel-to-world coordinate mapping from ENVI spatial metadata,
and explicit runtime packaging for worker and WebAssembly assets. To support
reuse and evaluation, the repository also provides deterministic test fixtures,
public sample validation, benchmark commands, browser smoke tests, packaging
checks, and release-gating reports anchored to a reproducible Node 22
toolchain. CubeScope is intentionally scoped as an embeddable viewer kernel
rather than a full analysis platform, allowing downstream web applications to
integrate hyperspectral browsing without adopting a heavyweight backend stack.
This paper describes the software architecture, implementation choices,
reproducibility strategy, and current alpha capability boundary, and it
positions CubeScope as a foundation for later multispectral, geospatial, and
analysis-oriented extensions.

## Keywords

`hyperspectral`; `ENVI`; `visualization`; `WebGPU`; `WebAssembly`;
`remote-sensing`; `scientific-software`

## 1. Introduction

Hyperspectral data workflows remain dominated by heavyweight desktop tools,
notebook-centered scripting stacks, or server-oriented geospatial systems.
These environments are powerful, but they can be awkward when the immediate need
is lightweight inspection, sharing, browser review, or integration into a
custom scientific web interface. In practice, many teams can already process
hyperspectral data offline, yet still lack a reusable browser-side viewer that
can be embedded into downstream applications without rebuilding the entire data,
metadata, and rendering path.

Modern browser capabilities make a different software path realistic. With
WebAssembly, Web Workers, and hardware-accelerated graphics, browsers can now
support more serious scientific interaction than earlier web image viewers
allowed. For hyperspectral data, however, useful interaction is not just a
matter of drawing pixels. It also depends on parsing ENVI metadata correctly,
preserving interleave and data-type semantics, supporting spectrum-oriented
inspection, and keeping interaction latency low enough to be practical.

CubeScope addresses this gap as a viewer kernel rather than as a complete
analysis platform. The current software contribution is intentionally narrow:
browser-native, local-first ENVI viewing with an embeddable SDK boundary,
validated rendering paths, and repository-visible reproducibility evidence. This
scope is deliberate. It provides a reusable software artifact now, while leaving
room for later multispectral, geospatial, and analysis-oriented extensions.

## 2. Software Description and Scope

CubeScope is distributed as a browser SDK package, `@cubescope/web`, whose main
public class is `CubeViewer`. The primary loading contract is `load(source)`,
where `source` currently supports two ENVI-centered workflows:

1. `envi-local` for paired local files
2. `envi-http` for remote ENVI data served with browser-visible `CORS` and
   `HTTP range`

Within this scope, the current alpha supports pseudo-RGB viewing, band
switching, normalized header access through `CubeHeader`, spectral probing, and
pixel/world coordinate mapping when ENVI spatial metadata is present. The public
API also exposes explicit runtime asset integration for the worker bundle and
the WebAssembly parser files, which is important when downstream bundlers
rewrite resource URLs.

The scope of the present paper is intentionally smaller than a full
remote-sensing workbench. CubeScope is not yet a general GIS engine, a
multi-format ecosystem, or a broad scientific analysis suite. Its current
spatial capability stops at metadata normalization and affine mapping, and the
renderer remains in source pixel space rather than performing full reprojection.
This boundary helps the paper make a clear software contribution: a reproducible
viewer kernel for ENVI hyperspectral cubes in the browser.

## 3. Architecture and Implementation

CubeScope is organized as a layered browser software stack. At the public edge,
the SDK exposes a compact class-based API. Beneath that layer, a viewer runtime
coordinates loading, events, worker activity, and rendering, but it does not
own format-specific parsing logic. Data access and format handling sit below the
runtime and translate raw source bytes into normalized cube metadata and
cube-oriented read operations. Rendering then consumes prepared raster and view
state rather than direct source-format details. Around this runtime sits a
release-validation layer containing fixtures, smoke tests, benchmark reports,
browser-matrix reports, packaging checks, and alpha summary output.

The main architectural seams are `DataSource`, `FormatAdapter`, `CubeStore`,
`Renderer`, and the runtime orchestration shell. `DataSource` is responsible for
byte access only, currently through local file/blob reads and an HTTP-range
remote path. `FormatAdapter` interprets source bytes according to ENVI format
rules and supports metadata parsing plus tile and spectrum extraction.
`CubeStore` acts as the read model used by upper layers, exposing normalized
metadata and cube-oriented services such as tile reads, spectrum reads, and
pixel/world mapping. `Renderer` consumes prepared raster layers and view state,
remaining separate from source parsing and format semantics.

The implementation combines Rust/WebAssembly, Web Workers, and browser GPU
rendering in a practical way. ENVI parsing is anchored in a Rust/WebAssembly
component that serves as the authoritative parser layer for the current format
support. Background work is routed through Web Workers with explicit message
envelopes and source-aware request tracking, which helps isolate stale work when
sources change. Rendering is WebGPU-first but includes a validated WebGL
compatibility path. In `auto` mode, CubeScope prefers WebGPU but can recover
through WebGL after a device-loss event. The current recovery path also handles
a real browser constraint by recreating the render canvas when a fresh drawing
context is needed to cross from a lost WebGPU state into WebGL.

Spatial support follows a conservative boundary. ENVI `map info` and
`coordinate system string` fields are normalized into
`CubeHeader.spatialReference`, and where possible the software derives an affine
transform that powers `pixelToWorld()` and `worldToPixel()`. This is enough for
coordinate-aware inspection while keeping the renderer in pixel space. The
software does not yet attempt full coordinate reference system conversion or
real-time raster reprojection.

## 4. Reproducibility, Packaging, and Quality Assurance

Reproducibility is treated as part of the software contribution. CubeScope uses
Node `22.x` as the official release and reproducibility baseline, while still
allowing newer Node versions for local development. In the current validated
local environment, the repository was checked under Node `v22.22.2`, npm
`10.9.7`, and a Rust toolchain with the `wasm32-unknown-unknown` target plus
`wasm-bindgen-cli 0.2.100`.

The validation path is command-oriented and repository visible. A reproducible
local run starts with dependency installation and deterministic fixture
generation, then proceeds through Rust/WASM rebuilding, browser-SDK building,
contract tests, browser smoke tests, browser-matrix reporting, benchmark
collection, sample validation, package-consumer verification, and alpha summary
reporting. These steps produce machine-readable artifacts under `output/`,
including benchmark results, browser-matrix results, sample validation reports,
pack-consumer verification, and a consolidated alpha status snapshot.

CubeScope also uses a dual-sample strategy. First, the repository ships a small,
deterministic synthetic ENVI fixture for repeatable smoke tests and benchmarks.
Second, it ships one validated public remote ENVI sample,
`snowex-aviris-ng-sasp`, which is exercised through the browser-facing
`envi-http` workflow. The project includes a qualification and promotion
workflow for remote samples so that public-sample claims are backed by both
transport checks and actual browser validation.

Packaging checks reinforce the embeddability story. An isolated consumer
verification step confirms that the packaged tarball exports the expected public
surface and includes the required runtime assets, including the ES module build,
worker bundle, WebAssembly parser files, fixture payloads, sample catalog, and
citation metadata.

## 5. Illustrative Usage

The simplest CubeScope workflow is local ENVI loading. A downstream application
creates a `CubeViewer`, initializes it, and calls
`load({ kind: 'envi-local', ... })` with the header and data files. Once
loaded, the viewer can expose normalized metadata, render a pseudo-RGB view,
allow band switching, and return a spectral profile for pixel inspection.

The second workflow is remote ENVI viewing through `HTTP range`. Here the same
viewer contract is preserved, but the source is described by `headerUrl` and
`dataUrl` rather than local file handles. This path requires browser-visible
`CORS` and `HTTP range`, but it lets a web application interact with ENVI data
without eagerly downloading the entire data object before viewing begins.

The third workflow is SDK embedding. CubeScope is not only a demo page; it is a
package intended to be mounted inside another web application. When a bundler
rewrites static resource paths, the host application can provide explicit URLs
for the worker and WebAssembly assets. This is one of the main reasons to
describe CubeScope as a viewer kernel rather than as a standalone application.

## 6. Early Evaluation

The current evaluation is a software-release check rather than a full systems
benchmark study. The aim is to show that browser-native hyperspectral
interaction is practical and reproducible, not yet to claim broad performance
superiority over desktop or server alternatives. The benchmark reports were
generated in a macOS environment using Node `v22.22.2`, Chromium
`147.0.7727.15`, and the deterministic ENVI fixture with dimensions
`48 x 48 x 32`.

The benchmark harness currently records three early metrics: header parse time,
time to initial view, and band-switch time. In the local-file scenario, the
measured values are approximately `12.5 ms`, `23.2 ms`, and `7.6 ms`,
respectively. In the same-origin remote scenario using `HTTP range`, the values
are approximately `10.4 ms`, `36.7 ms`, and `31.1 ms`. These numbers are
reported as direct outputs from the repository validation path, not as polished
comparative benchmarks.

The browser-matrix report adds evidence for renderer behavior. In the current
local Chromium validation, both a forced `webgl` scenario and an `auto`
scenario passed. In the `auto` scenario, the recorded renderer status showed an
observed transition from `webgpu` to `webgl` after a device-loss event, with
the session completing in a recovered state. This does not yet constitute a
broad hardware or browser comparison, but it does show that the compatibility
path is exercised through an actual browser workflow.

## 7. Impact and Limitations

CubeScope lowers the barrier to browser-based hyperspectral viewing. Users and
teams do not need to adopt a heavyweight remote backend or a full desktop
analysis environment simply to inspect ENVI data in a browser. This makes the
software relevant for exploratory work, review interfaces, annotation tools,
quality-control utilities, and educational applications.

The project also has clear reuse value. Because CubeScope is packaged as a
viewer kernel with explicit runtime assets and an embeddable public API, it can
serve as infrastructure for downstream scientific web applications rather than
only as a repository-specific demo. The current release also establishes a
stable architectural base for later work on multispectral support, richer
spatial overlays, additional source formats, and lightweight analysis plugins.

Several limitations should be stated clearly. The software is ENVI-first rather
than broadly multi-format. The primary artifact is a browser SDK, so teams
working only in Python or desktop environments still need an integration layer.
The remote workflow depends on compatible `CORS` and `HTTP range` behavior at
the serving endpoint. The benchmark scope is intentionally narrow and should not
be confused with a full comparative systems study. Finally, the current alpha
is not yet a complete scientific analysis environment.

## 8. Conclusion

CubeScope shows that browser-native hyperspectral viewing can already be
packaged as serious research software without waiting for a full analysis
platform. The current alpha release provides a reproducible, embeddable ENVI
viewer kernel built around a Rust/WebAssembly parser, worker-oriented runtime
execution, and hardware-accelerated browser rendering with a validated fallback
path. Just as importantly, it pairs that runtime with fixtures, public-sample
validation, packaging checks, benchmark commands, and release-gating reports
that improve inspection, reuse, and citation potential.

Within its current scope, CubeScope already contributes a meaningful software
base for downstream web applications that need hyperspectral viewing without a
heavy backend stack. Near-term work should widen capability carefully through
multispectral support, richer spatial overlays, additional source adapters, and
later analysis-oriented extensions.

## Acknowledgements

`[To be completed]`

## Funding

`[To be completed. If none: This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.]`

## CRediT Author Statement

`[To be completed]`

## Declaration of Competing Interest

The authors declare that they have no known competing financial interests or
personal relationships that could have appeared to influence the work reported
in this paper. `[Revise if needed before submission.]`

## Declaration of Generative AI and AI-assisted Technologies in the Manuscript Preparation Process

`[To be completed according to final author decision and journal policy before submission.]`

## Software Availability

Repository: `[Public repository URL to be inserted before submission]`

Version: `0.1.0-alpha.1` or later tagged release to be archived for submission

License: `MIT`

## References

`[To be completed]`
