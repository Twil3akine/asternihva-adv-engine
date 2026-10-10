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

生成プロンプト案:

> Wide 16:9 anime background illustration of a cozy shared living room at night, viewed straight on as a visual novel scene. A large window shows a quiet deep-blue night sky and a few distant city lights; a comfortable shared sofa, low coffee table, bookshelf, a couple of cushions, and a warm floor lamp establish a lived-in communal space. Cool blue moonlight from the window balances soft amber indoor lighting. Detailed but calm, clean composition, readable room layout, restrained contrast, no people, no characters, no silhouettes, no text, no logos, no UI, no foreground objects blocking the lower center where visual-novel characters will appear. 1600x900 or larger.
