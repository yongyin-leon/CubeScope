# SoftwareX Claim Evidence Audit v1

Audit date: `2026-04-24`

Target manuscript: `docs/SOFTWAREX_MANUSCRIPT_v4.md`

Purpose: reduce submission risk by separating claims that are already supported
by repository evidence from claims that still require citations, author
metadata, or policy decisions.

## Evidence Base Inspected

Repository and manuscript evidence:

- `docs/SOFTWAREX_MANUSCRIPT_v4.md`
- `README.md`
- `CITATION.cff`
- `package.json`
- `docs/REPRODUCIBILITY.md`
- `docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md`
- `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md`
- `output/alpha/local-alpha-summary.json`
- `output/benchmark/latest.json`
- `output/browser-matrix/latest.json`
- `output/toolchain/local-toolchain.json`
- `output/pack-consumer/latest.json`
- `output/samples/public-latest.json`
- `output/softwarex-real-data-cases/real-envi-cases.md`
- `output/softwarex-real-data-cases/real-envi-cases.json`

Journal requirements checked against the official SoftwareX guide for authors:

- short descriptive paper with a `3000` word limit
- open-source software distribution with support material
- official SoftwareX template requirement
- abstract limit of `250` words
- `1` to `7` English keywords
- highlights encouraged, `3` to `5` bullets, each up to `85` characters
- graphical abstract encouraged
- tables as editable text
- separate figure files with captions
- maximum six figures
- required submission declarations and data statement

## Risk Summary

The manuscript is now close to a credible SoftwareX submission base. The
software-functionality claims are mostly supported by repository-visible code,
tests, and generated validation outputs. The remaining risks are concentrated
in four areas:

1. Background and gap claims need final external literature citations; several
   candidate sources are now collected in
   `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md`.
2. Dataset provenance and permission language must be verified before final
   submission.
3. Author, funding, CRediT, AI disclosure, release URL, and DOI placeholders
   remain unresolved.
4. The current validation evidence is strong for local release-readiness, but
   should not be reframed as broad cross-hardware or comparative performance.

## Claim-By-Claim Audit

| Manuscript claim | Type | Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| CubeScope is a browser-native viewer kernel for ENVI hyperspectral datasets. | methodological | `SUPPORTED` | `package.json`, `README.md`, `src/cube-viewer.js`, ENVI format/runtime modules | Keep. |
| CubeScope provides local-first, embeddable interaction with multi-band cubes in modern browsers. | methodological | `SUPPORTED` | `envi-local` source path, `CubeViewer` public API, browser demo and smoke tests | Keep, but avoid implying offline geospatial analysis beyond viewing. |
| There is a gap between heavyweight desktop/server remote-sensing environments and lightweight web image viewers for ENVI cube inspection. | interpretive | `WEAKLY SUPPORTED` | Plausible and central, but currently not tied to literature | Add 2-4 citations on common hyperspectral tooling and web visualization gaps. |
| Hyperspectral workflows are dominated by desktop applications, notebook scripts, or server-oriented systems. | empirical/contextual | `NEEDS CITATION` | No citation in v4 | Add citations for ENVI/QGIS/ArcGIS-style desktop workflows, Python notebook workflows, and server/geospatial platforms. |
| HSIToolbox targets server-side classification workflows and CubeScope targets a lower viewer-kernel layer. | comparative | `NEEDS CITATION` | v4 names HSIToolbox but has no reference | Add HSIToolbox citation and verify the wording against its paper/repository. |
| The alpha supports local ENVI loading, HTTP range-backed remote ENVI access, metadata access, spectral probing, affine pixel/world mapping, and explicit runtime packaging. | methodological | `SUPPORTED` | `src/sources`, `src/spatial`, `src/runtime`, `tests`, `output/alpha/local-alpha-summary.json` | Keep. |
| Initial display band selection uses ENVI default bands, wavelength metadata, or a safe fallback. | methodological | `SUPPORTED` | `src/runtime/band-selection.js`, `tests/unit/band-selection.test.js` | Keep. |
| Rendering is WebGPU-first with a verified WebGL compatibility fallback. | methodological/validation | `SUPPORTED` | `output/browser-matrix/latest.json` shows `webgl` pass and `auto` recovery from WebGPU to WebGL | Keep, but phrase as local Chromium verification, not universal browser coverage. |
| Node 22, npm 10.9.7, Rust/WASM target, and wasm-bindgen 0.2.100 are the validated local toolchain. | empirical | `SUPPORTED` | `output/toolchain/local-toolchain.json`, `output/alpha/local-alpha-summary.json` | Keep. |
| Benchmark values for deterministic fixture are local validation outputs, not polished comparative benchmarks. | empirical/limitation | `SUPPORTED` | `output/benchmark/latest.json`; limitation language already present | Keep. This wording is appropriately conservative. |
| Browser matrix passed forced WebGL and auto fallback scenarios in Chromium 147. | empirical | `SUPPORTED` | `output/browser-matrix/latest.json` | Keep. Avoid expanding to Safari/Firefox or hardware-wide claims. |
| Six real ENVI datasets from `17.6 MB` to `381.1 MB` reached initial rendered view in all five runs. | empirical | `SUPPORTED` | `output/softwarex-real-data-cases/real-envi-cases.json` and `.md` | Keep. Add dataset citations/licensing notes before submission. |
| Pika and WHU-Hi demonstrate wavelength-aware initial band selection. | empirical/methodological | `SUPPORTED` | `real-envi-cases.json` records `wavelengthUnits` and selected bands `180/121/61`, `113/68/32` | Keep. |
| The real-data validation cases are representative agricultural, urban, wetland, airborne, and UAV scenes. | interpretive | `WEAKLY SUPPORTED` | Dataset titles/notes support this loosely; no citations yet | Use "selected" rather than "representative" in manuscript; already adjusted. Add dataset citations. |
| CubeScope lowers the barrier to browser-based hyperspectral viewing. | interpretive | `WEAKLY SUPPORTED` | Supported by architecture and API, but the comparative baseline is not quantified | Keep as impact framing; avoid stronger phrases such as "significantly lowers" unless user evidence is added. |
| CubeScope can serve as infrastructure for downstream scientific web applications. | interpretive/methodological | `SUPPORTED` | Public package API, pack-consumer verification, runtime asset packaging | Keep. |
| The current alpha is not a full analysis platform or full comparative systems benchmark. | limitation | `SUPPORTED` | Consistent with code scope and docs | Keep. This is review-protective. |
| Local real datasets are not redistributed and are excluded from Git. | empirical/policy | `SUPPORTED` | `.gitignore`, `git ls-files -- 'test-data/高光谱数据集'` returned empty, `output/` ignored | Keep. Must still add dataset licensing/provenance text. |
| Software is citable through CITATION metadata and a future release/tag. | repository/release | `WEAKLY SUPPORTED` | `CITATION.cff` exists; public release/tag is not finalized | Keep as future-facing only after public release URL/DOI exists. |

## Recommended Manuscript Edits Before Template Conversion

These are small, low-risk edits that should happen before the official template
conversion:

1. Add `[CITATION NEEDED]` targets or real citations for the motivation
   paragraph on dominant hyperspectral workflows.
2. Add a citation for HSIToolbox or remove the named comparison if citation
   support is not ready.
3. Add dataset citations/provenance for all six real ENVI validation cases.
4. Keep all performance statements tied to local Chromium, declared hardware,
   and repeated-run evidence.
5. Keep "selected real ENVI cases" wording, not "representative benchmark
   suite".
6. Add a short sentence in the table note or data statement that screenshots
   are manuscript evidence generated from local datasets and that the source
   data are not redistributed.

## Required External Citations Or Provenance Entries

Minimum citation/provenance targets:

| Item | Why needed | Current status |
| --- | --- | --- |
| ENVI format / ENVI software or format documentation | Supports format-specific context | `CANDIDATE` via NV5 ENVI documentation in `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md` |
| Hyperspectral desktop/workbench ecosystem | Supports motivation and gap framing | `PARTIAL`; general HSI review candidates exist, but workflow/tooling-specific support may still be needed |
| Python/notebook hyperspectral tooling or common libraries | Supports workflow-context claim | `MISSING` |
| Web-based geospatial or image visualization systems | Supports "web image viewer" comparison | `MISSING` |
| HSIToolbox | Supports named adjacent-system comparison | `CANDIDATE` via Dhaene et al. 2023 in `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md` |
| Indian Pines dataset source | Supports Table 1 and screenshot evidence | `CANDIDATE`; verify final license/permission |
| Pavia University dataset source | Supports Table 1 and screenshot evidence | `CANDIDATE`; verify final license/permission |
| Pavia Centre dataset source | Supports Table 1 and screenshot evidence | `CANDIDATE`; verify final license/permission |
| Kennedy Space Center dataset source | Supports Table 1 and screenshot evidence | `CANDIDATE`; verify final license/permission |
| Pika IR-L Hyalite Creek dataset source/license | Supports Table 1 and graphical/screenshot use | `PARTIAL`; exact sample-data source/license still needed |
| WHU-Hi LongKou dataset source/license | Supports Table 1 and graphical/screenshot use | `CANDIDATE`; verify final dataset license/permission |
| SnowEx AVIRIS-NG SASP public sample source | Supports public remote sample claim | `PARTIAL` via `output/samples/public-latest.json`, needs formal citation/provenance |

`CANDIDATE` means the source has been collected for final author review, not
that the citation or dataset-license language is already submission-final.

## Submission Readiness Checklist

| Area | Status | Next action |
| --- | --- | --- |
| Manuscript length | `PASS` | Keep v4 as the base; avoid major expansion. |
| Abstract length | `PASS` | Final copyedit only. |
| Keywords | `PASS` | Keep seven keywords unless target editor suggests trimming. |
| Claims and evidence | `PARTIAL` | Resolve missing citations listed above. |
| Real-data screenshots | `PARTIAL` | Use generated screenshots only after dataset permission/provenance is checked. |
| Figure plan | `PARTIAL` | Real-ENVI montage figure is generated; architecture figure and optional graphical abstract remain open. |
| Graphical abstract | `OPEN` | Decide whether to include; SoftwareX encourages it. |
| Highlights | `PASS` | Current four bullets are within the stated character limit; final polish only. |
| Author metadata | `FAIL` | Fill authors, affiliations, ORCIDs, corresponding author details. |
| CRediT | `FAIL` | Fill real contribution roles. |
| Funding | `UNCLEAR` | Confirm funding or use no-funding statement. |
| Competing interest | `PARTIAL` | Draft exists; author confirmation required. |
| Generative AI disclosure | `UNCLEAR` | Decide final disclosure wording. |
| Software repository URL | `FAIL` | Public URL exists in metadata but repository visibility/release timing must be finalized. |
| Release/tag/DOI | `FAIL` | Create public release and archive metadata when ready. |
| Official template | `FAIL` | Convert v4 into the SoftwareX Word or LaTeX template. |
| Full release verification | `PARTIAL` | Rerun `npm run verify:alpha` after final code/doc changes. |

## Suggested Next Work Order

1. Build the missing citation/provenance set.
2. Insert citations into `docs/SOFTWAREX_MANUSCRIPT_v4.md`.
3. Create `Figure_1` architecture and `Figure_2` real ENVI montage.
4. Decide on graphical abstract and produce it if included.
5. Fill author/declaration placeholders.
6. Convert the manuscript to the official SoftwareX template.
7. Rerun the full release gate and freeze a public release candidate.

## Exact Small Wording Constraints To Preserve

Preserve these protective phrases through final editing:

- "software-release check rather than a full systems benchmark study"
- "direct validation outputs, not as polished comparative benchmarks"
- "not as a hardware-independent performance claim"
- "selected agricultural, urban, wetland, airborne, and UAV hyperspectral scenes"
- "not redistributed with the repository"
- "not yet a complete scientific analysis environment"
