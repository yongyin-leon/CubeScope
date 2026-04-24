# SoftwareX Template Working Files

This directory contains the official SoftwareX original software publication
templates downloaded from the SoftwareX Guide for Authors on `2026-04-24`,
plus the current CubeScope LaTeX submission draft.

Official template files:

- `softwarex-osp-template.tex`
- `softwarex-osp-template.docx`

CubeScope draft:

- `cubescope-softwarex-submission-draft.tex`

Build check:

```sh
npm run build:softwarex-pdf
```

Run the command from the repository root. The last successful build produced:

- `/tmp/cubescope-softwarex-tex/cubescope-softwarex-submission-draft.pdf`

Notes:

- The current SoftwareX web guide states a `3000` word limit, while the
  downloaded LaTeX template still contains an internal `4000` word note. Follow
  the stricter current web-guide limit unless the journal confirms otherwise.
- The draft still contains author-controlled placeholders for author metadata,
  support email, release/tag, DOI, funding, CRediT roles, AI disclosure, and
  final data-permission wording.
