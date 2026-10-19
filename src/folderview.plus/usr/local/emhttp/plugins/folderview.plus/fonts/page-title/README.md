# Docker page title fonts

These 18 WOFF2 fonts are bundled with FolderView Plus and served by the Unraid host. No font service is contacted at runtime. Font files are registered on demand: a saved title loads its chosen font, and opening the font picker loads the previews.

The unmodified Latin subsets were obtained from the official Google Fonts CSS API. Each font is distributed under the SIL Open Font License 1.1; its original copyright notice and license are included in the corresponding `.OFL.txt` file. `sources.json` records the exact download URLs, file hashes, sizes and commit-pinned license sources. The runtime software bill of materials includes every font and license.

The variable fonts include the recorded weight range. Bebas Neue and Pacifico have a regular face; browsers synthesize bold when requested. Italic is synthesized for these title fonts. Characters outside each subset use the browser's fallback fonts, so international titles remain readable. The four original generic choices continue to use the theme or locally installed system fonts.
