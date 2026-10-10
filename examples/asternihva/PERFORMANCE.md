# ロード計測

修正前の `0ff3b7d` と、最終実装の `d9af0b0` を比較しました。Chrome 154.0.8037.98（headless）、1440×900、localhost配信、HTTP cache無効の条件で、それぞれ新しいページを3回順番に開いています。document開始時に計測を挿入し、`#game[data-mode="line"]` が最初に設定された時点までを測りました。

| 指標 | 修正前 | 最終実装 |
|---|---:|---:|
| 初期表示までの中央値 | 424.1ms | 326.2ms |
| 3回の測定値 | 413.3 / 430.0 / 424.1ms | 355.8 / 287.7 / 326.2ms |
| 初期PNGの種類数 | 30 | 3 |
| PNGの転送body | 335,968,245 bytes（320.40MiB） | 34,278,788 bytes（32.69MiB） |
| PNGのHTTP転送量 | 335,977,245 bytes | 34,280,588 bytes |
| PNGの明示的decode呼び出し | 60（各画像2回） | 3（各画像1回） |

初期表示時間は23.1%、PNG転送bodyは89.8%減りました。初期表情の3枚だけをロードし、未使用の27枚は取得・decodeしていません。最終実装では各初期PNGにHEAD確認とGETがあるため、Resource Timing上は6 entriesです。HEADのbodyは0で、3 GETのbody合計が上表の値です。

この計測は背景画像を追加する前に行ったため、当時は `public/backgrounds/room-night.png` がなく、背景decodeは0回でした。現在のDemoは、ローカルに置いた `room-night-wide.png` を初期表示時に読み込み、窓側シーンへ進んだ後に `room-night-window.png` を読み込みます。ファイルは合計約3.5MBで、どちらもGit管理対象外です。キャラクター表情画像を最初からまとめてdecodeしない方針は維持しています。

## 表情切替

crossfadeを無効にしたStandalone SpriteRendererで、4096×6144のnormalとsmileを測りました。

| 指標 | 修正前 | 修正後 |
|---|---:|---:|
| 初回normal → smile | 0.1ms | 134.8ms |
| normalに戻した後のsmile再利用 | 0ms | 0ms |

修正前のsmileは生成時に先読み済みでした。修正後は初回要求時にdecodeを行い、cacheに残っている間は再利用できます。上記はanimation時間を含みません。通常のDemoでは表情crossfadeが180ms加わります。

## Cacheと計測の範囲

DemoはSpriteと背景で1つのDecodedImageCacheを共有し、上限を8枚にしています。現在表示中・crossfade中・取得中の画像は保護します。保護対象だけで上限を超えた場合は、release後に未使用画像を解放します。

この上限はアプリが保持するcacheの上限です。ブラウザ自身のHTTP／decoded resource cacheや物理メモリの回収時期は制御しません。decoded pixel memoryとbrowser heapは直接測定していません。

localhostでの測定で、HTTP cacheは無効ですがOSのファイルcacheは制御していません。ネットワーク環境や機種によって時間は変わります。途中の統合状態では中央値288.1msでしたが、上表には全修正をコミットした状態の測定値を採用しています。

初期ロードの削減が確認できたため、今回はWeb用resize pipelineを追加していません。高解像度画像の初回decodeやLOGでの表示負荷は、派生画像を検討する際の計測対象です。
