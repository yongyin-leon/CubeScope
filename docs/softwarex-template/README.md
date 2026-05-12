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
- To assemble upload-ready local artifacts, run:

  ```sh
  npm run package:softwarex-submission
  ```

  This writes the manuscript PDF, LaTeX source zip, highlights, cover letter
  draft, and a local upload manifest under `output/softwarex-submission/`.
- The draft includes corresponding-author email/phone, support email, release
  tag, public repository URL, Zenodo DOI, funding statement, CRediT statement,
  and AI disclosure. The real-dataset montage is intentionally excluded from
  the LaTeX source package for first submission.
