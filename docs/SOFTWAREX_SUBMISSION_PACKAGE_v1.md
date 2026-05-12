# SoftwareX Submission Package v1

This document turns the current manuscript draft into a SoftwareX-oriented
submission package plan.

Checked against the official SoftwareX guide on `2026-04-23` and rechecked on
`2026-05-12`:

- Guide for authors:
  [https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors](https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors)
- Journal overview:
  [https://www.sciencedirect.com/journal/softwarex](https://www.sciencedirect.com/journal/softwarex)

## Current Fit Assessment

CubeScope is a strong thematic fit for SoftwareX because the project is:

- research software rather than a pure methods paper
- reusable beyond one narrow case study
- centered on scientific viewing and interaction tooling
- supported by citation metadata, reproducibility workflows, and an embeddable
  software package

The current project state is now a submission candidate. The remaining work is
the author's final reread and submission-system entry, not missing software
evidence, release infrastructure, contact metadata, or dataset-screenshot
permissions.

## Official Requirements And Recommendations To Respect

As checked on `2026-04-23`, the current official guide indicates that SoftwareX
submissions include:

1. a short descriptive paper with a `3000` word limit
2. an open-source software distribution with support material
3. journal-specific Word or LaTeX templates
4. an abstract not exceeding `250` words
5. `1` to `7` English keywords
6. optional but encouraged article highlights, as `3` to `5` bullet points with
   each bullet capped at `85` characters including spaces
7. optional but encouraged graphical abstract material
8. a title page with corresponding-author details and affiliations
9. a CRediT contribution statement
10. conflict-of-interest and funding disclosures
11. a data statement at submission

The same official guide also clarifies that the `3000`-word limit excludes
title, authors, affiliations, references, and metadata tables, but includes the
abstract, running text, figure captions, and footnotes.

The downloaded official LaTeX template still contains an internal note saying
`4000` words, while the current web guide says `3000` words. For submission
planning, CubeScope should follow the stricter current web-guide value.

The guide also states that accepted SoftwareX software packages are archived in
the journal's GitHub repository. For CubeScope, this means the repository must
be public and well-formed by the time of actual submission.

## Current CubeScope Package Decision

### Target article type

- `Original software publication`

### Recommended title

- `CubeScope: a browser-native, local-first viewer kernel for ENVI hyperspectral datasets`

### Abstract selection

- selected abstract: the main abstract in
  `docs/SOFTWAREX_MANUSCRIPT_v4.md`
- current measured length: about `197` words
- status: within the current SoftwareX `250` word limit

### Keywords

Recommended keyword set:

1. `hyperspectral`
2. `ENVI`
3. `visualization`
4. `WebGPU`
5. `WebAssembly`
6. `remote-sensing`
7. `scientific-software`

### Highlights file

Recommended highlights for submission:

- Browser-native ENVI viewer kernel for hyperspectral interaction
- Rust/WASM parsing with worker-based browser runtime orchestration
- WebGPU-preferred rendering with validated WebGL fallback and recovery
- Reproducible fixtures, packaging, benchmarks, and browser validation

These bullets are also written into a separate draft file:

- `docs/SOFTWAREX_HIGHLIGHTS_v1.txt`

### Graphical abstract concept

Recommended graphical abstract concept:

- left panel: local file and HTTP range source icons
- center panel: `CubeViewer` with worker + WASM + renderer flow
- right panel: pseudo-RGB view, spectral probe, and pixel/world mapping callout
- footer strip: benchmark, browser matrix, package verification

This concept should be rendered later as a clean journal-ready image rather than
submitted as the Mermaid draft figure from the manuscript.

## Manuscript Compression Status

Current word-count snapshot from the repository draft:

- full draft file, including planning and table material: about `5501` words
- main narrative block from Sections `1` through `8`: about `3548` words
- compressed SoftwareX-oriented manuscript:
  `docs/SOFTWAREX_MANUSCRIPT_v1.md`, about `2047` words excluding title-page
  placeholders
- more template-aligned SoftwareX manuscript:
  `docs/SOFTWAREX_MANUSCRIPT_v2.md`, about `1814` words
- more submission-ready SoftwareX manuscript:
  `docs/SOFTWAREX_MANUSCRIPT_v3.md`, about `1770` words
- more template-aware submission package manuscript:
  `docs/SOFTWAREX_MANUSCRIPT_v4.md`, about `2975` words before references
  after final release metadata, DOI, declarations, and local real-ENVI
  validation evidence

Interpretation:

- the current manuscript draft is strong enough in content
- the long draft is not submission-length, but a compressed submission-oriented
  manuscript now exists within the official SoftwareX `3000` word limit
- the `v2` short manuscript is the best current base for template conversion,
  because it already carries title-page placeholders, journal-facing section
  names, and declaration blocks
- the `v3` short manuscript is the best current base for final manuscript
  polishing because it further aligns the section structure with a
  journal-facing software-paper narrative
- the `v4` short manuscript is the best current base for final submission
  preparation because it absorbs additional SoftwareX-facing details such as the
  data statement, fuller title-page placeholders, and more explicit
  software-availability metadata

Current manuscript decision:

1. keep `docs/SOFTWARE_PAPER_DRAFT_v1.md` as the fuller working manuscript
2. keep `docs/SOFTWAREX_MANUSCRIPT_v1.md` as the intermediate compressed draft
3. keep `docs/SOFTWAREX_MANUSCRIPT_v2.md` as the template-aligned intermediate draft
4. keep `docs/SOFTWAREX_MANUSCRIPT_v3.md` as the submission-ready narrative draft
5. use `docs/SOFTWAREX_MANUSCRIPT_v4.md` as the current submission-length base
6. continue polishing the shorter manuscript rather than compressing the long
   draft in place

## Requirement-By-Requirement Readiness Snapshot

The table below follows the `journal-submission-check` workflow and marks each
item as `PASS`, `FAIL`, or `UNCLEAR` against the current repository state.

| Requirement | Status | Current evidence | Action needed |
| --- | --- | --- | --- |
| Short descriptive manuscript within `3000` words | `PASS` | `docs/SOFTWAREX_MANUSCRIPT_v4.md` is the current short-manuscript base and remains below the limit | Keep the short manuscript as the submission base |
| Abstract not exceeding `250` words | `PASS` | Abstract in `docs/SOFTWAREX_MANUSCRIPT_v4.md` is about `197` words | Final copyediting only |
| `1-7` English keywords | `PASS` | Seven keywords are listed in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final wording review only |
| Title page with authors, affiliations, corresponding author | `PASS` | Author name, affiliation, corresponding author, postal address, no-ORCID note, email, and phone are filled in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| CRediT author statement | `PASS` | Single-author CRediT statement is filled in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| Funding statement | `PASS` | No-specific-grant funding statement is filled in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| Conflict-of-interest declaration | `PASS` | No-competing-interests statement exists in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| Generative-AI disclosure | `PASS` | Elsevier-style AI disclosure is filled in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| Data statement | `PASS` | Dedicated data statement is present, external real datasets are not redistributed, and the real-dataset montage has been removed | Final author confirmation only |
| Highlights file | `PASS` | `docs/SOFTWAREX_HIGHLIGHTS_v1.txt` contains four bullets within the character limit | Final editorial polishing only |
| Graphical abstract | `PASS` | Graphical abstract is intentionally omitted for first submission | No action needed |
| Open-source repository and support material | `PASS` | Repository and release are public on GitHub; README, LICENSE, source, and support docs are present | Keep repository public through review |
| Public release/tag suitable for archiving | `PASS` | GitHub release `v0.1.0-alpha.1` is public and archived on Zenodo with DOI `10.5281/zenodo.20131367` | Keep tag immutable unless a new release is intentionally made |
| Journal-specific template formatting | `PASS` | `docs/softwarex-template/cubescope-softwarex-submission-draft.tex` is filled from the official LaTeX template | Build final PDF/source zip after contact metadata is filled |
| Software availability statement | `PASS` | Public repository, release, license, package, and Zenodo DOI are listed in `docs/SOFTWAREX_MANUSCRIPT_v4.md` | Final author confirmation only |
| Reproducibility/support evidence | `PASS` | Repository already contains alpha reports, browser matrix, benchmarks, sample validation, and pack verification outputs | Keep outputs organized and cite them in the final package |

## Required Submission Files

The package we should prepare for actual submission is:

1. manuscript in the official SoftwareX template
2. separate highlights file if we decide to include the recommended highlights
3. graphical abstract file if we decide to include the recommended graphical abstract
4. cover letter
5. conflict-of-interest declaration
6. funding statement
7. CRediT contribution statement
8. public software repository URL
9. tagged release and archived release metadata
10. data statement aligned with the final public repository and release archive

## Current Readiness By Item

### Already in good shape

- manuscript core story
- official SoftwareX Word and LaTeX templates downloaded under
  `docs/softwarex-template/`
- LaTeX submission draft prepared:
  `docs/softwarex-template/cubescope-softwarex-submission-draft.tex`
- submission-length manuscript draft
- more template-aligned submission-length manuscript draft
- more submission-ready submission-length manuscript draft
- more template-aware submission-length manuscript draft
- abstract under the current limit
- architecture figures drafted
- architecture figure generated:
  `docs/figures/softwarex-architecture.png`
- reproducibility evidence tables drafted
- local alpha release gate passed and summarized:
  `docs/SOFTWAREX_RELEASE_GATE_REPORT_v1.md`
- release notes draft prepared:
  `docs/SOFTWAREX_RELEASE_NOTES_0.1.0-alpha.1.md`
- benchmark table drafted
- local real-ENVI validation table drafted
- real-ENVI montage figure removed from the submission manuscript and source
  package to avoid screenshot-permission risk
- citation metadata
- public GitHub repository:
  `https://github.com/yongyin-leon/CubeScope`
- public GitHub release:
  `https://github.com/yongyin-leon/CubeScope/releases/tag/v0.1.0-alpha.1`
- Zenodo DOI:
  `https://doi.org/10.5281/zenodo.20131367`
- claim/evidence audit drafted:
  `docs/SOFTWAREX_CLAIM_EVIDENCE_AUDIT_v1.md`
- reference and dataset-provenance working notes drafted:
  `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md`
- license
- public-sample validation evidence
- Node 22 reproducibility baseline
- pack-consumer embedding evidence

### Still needs work before submission

- final author reread of the generated PDF
- enter matching author/contact details in the submission system
- add external CI evidence if we want the release package to look fully closed

## Suggested Final Submission Sequence

1. compress `docs/SOFTWARE_PAPER_DRAFT_v1.md` to a SoftwareX-length manuscript
   [completed through `docs/SOFTWAREX_MANUSCRIPT_v1.md`]
2. reshape the short manuscript into a more template-aligned structure
   [completed through `docs/SOFTWAREX_MANUSCRIPT_v2.md`]
3. polish the short manuscript into a more submission-ready journal narrative
   [completed through `docs/SOFTWAREX_MANUSCRIPT_v3.md`]
4. absorb additional guide-facing details such as the data statement and fuller title-page placeholders
   [completed through `docs/SOFTWAREX_MANUSCRIPT_v4.md`]
5. verify and insert the final citation/provenance set
   [completed for the first-submission package; real-dataset montage removed]
6. convert `docs/SOFTWAREX_MANUSCRIPT_v4.md` into the official journal template
   [completed through `docs/softwarex-template/cubescope-softwarex-submission-draft.tex`]
7. finalize highlights and decide whether to submit a graphical abstract
   [highlights completed; graphical abstract skipped for first submission]
8. finalize cover letter and declarations
   [completed]
9. publish the repository and release tag
   [completed with public GitHub release and Zenodo DOI]
10. assemble the PDF/source zip and submit with the public repository URL

## Supporting Working Files

The most useful repository-side working files for actual submission preparation
are now:

- `docs/SOFTWAREX_MANUSCRIPT_v4.md` as the current short-manuscript base
- `docs/softwarex-template/softwarex-osp-template.tex` and
  `docs/softwarex-template/softwarex-osp-template.docx` as downloaded official templates
- `docs/softwarex-template/cubescope-softwarex-submission-draft.tex` as the current LaTeX template draft
- `docs/SOFTWAREX_CLAIM_EVIDENCE_AUDIT_v1.md` as the claim/evidence and missing-citation audit
- `docs/SOFTWAREX_REFERENCE_PROVENANCE_v1.md` as the reference and dataset-provenance working file
- `docs/figures/softwarex-architecture.png` as the current architecture figure draft
- `docs/figures/softwarex-real-envi-initial-views.png` as an internal draft
  artifact only; it is excluded from the first-submission manuscript package
- `scripts/build-softwarex-architecture-figure.mjs` as the architecture figure-generation script
- `scripts/build-softwarex-real-envi-montage.mjs` as the reproducible figure-generation script
- `docs/SOFTWAREX_TEMPLATE_INPUT_PACKET_v1.md` as the template-fill packet
- `docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md` as the current cover-letter base
- `docs/SOFTWAREX_SUBMISSION_FILL_IN_CHECKLIST_v1.md` as the final fill-in list
- `docs/SOFTWAREX_RELEASE_GATE_REPORT_v1.md` as the latest local release-gate summary
- `docs/SOFTWAREX_RELEASE_NOTES_0.1.0-alpha.1.md` as the release notes draft
- `npm run package:softwarex-submission` as the local assembly command for the
  manuscript PDF, LaTeX source zip, highlights, and cover-letter draft

## Honest Submission Posture

The strongest honest pitch for CubeScope is:

- not "the complete hyperspectral analysis platform"
- not "the fastest viewer in all conditions"
- but "a reusable browser-native ENVI viewer kernel with real reproducibility
  evidence and a clear extension path"

That is already enough to be credible for SoftwareX, and it is a better basis
for review than trying to overclaim maturity the software does not yet need to
pretend to have.
