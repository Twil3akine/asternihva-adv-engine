# ローカル立ち絵

キャラクターPNGはこのOSSリポジトリに含めません。画像の権利と公開可否はEngineのMITライセンスとは別です。

```sh
node scripts/import-asternihva-assets.mjs
# 別の素材ディレクトリを使う場合
node scripts/import-asternihva-assets.mjs /path/to/emotion
npm run build
npm run serve:example
```

既定のコピー元は `/Users/rutt/mein/Asternihva Project/Image/Standings/emotion` です。スクリプトは元画像を読み取るだけで、削除・改名・上書きしません。コピー先 `public/characters/` と導入済みmanifestはGit除外対象です。既存のコピー先に異なる内容がある場合は上書きせず停止します。更新素材を反映するときは `node scripts/import-asternihva-assets.mjs --replace-existing` を指定すると、Demo用コピーだけを置換します。

画像が未導入・不足・読み込み失敗の場合は、該当キャラクターを既存SVGへ切り替え、画面上に案内します。他のキャラクターは実PNGを使用できます。画像の有無はEngineのbuild/testに影響しません。

## 確認した素材とexpression ID

30枚すべて4096×6144、8bit RGBAの透過PNGです。各キャラクター10種類です。`neutral`だけを初期表情ID `normal` に対応させ、その他はファイル名の綴りを保持しています。

| ID | Noah | Seren | Luminal |
|---|---|---|---|
| angry | Noah_angry.png | Seren_angry.png | Luminal_angry.png |
| embarrassed / embarrased | Noah_embarrassed.png (`embarrassed`) | Seren_embarrased.png (`embarrased`) | Luminal_embarrassed.png (`embarrassed`) |
| happy | Noah_happy.png | Seren_happy.png | Luminal_happy.png |
| normal | Noah_neutral.png | Seren_neutral.png | Luminal_neutral.png |
| relaxed / relax | Noah_relaxed.png (`relaxed`) | Seren_relax.png (`relax`) | Luminal_relax.png (`relax`) |
| sad | Noah_sad.png | Seren_sad.png | Luminal_sad.png |
| serious | Noah_serious.png | Seren_serious.png | Luminal_serious.png |
| smile | Noah_smile.png | Seren_smile.png | Luminal_smile.png |
| surprised | Noah_surprised.png | Seren_surprised.png | Luminal_surprised.png |
| troubled | Noah_troubled.png | Seren_troubled.png | Luminal_troubled.png |

`Seren_embarrased.png` の綴り、および `relax` / `relaxed` の違いは素材名のままです。意図を推測して統一していません。冒頭は3人それぞれ `normal → smile → surprised` とmotionを確認できます。確認したNoahの3差分には、ドローンや巨大剣は含まれていません。

LOGの顔アイコンは発言時のexpressionを同じ対応表から解決します。Noahは `3.9 / 0.5 / 0.16`、Serenは `3.9 / 0.5 / 0.155`、Luminalは `3.8 / 0.5 / 0.16` のscale / anchorX / anchorYを使い、元画像を加工せず円形領域へ表示します。

## 表示設定

設定は [asset-manifest.mjs](./asset-manifest.mjs) に置きます。画像自体は加工せず、SpriteRendererのportrait viewportで下半身を隠します。

| キャラクター | scale | anchorX | anchorY |
|---|---:|---:|---:|
| Noah | 1.5 | 0.5 | -0.04 |
| Seren | 1.5 | 0.5 | -0.04 |
| Luminal | 1.5 | 0.5 | -0.04 |

実PNGをPC向け16:9の1280×720で確認した設定です。負のanchorYで上部に余白を取り、頭とヘイローを収めます。キャラクターごとに変更できます。PC画面では3人を同じゲーム領域に並べ、腰付近まで見せます。素材に描かれた姿勢・頭の傾きの差はそのまま表示します。
