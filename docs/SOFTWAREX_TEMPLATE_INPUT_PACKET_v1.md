# SoftwareX Template Input Packet v1

This document is a template-conversion aid for the official `SoftwareX`
submission template. It does not replace the journal template. Instead, it
collects the content that should be pasted into the official Word or LaTeX
template, plus the final blanks that still need author input.

Primary source checked on `2026-04-23`:

- Guide for authors:
  [https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors](https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors)

Important guide points used here:

- manuscripts must use the official SoftwareX template
- the maximum word count is `3000`, excluding title, authors, affiliations,
  references, and metadata tables, but including abstract, running text,
  captions, and footnotes
- the repository should be public on GitHub at submission time
- a data statement is required at submission

## 1. Preferred manuscript base

- Current base manuscript: `docs/SOFTWAREX_MANUSCRIPT_v4.md`
- Current approximate word count before references: `2805`
- Article type: `Original software publication`

## 2. Title-page fields to paste into the template

### Full title

`CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets`

### Short title

`CubeScope browser-native ENVI viewer kernel`

### Author list

`Yongyin Leon Li`

### Affiliations

`[To be completed with full postal addresses and country names]`

### ORCID identifiers

`[To be completed if included]`

### Corresponding author

`[To be completed]`

### Corresponding author email

`[To be completed]`

### Corresponding author postal address

`[To be completed]`

### Corresponding author phone number

`[To be completed]`

### Present/permanent address notes

`[Add only if needed]`

## 3. Abstract and keywords

### Abstract

CubeScope is a browser-native viewer kernel for ENVI hyperspectral datasets.
The software targets a gap between heavyweight desktop or server-centered
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
toolchain. Additional local validation on six real ENVI datasets, ranging from
`17.6 MB` to `381.1 MB`, produced successful initial views in all repeated
browser-load trials, with five runs per dataset. CubeScope is intentionally
scoped as an embeddable viewer kernel rather than a full analysis platform,
allowing downstream web applications to integrate hyperspectral browsing
without adopting a heavyweight backend stack.

### Keywords

`hyperspectral`; `ENVI`; `visualization`; `WebGPU`; `WebAssembly`;
`remote-sensing`; `scientific-software`

## 4. Manuscript body source

Use `docs/SOFTWAREX_MANUSCRIPT_v4.md` as the manuscript body source for the
official template. It already contains:

- Motivation and significance
- Software description
- Illustrative examples
- Early evaluation
- Local real-ENVI validation table and montage figure
- Impact and limitations
- Conclusions
- Data statement
- Software availability
- Funding placeholder
- CRediT placeholder
- Conflict-of-interest statement
- Generative-AI disclosure placeholder
- Acknowledgements placeholder
- Candidate references

## 5. Manuscript figure assets

### Architecture figure

Current figure file:

- `docs/figures/softwarex-architecture.png`

Source figure file:

- `docs/figures/softwarex-architecture.svg`

Generation script:

- `scripts/build-softwarex-architecture-figure.mjs`

Suggested caption:

`CubeScope architecture. Local and HTTP-range ENVI sources are reduced to byte
access, interpreted through the Rust/WebAssembly ENVI parser, exposed through
normalized cube services, orchestrated by the viewer runtime and worker layer,
and rendered through WebGPU or WebGL behind the public CubeViewer API.`

### Real ENVI montage

Current figure file:

- `docs/figures/softwarex-real-envi-initial-views.png`

Generation script:

- `scripts/build-softwarex-real-envi-montage.mjs`

Suggested caption:

`Real ENVI initial views rendered by CubeScope for six local validation cases.
The panels are generated from browser screenshots of the example application.
Source datasets are used only for manuscript-side validation and are not
redistributed with the software package.`

## 6. Repository and release metadata to finalize

### Public GitHub repository URL

`https://github.com/yongyin-leon/CubeScope`

### Release/tag for the manuscript

`0.1.0-alpha.1`

### License

`MIT`

### Primary package

`@cubescope/web`

### Permanent identifier

`[DOI or release landing page if available]`

## 7. Data statement

No new experimental datasets were generated for this software paper. The
repository includes deterministic validation fixtures, benchmark outputs,
browser-matrix reports, sample-validation reports, and packaging-verification
artifacts as part of the software release and reproducibility workflow. Local
real ENVI datasets were used to prepare illustrative screenshots and timing
summaries for the manuscript, but those source data files are excluded from Git
and are not redistributed with the software package. If additional
submission-system wording is required, this section should be aligned with the
final public repository, release archive, and the licensing terms of any
externally obtained datasets.

## 8. Declarations and policy-sensitive text

### Funding

`[To be completed. If none: This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors.]`

### CRediT author statement

`[To be completed using CRediT roles such as Conceptualization, Software, Validation, Visualization, Writing - original draft, Writing - review and editing, etc.]`

### Declaration of competing interest

The authors declare that they have no known competing financial interests or
personal relationships that could have appeared to influence the work reported
in this paper.

### Declaration of generative AI and AI-assisted technologies in the manuscript preparation process

`[Include only if needed. Suggested pattern: During the preparation of this work the author(s) used [NAME OF TOOL / SERVICE] in order to [REASON]. After using this tool/service, the author(s) reviewed and edited the content as needed and take(s) full responsibility for the content of the published article.]`

## 9. Optional submission extras

### Highlights

Current draft file:

- `docs/SOFTWAREX_HIGHLIGHTS_v1.txt`

Current bullets:

- Browser-native ENVI viewer kernel for hyperspectral interaction
- Rust/WASM parsing with worker-based browser runtime orchestration
- WebGPU-preferred rendering with validated WebGL fallback and recovery
- Reproducible fixtures, packaging, benchmarks, and browser validation

### Graphical abstract

Current status:

- recommended but not yet produced
- current concept documented in `docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md`

## 10. Final blanks that still need real author input

- final author order
- all affiliation details
- corresponding author contact details
- funding decision
- CRediT roles
- AI-disclosure decision
- public repository URL
- public release/tag
- permanent identifier if one is created
