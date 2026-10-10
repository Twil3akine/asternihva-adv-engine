# Demo typography

The Asternihva example uses Zen Kaku Gothic New for Japanese text and Ubuntu for short Latin labels and controls. The files are local-only under `public/fonts/`; they are excluded from Git. Run `node examples/asternihva/import-fonts.mjs` from the repository root to fetch the four font faces and their license texts. The importer pins Google Fonts revision `bd8f81ddb5c74d5c8897b36ad88b440266245103` and verifies each file's SHA-256 before writing it.

Zen Kaku Gothic New is distributed under the SIL Open Font License. Ubuntu is distributed under the Ubuntu Font Licence. The font binaries are not included in the engine package or this repository. See the official [Zen Kaku Gothic New license](https://github.com/google/fonts/blob/main/ofl/zenkakugothicnew/OFL.txt) and [Ubuntu Font Licence](https://github.com/google/fonts/blob/main/ufl/ubuntu/UFL.txt).

The example waits for the requested local font faces before starting the story. If they are unavailable, the CSS falls back to the platform's Japanese sans-serif fonts.
