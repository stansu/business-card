# 名片批次產生器 · Business Card Studio

用 Excel 管理員工名單，勾選後一次產出中英雙面的 SVG 名片。純前端（Vite + Vanilla JS），
所有資料都在瀏覽器裡處理，不需要後端，也不會把員工資料上傳到任何地方。

![名片預覽](docs/preview.png)

## 功能

- **Excel 匯入**：以 SheetJS 讀取 `.xlsx / .xls / .csv`，自動辨識欄位標題（中文或英文皆可），
  解析成 JSON 陣列並顯示在表格中。
- **搜尋與勾選**：關鍵字即時過濾「中文姓名、英文姓名、工號」；每列有 Checkbox，
  表頭可全選目前篩選結果（支援半選狀態）。
- **SVG 模板**：`src/templates.js` 內含正面（中文）與背面（英文）兩個模板字串，
  用 `{{欄位}}` 置換資料、`{{#if 欄位}}` 控制區塊顯示。
- **批次下載**：只輸出被勾選的人，每人兩個檔案，透過 `Blob` + `URL.createObjectURL` 下載：
  ```
  {employee_id}_{name_zh}_front.svg
  {employee_id}_{name_zh}_back.svg
  ```
- **防呆**：
  - 沒勾選任何人就按下載 → 跳出提示，不會產生檔案。
  - 員工沒有手機 → 正面 `Mobile` 與背面 `TEL` 的 `<text>` 整段自動移除，
    下方區塊同時上移，不留空洞。
  - 長姓名、長 Email、長職稱會自動縮小字級，避免超出卡片。
  - 姓名／公司名中的 `& < > " '` 會做 XML escape，不會產生壞掉的 SVG。
- **預覽**：點「預覽」即時看正反面，並可單獨下載該位員工。
- **公司資訊**：公司名、電話、傳真、地址、分公司資訊、網站可線上編輯，存在 `localStorage`。

## 快速開始

需要 Node.js 18+（建議 20 或 22）。

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產出 dist/
npm run preview  # 預覽 build 結果
```

> `package.json` 的 `xlsx` 指向 SheetJS 官方 CDN 的 0.20.3 tarball
> （npm registry 上的 0.18.5 有多個已知漏洞）。`npm install` / `npm ci` 需要連得到
> `cdn.sheetjs.com`。

## Excel 格式

第一列是欄位標題，以下欄位名稱（或英文別名）都可以辨識，順序不拘、多的欄位會忽略：

| 欄位 | 可用的標題寫法 | 說明 |
| --- | --- | --- |
| 工號 | `工號`、`員工編號`、`employee_id`、`id` | 檔名會用到 |
| 中文姓名 | `中文姓名`、`姓名`、`name_zh` | 沒填時改用英文姓名 |
| 英文姓名 | `英文姓名`、`name_en`、`english_name` | 背面主標題 |
| 職稱 | `職稱`、`職位`、`title` | 正面顯示 |
| 英文職稱 | `英文職稱`、`title_en`、`english_title` | 背面顯示 |
| 部門 | `部門`、`單位`、`dept` | 選填 |
| 分機 | `分機`、`分機號碼`、`ext`、`extension` | 接在 `Tel` 後顯示 |
| 手機 | `手機`、`行動電話`、`mobile`、`phone` | 空白時該行隱藏 |
| Email | `Email`、`電子郵件`、`e-mail`、`mail` | 正反面都會顯示 |
| 地址 | `地址`、`通訊地址`、`address` | 選填，留空時用公司地址 |

專案內附範例檔 `public/sample-employees.xlsx`，網站右上角「下載範例 Excel」也可取得。
範例中包含「沒有手機」與「沒有分機」的情境，可直接測試防呆效果。

## 部署到 GitHub Pages

1. 建立 GitHub repo，把這個資料夾推上 `main` 分支。
2. 到 repo 的 **Settings → Pages → Build and deployment**，Source 選擇 **GitHub Actions**。
3. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 會自動 `npm ci`、`npm run build`，
   並把 `dist/` 發佈到 Pages。
4. 網址會是 `https://<你的帳號>.github.io/<repo>/`。

`vite.config.js` 使用 `base: './'`（相對路徑），所以專案站台放在任何子路徑都能運作，
不需要把 repo 名稱寫進設定。

## 專案結構

```
.
├── index.html                     # 頁面骨架（上傳區、工具列、表格、預覽）
├── src/
│   ├── main.js                    # 匯入流程、搜尋、勾選、下載、預覽、Toast
│   ├── excel.js                   # SheetJS 解析、標題列偵測、欄位別名對應
│   ├── templates.js               # SVG 模板字串、字級計算、檔名規則
│   └── style.css                  # 樣式
├── public/
│   └── sample-employees.xlsx      # 範例名單
├── .github/workflows/deploy.yml   # GitHub Pages 部署
├── vite.config.js
└── package.json
```

## 自訂模板

打開 `src/templates.js`：

- 顏色：最上方的 `RED`、`INK`、`BODY`。
- 版面座標：模板中的 `x` / `y`（單位 mm，卡片 90 × 54）。
- 欄位：`buildContext()` 回傳的 key 就是模板可用的變數。
- 條件顯示：`{{#if has_phone}} ... {{/if}}`，值為空字串時整段移除。
- 商標：`RH_LOGO` 是一組 64×32 座標的 `<path>`，可直接換成其他 SVG 圖形。

改完後重新整理即可看到結果；下載的檔案就是當下模板的輸出。

## 印刷注意事項

- SVG 尺寸為 90 × 54 mm（標準名片），**未含出血**。若要送印，可請印刷廠代為出血，
  或在模板外層自行加 3 mm 出血（把 `viewBox` 改成 `-3 -3 96 60` 並補背景）。
- 文字使用系統字型（Noto Sans TC / 微軟正黑 / PingFang），並未轉外框。
  送印前建議用 Illustrator 或 Inkscape 開啟 SVG，將文字轉為曲線，避免字型缺漏。
- 一次下載多人時，瀏覽器可能會詢問「允許多重下載」，請選擇允許。

## 常見問題

**Excel 的手機號碼開頭的 0 不見了？**
Excel 會把 `0912345678` 當成數字。請把該欄格式設為「文字」，或直接留空格 /
用 `0912 345 678` 這種含空格的寫法。程式也會在偵測到 9 碼 `9xxxxxxxx` 時自動補回開頭的 0。

**可以改成 Vue 3 嗎？**
`main.js` 的 DOM 操作集中在檔案下半部，`excel.js` 與 `templates.js` 都是純函式，
可以直接搬進 Vue 元件；或是把 `main.js` 換成 Vue 版本，模板與解析邏輯不必改。

**公司資訊存在哪裡？**
存在瀏覽器的 `localStorage`（key：`business-card-brand-v2`），不會上傳。
換電腦或無痕模式會回到預設值，可按「還原預設」重設。
