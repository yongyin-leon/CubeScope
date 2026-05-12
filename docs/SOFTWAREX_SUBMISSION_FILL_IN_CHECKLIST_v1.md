# SoftwareX Submission Fill-In Checklist v1

This checklist is the shortest path from the current manuscript drafts to a
real submission package. It is intentionally practical and should be completed
before final upload.

Official guide checked on `2026-04-23` and rechecked on `2026-05-12`:

- Guide for authors:
  [https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors](https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors)
- Journal overview:
  [https://www.sciencedirect.com/journal/softwarex](https://www.sciencedirect.com/journal/softwarex)

## 1. Manuscript base decision

- [x] Final short manuscript base confirmed as `docs/SOFTWAREX_MANUSCRIPT_v4.md`
- [x] Official journal template format chosen: `LaTeX`
- [x] Official SoftwareX templates reviewed under `docs/softwarex-template/`
- [x] LaTeX draft reviewed if using `docs/softwarex-template/cubescope-softwarex-submission-draft.tex`
- [x] Final title confirmed
- [x] Short title confirmed
- [x] Abstract final copyedited
- [x] Keyword list final checked

## 2. Author and title-page metadata

- [x] Final author order confirmed
- [x] All author names match the submission system spelling
- [x] Full affiliation addresses prepared
- [x] Country names included in affiliations
- [x] Corresponding author confirmed
- [x] Corresponding author email confirmed
- [x] Corresponding author postal address confirmed
- [x] Corresponding author phone number confirmed
- [x] ORCID identifiers collected if to be included: not provided
- [x] Present/permanent address notes added only if needed: none

## 3. Authorship and declarations

- [x] CRediT roles assigned for every author
- [x] Funding statement finalized
- [x] Conflict-of-interest statement finalized
- [ ] Elsevier declarations tool completed for all authors if required by the submission system
- [x] Generative-AI disclosure decision made
- [x] If AI disclosure is needed, final statement inserted
- [x] AI disclosure section retained because AI assistance was used for code review, release preparation, and manuscript editing

## 4. Data and software availability

- [x] Final public GitHub repository URL prepared
- [x] Public release/tag selected for submission
- [x] Release notes prepared
- [x] Local `npm run verify:alpha` gate passed
- [x] Data statement aligned with the public repository and release archive
- [x] Software availability section updated with repository URL
- [x] Software availability section updated with release identifier
- [x] Permanent identifier added if a DOI or archival record is available
- [x] Local real-ENVI montage removed; screenshot reuse permission is no longer needed for the submission package

## 5. Repository readiness

- [x] Repository is public
- [x] `README.md` is final enough for public inspection
- [x] `LICENSE` is final and visible
- [x] Citation metadata is present and correct
- [x] Public release/tag created
- [x] Source tree remains clear and reviewable
- [ ] If desired, external CI status is visible for extra release confidence

## 6. Optional but recommended extras

- [x] Highlights retained for submission
- [x] Highlights file copyedited one final time
- [x] Real-ENVI montage figure removed from manuscript and LaTeX source package
- [x] Decision made on graphical abstract: skip for first submission to avoid extra rights/formatting work
- [x] If yes, graphical abstract image exported in a journal-acceptable format (not applicable)

## 7. Final file set

- [x] Official-template manuscript
- [x] Completed metadata tables from the official template
- [x] Manuscript figure files included: `docs/figures/softwarex-architecture.png`
- [x] Highlights file, if included
- [x] Graphical abstract, if included (not included)
- [x] Cover letter
- [x] Final repository URL
- [x] Final release/tag identifier

## 8. Submission-system sanity check

- [x] Word-count sanity check completed against the official counting rule
- [x] Figures embedded correctly in the LaTeX submission package
- [x] References reviewed for software/release citations
- [x] Acknowledgements section remains directly before the reference list
- [x] All targeted placeholders removed
- [ ] Submission package reread once end-to-end before upload
