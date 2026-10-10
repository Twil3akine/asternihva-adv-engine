# Asternihva demo backgrounds

EP.00 uses two local, original backgrounds generated with the built-in image generation workflow. No web images or project character art were used. The generated originals remain under `/Users/rutt/.codex/generated_images/01a121e9-daf8-7393-80a3-252bdc06a545/`; the demo copies below are ignored by Git and can be replaced by the user without changing the source outputs.

| ID | Demo file | Dimensions | Bytes | SHA-256 | Use |
|---|---|---:|---:|---|---|
| `room-night-wide` | `public/backgrounds/room-night-wide.png` | 1672×941 | 1,938,265 | `8e1cfaff24e9c4cbfe71de84770ed582460249e5c68f7474afa836392667282f` | Wide conversation framing for the trio |
| `room-night-window` | `public/backgrounds/room-night-window.png` | 1672×941 | 1,865,311 | `d0ced6af4a7b4171de871db906b0a85766b3235d36dd892038d0b97b1b8eff6a` | Closer view of the window for the opening narration |

To enable these images in a checkout where they are absent, copy them into the two paths in the table. The IDs, URLs, crop anchors, and overlays are configured in [`background-manifest.mjs`](./background-manifest.mjs). Without the PNGs the demo uses its CSS gradient fallback.

## Generation prompts

Both images use `transparent_background=false`.

**room-night-wide**

> Use case: stylized-concept. Asset: original 16:9 Japanese anime visual novel BACKGROUND ART, no people, no UI, no text. Nighttime modest shared living room with a large window, quiet navy-blue sky and one tiny star-like light outside. Deliberately HAND-PAINTED 2D anime background, soft gouache brushwork, simplified architectural shapes and restrained fine line art, muted colors and gentle cel-style light/shadow, harmonizes with softly drawn anime character sprites. Absolutely NOT photorealistic, NOT a 3D render, NOT luxury hotel or mansion. Cozy lived-in shared room: simple fabric sofa at left edge, small book shelf, modest low table, simple curtains. Cool blue and indigo palette, a small warm amber lamp. Wide composition with open uncluttered center and lower foreground for three character sprites; dialogue covers bottom fifth. Large rectangular window occupies center-right. Understated star decoration only one or two details. Quiet believable modern home, slightly futuristic only in clean design. Avoid shiny surfaces, rich luxury furnishings, cinematic photoreal shading, excessive detailed clutter. Window-forward alternate view of same room will be generated next.

**room-night-window** (uses the wide image as its reference)

> Use this as reference for the EXACT same modest shared room. Generate another original 16:9 anime visual novel background, camera somewhat closer to the window, window dominates upper-middle/right, small solitary light outside easy to see. Preserve sofa left, bookcase and small warm table lamp left, simple curtains and ordinary distant rooftops, navy palette. Hand-painted 2D anime BACKGROUND ART, soft paint and restrained linework, simplified detail, NOT photograph, NOT 3D render, NOT luxurious hotel. Clear indoor lower foreground, quiet reflective mood, alternate view for narration without people. Do not add characters, text, UI, dramatic sci-fi elements. Match reference drawing style and gentle lighting carefully. This is room-night-window, same room as room-night-wide.

The generated images are local demo assets and are not committed. Their provenance is this prompt and the built-in image generation workflow; they are not edits or crops of the original character PNGs.
