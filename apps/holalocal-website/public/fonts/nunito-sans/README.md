# Nunito Sans webfonts

Self-hosted Nunito Sans, SIL Open Font License 1.1 (see OFL.txt).
Official source: https://github.com/google/fonts/tree/main/ofl/nunitosans
Upstream source revision recorded in Google metadata: 058bd7a2f33d6ad5ef1df985b3db403622016a8c.
Font version: 3.100 (OpenType fontVersion 203227). Retrieved 2026-09-22.

These official Google Fonts WOFF2 files preserve normal/italic variable weights 200–1000 and the original optical-size, width and lowercase-height axes. CSS uses normal width and default lowercase height. No synthetic bold or italic is required.

The five official script subsets per style are accompanied by an official supplemental file containing the 74 encoded characters omitted from the standard web distribution. Together each style retains all 937 encoded characters in the selected full TTF, including characters outside the current translations. They were not restricted to translation text. Unicode ranges let browsers request only required scripts/styles; italic is not preloaded. All files are local at runtime and use font-display: swap.

Official manifests: https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wdth,wght,YTLC@0,6..12,75..125,200..1000,440..540;1,6..12,75..125,200..1000,440..540&display=swap
The supplement uses the same family/axes request with `text` set to the omitted code points listed in the supplement font-face unicode-range. Files came directly from fonts.gstatic.com; no local conversion or tooling installation occurred.

Original full TTFs (not shipped):
- Normal: 571240 bytes, SHA-256 f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d.
- Italic: 558412 bytes, SHA-256 d9d5db18f3c11221a4fbb553cbc709391c1179964c7eaa4466ef43c78aa4492f.

Packaged WOFF2 assets:

| File | Bytes | SHA-256 |
|---|---:|---|
| NunitoSans-italic-cyrillic-ext.woff2 | 65972 | f83d2601b465633356c659f3e6b2f8fb7d8d7a51b6d781c6fa75ebb2ffeb9692 |
| NunitoSans-italic-cyrillic.woff2 | 47776 | b78875884c4b1a86b754a4d8242e02bad96203b9ca31b59f70eb278cf93ab695 |
| NunitoSans-italic-latin-ext.woff2 | 77460 | 1cb11747ad790faed6ee3644f6891cb94496da7e0acf042bf3619192c4eb5673 |
| NunitoSans-italic-latin.woff2 | 87628 | 87640befc0a94e930d9d5c46ea08d3b39c28f51bd0e7c821ccceb58a8ab4ea65 |
| NunitoSans-italic-supplement.woff2 | 32840 | 6e2d44a681c71356e51c032e1012e798469cc3b150bb67aef9ab45edbdadb773 |
| NunitoSans-italic-vietnamese.woff2 | 30492 | 7cd6bee4b5813a5a2a42ae1a6a4333b2ca6fbc81eb0b5845ab8ad1103fa0f189 |
| NunitoSans-normal-cyrillic-ext.woff2 | 62348 | 8e9535169defc6af1620ce4177327cf0f8136c1b3d4c01a58d61b8aa13b5c8ba |
| NunitoSans-normal-cyrillic.woff2 | 44740 | 448120957523ebd9fe54207c3d847d4293709e8ceb761449cd4b463b50db4711 |
| NunitoSans-normal-latin-ext.woff2 | 70188 | 3db33e574dbc077c6142b703eb069cdd19f8856dedebdf639cb07e1fee2fb286 |
| NunitoSans-normal-latin.woff2 | 81308 | 7582a954b2628df12d7d2765822d4fa2a23076448f76ea61348de415b1848b42 |
| NunitoSans-normal-supplement.woff2 | 29928 | 50dadc92307bb465bb86172b0f61cdb35215f633b213879545a319a9be81930d |
| NunitoSans-normal-vietnamese.woff2 | 25624 | c045af8ff99281f3c3ccd51117f55319728a730c369531dc0ee4d539785136d1 |

Total normal: 314136 bytes; italic: 342168 bytes; combined: 656304 bytes. A typical Latin-only page needs only the 81308-byte normal Latin file.
