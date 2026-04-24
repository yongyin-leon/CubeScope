# SoftwareX Reference And Dataset Provenance Notes v1

Prepared on: `2026-04-24`

Purpose: collect candidate references and provenance notes needed to turn
`docs/SOFTWAREX_MANUSCRIPT_v4.md` from a strong draft into a template-ready
SoftwareX submission. This is a working file, not the final reference list.

## Source Check Notes

The following source pages were opened during preparation on `2026-04-24`:

- SoftwareX guide for authors:
  `https://www.sciencedirect.com/journal/softwarex/publish/guide-for-authors`
- NV5 ENVI header and image-file documentation:
  `https://www.nv5geospatialsoftware.com/docs/enviheaderfiles.html`
  and `https://www.nv5geospatialsoftware.com/docs/ENVIImageFiles.html`
- EHU/GIC Hyperspectral Remote Sensing Scenes:
  `https://www.ehu.eus/ccwintco/index.php?title=Hyperspectral_Remote_Sensing_Scenes`
- Resonon Pika IR-L:
  `https://resonon.com/Pika-IR-L`
- Signoroni et al. HSI review DOI page:
  `https://doi.org/10.3390/jimaging5050052`

Some DOI pages redirect through publisher infrastructure and should still be
checked during final reference cleanup, especially for Elsevier-hosted entries.

## Current Dataset Permission Posture

| Dataset/source | Current interpretation | Submission risk |
| --- | --- | --- |
| Indian Pines / Purdue MultiSpec | Purdue's MultiSpec page states the listed hyperspectral images are free to use for testing and/or research and points Indian Pines to PURR DOI `10.4231/R7RX991C`. | Low to moderate; cite PURR and keep wording factual. |
| Pavia University, Pavia Centre, KSC / EHU-GIC | EHU-GIC provides the benchmark download pages and dataset descriptions, but the page should be checked for any explicit license or attribution language before screenshot reuse. | Moderate; include attribution and avoid redistribution. |
| Pika IR-L Hyalite Creek / Resonon | Resonon exposes a Pika IR-L sample-data link and product documentation, but the exact Hyalite Creek sample license still needs to be confirmed. | Highest; retain only if permission/source terms are clear. |
| WHU-Hi LongKou | A Hugging Face mirror for `WHU-Hi-LongKou` lists `mit`, and the WHU-Hi paper provides scholarly provenance. The original dataset terms should still be verified. | Moderate; cite the paper and verify the dataset source used locally. |
| SnowEx AVIRIS-NG SASP | NASA SnowEx states NSIDC-hosted SnowEx campaign data are publicly available at no cost; the public sample should be matched to an official NSIDC product rather than only the Hackweek tutorial. | Moderate; use official DOI/product citation if the sample remains in the paper. |

## How To Use This File

1. Verify each candidate source and dataset license before final submission.
2. Add confirmed entries to the final reference list or BibTeX file.
3. Insert citation keys into `docs/SOFTWAREX_MANUSCRIPT_v4.md`.
4. Keep local real ENVI source data out of Git.

## Candidate Sources For Format And Software Context

| Candidate key | Use in manuscript | Source | Status |
| --- | --- | --- | --- |
| `NV5_ENVI_HeaderFiles` | ENVI header metadata fields, `.hdr`, required fields, default bands, wavelength metadata | NV5 Geospatial, "ENVI Header Files", https://www.nv5geospatialsoftware.com/docs/enviheaderfiles.html | `CANDIDATE` |
| `NV5_ENVI_ImageFiles` | ENVI flat-binary raster plus ASCII header, BSQ/BIP/BIL interleave descriptions | NV5 Geospatial, "ENVI Image Files", https://www.nv5geospatialsoftware.com/docs/ENVIImageFiles.html | `CANDIDATE` |
| `Signoroni2019_HSIReview` | Broad context: hyperspectral imaging data richness, analysis challenges, multidisciplinary HSI use | Signoroni, A.; Savardi, M.; Baronio, A.; Benini, S. "Deep Learning Meets Hyperspectral Image Analysis: A Multidisciplinary Review." `Journal of Imaging` 5(5):52. https://doi.org/10.3390/jimaging5050052 | `CANDIDATE` |
| `Ghamisi2017_HSIOverview` | Broad context: state-of-the-art hyperspectral image/signal processing and high-dimensional data challenges | Ghamisi, P. et al. "Advances in Hyperspectral Image and Signal Processing: A Comprehensive Overview of the State of the Art." `IEEE Geoscience and Remote Sensing Magazine` 5(4), 37-78. https://doi.org/10.1109/MGRS.2017.2762087 | `CANDIDATE` |
| `Dhaene2023_HSIToolbox` | Adjacent system comparison: web-based HSI classification, labeling, server training, multi-user queueing | Dhaene, Z.; Zizakic, N.; Huang, S.; Li, X.; Pizurica, A. "HSIToolbox: A web-based application for the classification of hyperspectral images." `SoftwareX` 22, 101340. https://doi.org/10.1016/j.softx.2023.101340 | `CANDIDATE` |

## Candidate Dataset Provenance Entries

| Dataset in Table 1 | Candidate source/provenance | Evidence to cite | Status |
| --- | --- | --- | --- |
| Indian Pines | Purdue MultiSpec hyperspectral images page and PURR DOI | MultiSpec page says the June 12, 1992 AVIRIS Indian Pine Test Site data are available through Purdue University Research Repository, DOI `10.4231/R7RX991C` | `CANDIDATE`; verify final license/permission for screenshot use |
| Pavia University | EHU/GIC Hyperspectral Remote Sensing Scenes page | EHU/GIC page says Pavia Centre and University were acquired by ROSIS over Pavia, Italy, with 103 bands for Pavia University and scenes provided by Prof. Paolo Gamba | `CANDIDATE`; verify final license/permission for screenshot use |
| Pavia Centre | EHU/GIC Hyperspectral Remote Sensing Scenes page | EHU/GIC page says Pavia Centre has 102 bands and was acquired by ROSIS over Pavia, Italy | `CANDIDATE`; verify final license/permission for screenshot use |
| Kennedy Space Center | EHU/GIC Hyperspectral Remote Sensing Scenes page | EHU/GIC page says NASA AVIRIS acquired KSC data on March 23, 1996; after removing water absorption/low-SNR bands, 176 bands were used | `CANDIDATE`; verify final license/permission for screenshot use |
| Pika IR-L Hyalite Creek | Resonon Pika IR-L product/sample data pages and local header metadata | Resonon documents Pika IR-L as a near-infrared imager covering 925-1700 nm; local header provides exact scene dimensions and wavelength units | `PARTIAL`; need exact sample-data page or license for the Hyalite Creek file before manuscript reuse |
| WHU-Hi LongKou | Zhong et al. 2020 WHU-Hi paper | Remote Sensing of Environment article introduces WHU-Hi as a UAV-borne H2 benchmark dataset; manuscript table uses local ENVI copy of WHU-Hi LongKou | `CANDIDATE`; verify dataset download license/permission |
| SnowEx AVIRIS-NG SASP | SnowEx Hackweek AVIRIS-NG tutorial and/or NSIDC SnowEx AVIRIS-NG data product | SnowEx tutorial uses the SASP subset file `ang20210411t181022_rfl_v2z1a_img_SASP`; NSIDC data product should be preferred for final citation if it matches the source data | `PARTIAL`; replace tutorial-only source with official NSIDC citation if possible |

## Candidate Citation Snippets

These are not final reference-list entries. They are short working snippets for
later BibTeX/reference cleanup.

```text
NV5 Geospatial. ENVI Header Files. ENVI Documentation. Accessed 2026-04-24.
https://www.nv5geospatialsoftware.com/docs/enviheaderfiles.html
```

```text
NV5 Geospatial. ENVI Image Files. ENVI Documentation. Accessed 2026-04-24.
https://www.nv5geospatialsoftware.com/docs/ENVIImageFiles.html
```

```text
Signoroni, A., Savardi, M., Baronio, A., & Benini, S. (2019).
Deep Learning Meets Hyperspectral Image Analysis: A Multidisciplinary Review.
Journal of Imaging, 5(5), 52. https://doi.org/10.3390/jimaging5050052
```

```text
Ghamisi, P., Yokoya, N., Li, J., Liao, W., Liu, S., Plaza, J.,
Rasti, B., & Plaza, A. (2017). Advances in hyperspectral image and signal
processing: A comprehensive overview of the state of the art.
IEEE Geoscience and Remote Sensing Magazine, 5(4), 37-78.
https://doi.org/10.1109/MGRS.2017.2762087
```

```text
Dhaene, Z., Zizakic, N., Huang, S., Li, X., & Pizurica, A. (2023).
HSIToolbox: A web-based application for the classification of hyperspectral
images. SoftwareX, 22, 101340. https://doi.org/10.1016/j.softx.2023.101340
```

```text
Purdue University MultiSpec. Hyperspectral Images. Indian Pine Test Site
AVIRIS data, Purdue University Research Repository DOI 10.4231/R7RX991C.
Accessed 2026-04-24.
https://engineering.purdue.edu/~biehl/MultiSpec/hyperspectral.html
```

```text
Grupo de Inteligencia Computacional (GIC), University of the Basque Country.
Hyperspectral Remote Sensing Scenes. Accessed 2026-04-24.
https://www.ehu.eus/ccwintco/index.php?title=Hyperspectral_Remote_Sensing_Scenes
```

```text
Zhong, Y., Hu, X., Luo, C., Wang, X., Zhao, J., & Zhang, L. (2020).
WHU-Hi: UAV-borne hyperspectral with high spatial resolution (H2) benchmark
datasets and classifier for precise crop identification based on deep
convolutional neural network with CRF. Remote Sensing of Environment, 250,
112012. https://doi.org/10.1016/j.rse.2020.112012
```

```text
Resonon. Pika IR-L (925-1700nm). Accessed 2026-04-24.
https://resonon.com/Pika-IR-L
```

```text
SnowEx Hackweek 2022. Introduction to AVIRIS-NG. Accessed 2026-04-24.
https://snowex-2022.hackweek.io/tutorials/aviris-ng/AVIRIS-NG_Tutorial.html
```

## Open Questions Before Citation Insertion

1. Are the local Indian Pines, Pavia, KSC, Pika, and WHU-Hi files copied from
   the candidate sources listed above, or from another mirror?
2. Are screenshots from these local datasets permitted in the manuscript and/or
   graphical abstract?
3. Should the real ENVI screenshots be included as a manuscript figure, a
   graphical abstract component, supplementary material, or only as internal
   validation evidence?
4. Does the SnowEx remote sample in `public/samples/remote-samples.json` need
   an official NSIDC citation rather than the Hackweek tutorial link?
5. Should the final reference list include both general HSI reviews
   (`Signoroni2019`, `Ghamisi2017`) or only one to conserve word count and
   citation focus?

## Recommended Citation Insertion Points

| Manuscript section | Insert citations for |
| --- | --- |
| Abstract | Usually none unless required; keep abstract citation-free if possible. |
| Section 1, first paragraph | HSI application breadth and data-analysis challenges; cite `Signoroni2019_HSIReview` and/or `Ghamisi2017_HSIOverview`. |
| Section 1, HSIToolbox comparison | Cite `Dhaene2023_HSIToolbox`. |
| Section 2.1, ENVI source modes and metadata | Cite `NV5_ENVI_HeaderFiles` and `NV5_ENVI_ImageFiles` if format semantics need external support. |
| Section 4, real ENVI Table 1 | Cite dataset provenance entries in the table caption or immediately preceding paragraph. |
| Data statement | Cite or name dataset sources/licensing, especially for any screenshots included in final figures. |
