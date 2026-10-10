# 背景素材

## 夜の共有リビング

この素材調査では、既存の画像から夜の共有リビング背景に使えるものは見つかりませんでした。

リポジトリ内の [room.svg](./assets/room.svg) は1600×900の夜景風プレースホルダーです。窓、星、ソファ、ランプを単純な図形で描いており、完成背景として必要な共有リビングの内装や質感はありません。

プロジェクトの `Image/` 素材を調べ、横長画像を中心に見た目も確認しました。次の画像はキャラクターやコラージュが主題で、背景としては使えません。

| 確認したファイル | 寸法 | 用途に合わない理由 |
|---|---:|---|
| `/Users/rutt/mein/Asternihva Project/Image/All/output-4x.png` | 6344×3968 | 3人のキャラクターが大きく描かれたイラストです。 |
| `/Users/rutt/mein/Asternihva Project/Image/All/output-general-4x.png` | 6344×3968 | 3人のキャラクターと花の装飾が中心です。 |
| `/Users/rutt/mein/Asternihva Project/Image/All/ChatGPT 画像 2026年10月10日 02_39_20-1.png` | 1586×992 | キャラクターと抽象的な花の背景です。 |
| `/Users/rutt/mein/Asternihva Project/Image/All/ChatGPT 画像 2026年10月10日 02_39_22-2.png` | 1586×992 | キャラクターが横並びのイラストです。 |
| `/Users/rutt/mein/Asternihva Project/Image/Noah/ノアのまったり機械仕掛けコラージュ.png` | 1586×992 | Noahのポーズを並べたコラージュです。 |
| `/Users/rutt/mein/Asternihva Project/Image/Noah/Sleepy Chibi Girl’s Cozy Sci-Fi Sticker Sheet.png` | 1586×992 | キャラクターのステッカーシートです。 |

## 用意する素材

背景を追加する場合は、次の場所に `room-night.png` または `room-night.webp` を置き、メタデータ上のIDを `room-night` にしてください。

```text
examples/asternihva/public/backgrounds/room-night.png
```

想定仕様は16:9、最低1600×900です。ADVの画面でキャラクターを手前に重ねるため、画面下部中央には目立つ物を置かず、窓、ソファ、棚、テーブル、フロアランプなどで共有リビングと分かる夜の室内を描きます。窓の外は青みのある夜景、室内は暖色の間接照明にすると、既存の夜色の画面になじみます。

生成promptの例です。

> Wide 16:9 anime background illustration of a quiet shared living room for three people at night, viewed straight on as a visual novel scene. Modern minimalist interior with a subtle near-future feel, never high-tech science fiction. A large window at center-right shows a dark starry sky and a few distant city lights. A low sofa, unobtrusive shelves and a small warm floor lamp establish a lived-in shared space. Black, navy and muted blue dominate, with a little soft amber indirect lighting. Very restrained celestial motifs, calm atmosphere, modest visual detail and contrast. Leave clear central space for three foreground character sprites, with no furniture blocking their upper bodies or the lower dialogue overlay. No people, characters, silhouettes, text, logos, UI, holograms, neon glare or elaborate technology. 1920x1080 or larger.
