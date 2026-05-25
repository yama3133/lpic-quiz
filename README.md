# LPIC 模擬試験 (LPIC-201 / 202 / 305)

LPIC-2(201/202)と LPIC-3 305 の模擬試験を1つのアプリで提供する Web 試験対策ツール。

- **LPIC-201** Linux Engineer 201-450 v4.5 — 150問
- **LPIC-202** Linux Engineer 202-450 v4.5 — 150問
- **LPIC-305** Linux Professional 3 仮想化・コンテナ — 150問

## 特徴

- 試験ごとに **全問順番 / 全問ランダム / カテゴリー別 / 本番形式60問** の 4 モード
- 多肢選択(単一 / 複数)と **コマ問(入力式)** の両方に対応
  - PC: テキスト入力 + Enterキーで答え合わせ
  - iPhone/モバイル: テキスト入力 + 「答え合わせ」ボタン
- 各設問に **解説** 付き
- 試験ごとにテーマカラー(LPIC-201: 青 / 202: 緑 / 305: 紫)

## 技術スタック

- React 19 + Vite 5
- Vanilla CSS(フォントは Google Fonts: Inter / Noto Sans JP / JetBrains Mono)
- 静的ホスティング対応(GitHub Pages, Vercel, Netlify など)

## セットアップ

```bash
npm install
npm run dev      # 開発サーバ起動
npm run build    # 本番ビルド
npm run preview  # ビルド成果物のプレビュー
```

## 問題データの再生成

`/Users/yuukiyamashita/Downloads/` 配下の Markdown 原本から問題データを再生成する場合:

```bash
npm run parse
```

`scripts/parse201.mjs` / `parse202.mjs` / `parse305.mjs` がそれぞれ
`src/data/lpic201.js` / `lpic202.js` / `lpic305.js` を出力する。

## ディレクトリ構成

```
lpic-quiz/
├── scripts/          # MD → JS パーサ
├── src/
│   ├── data/         # 問題データ(自動生成)
│   ├── App.jsx       # 画面ロジック全体
│   ├── index.css     # スタイル
│   └── main.jsx      # エントリポイント
├── index.html
├── package.json
└── vite.config.js
```
