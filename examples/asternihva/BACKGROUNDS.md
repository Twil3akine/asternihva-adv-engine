# Asternihva demo backgrounds

Two local backgrounds are used by EP.00. Both were created for this demo with the built-in image generation workflow; no web image was used. They depict the same quiet, warmly lit night living room with a large window and a small point of light outside. The wide composition leaves room for three characters, and the window composition gives the outside light more of the frame.

| ID | Local path | Dimensions | Approx. size | Intended composition |
|---|---|---:|---:|---|
| `room-night-wide` | `public/backgrounds/room-night-wide.png` | 1672×941 | 1.7 MB | Three-character conversation |
| `room-night-window` | `public/backgrounds/room-night-window.png` | 1672×941 | 1.8 MB | Window and outside light |

The PNGs are intentionally ignored by Git because the demo artwork is locally supplied. To enable them, place the files at the paths above. When they are absent, the demo keeps its CSS gradient fallback. The IDs and URLs are defined in [`background-manifest.mjs`](./background-manifest.mjs).

The room uses a subdued navy night view, warm indirect lights, and open floor space across the foreground. The window-focused version uses a closer composition of the same room and keeps a single small light visible outside. The files are generated background artwork, not edits or crops of the project's character images.
