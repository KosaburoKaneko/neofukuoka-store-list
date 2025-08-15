# 取扱店舗一覧（静的生成スターター）

GoogleスプレッドシートのCSVを **GitHub Actions** で取得し、**一覧（リスト）**と**各店舗の詳細ページ**を静的に出力します。
アクセス時の `fetch` はゼロ。SEOと初期表示が高速です。

---

## 1) 必要条件（macOS）

- Node.js 20 以上（`node -v` で確認。必要なら https://nodejs.org/ から LTS をインストール）
- 任意: `git`, GitHub アカウント（Pages で公開する場合）

## 2) セットアップ

```bash
cd store-list-starter
npm ci
```

## 3) Google Sheets のCSV公開URLを設定

`scripts/csv2html.js` の先頭にある `SHEET_CSV` を **ご自身のシートのCSV公開URL**に置き換えてください。

例:
```js
const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/xxxxxxxxxxxxxxxx/export?format=csv';
```

> *シートの公開方法*: Googleスプレッドシート → [ファイル] → [ウェブに公開] →「CSV」で公開。

## 4) ローカルでビルド＆確認

```bash
npm run build
# dist/index.html をブラウザで開いて表示確認（ダブルクリックでもOK）
# もしくは簡易サーバで:
python3 -m http.server -d dist 5173
# → http://localhost:5173
```

## 5) GitHub Pages で自動公開

1. 新規リポジトリを作成して、このフォルダの中身を push。
2. リポジトリにそのまま含まれている `.github/workflows/build.yml` が毎日自動ビルド＆ `gh-pages` ブランチへデプロイします。
3. GitHub の `Settings → Pages` で **Branch: gh-pages** を選択すると公開されます。

> シート更新のたびに即反映したい場合は、Actions タブから **Run workflow** を押せば手動ビルドできます。

## 6) CSV の推奨カラム

必須: **店舗名**（`店舗名 / Name`）  
推奨: **住所**, **都道府県**, **支店名**, **電話**, **取扱商品**, **画像URL**

日本語/英語の列名は柔軟にマッピングされます（`scripts/csv2html.js` の `COLS` を参照）。

## 7) スタイル調整

- 色や角丸は `template_list.html` / `template_detail.html` の `:root` 変数（例: `--accent`）を変更。
- PC では中央寄せ＆左右余白のみ（モバイルと同じUI）。

## 8) ライセンス

このスターターは自由に改変・利用してください。
