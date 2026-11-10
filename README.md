# 名片批次產生器 · Business Card Studio

🔗 **線上使用：[https://stansu.github.io/business-card/](https://stansu.github.io/business-card/)**

用 Excel 管理員工名單，勾選後一次產出中英並排的 SVG 名片。純前端（Vite + Vanilla JS），
所有資料都在瀏覽器裡處理，不需要後端，也不會把員工資料上傳到任何地方。

![名片預覽](docs/preview.png)

## 輸出格式

每個人只產生 **一個 SVG**（180 × 54 mm）：

- 左邊是中文卡（90 × 54 mm），右邊是英文卡（90 × 54 mm）。
- 沒有填英文姓名時，只輸出左邊中文卡，右半留白。
- 檔名：`{工號}_{中文姓名}.svg`

公司地址直接寫在版型裡（靜態文字），可透過「下載版型 → 修改 → 上傳」更換，
不需要在表單裡輸入。

## 功能

- **Excel 匯入**：以 SheetJS 讀取 `.xlsx / .xls / .csv`，自動辨識欄位標題（中文或英文皆可），
  解析成 JSON 陣列並顯示在表格中。
- **搜尋與勾選**：關鍵字即時過濾「中文姓名、英文姓名、工號」；每列有 Checkbox，
  表頭可全選目前篩選結果（支援半選狀態）。
- **版型管理**：
  - 下載目前版型（`.svg`）用 Illustrator／Inkscape 修改地址、顏色、位置。
  - 上傳修改後的 SVG，立即套用到所有名片，並存在瀏覽器裡。
  - 一鍵還原預設版型。
- **批次下載**：只輸出被勾選的人，透過 `Blob` + `URL.createObjectURL` 下載，一人一個檔案。
- **防呆**：
  - 沒勾選任何人就按下載 → 跳出提示，不會產生檔案。
  - 員工沒有手機 → `Mobile` 那一行整段自動移除。
  - 沒有傳真 → `Fax` 那一行整段移除。
  - 長姓名、長 Email、長職稱會自動縮小字級，避免超出卡片。
  - 姓名／公司名中的 `& < > " '` 會做 XML escape，不會產生壞掉的 SVG。
- **預覽**：點「預覽」即時看整張中英並排名片，並可單獨下載該位員工。
- **公司資訊**：公司名、電話、傳真、網站可線上編輯，存在 `localStorage`。

## 快速開始

需要 Node.js 18+（建議 20 或 22）。

```bash
npm install
npm run dev              # http://localhost:5173/dev.html
npm run build            # 產出 dist/（入口 dev.html → 改名 index.html）
npm run preview          # 預覽 build 結果
npm run build:standalone # 重新產生根目錄的單檔 index.html
```

### 不想裝 Node？直接開 index.html

下載 repo ZIP、解壓後，直接雙擊根目錄的 `index.html` 即可使用，
不需要 Node、不需要伺服器，功能與 GitHub Pages 完全相同（單檔 400 KB，含 SheetJS 與範例 Excel）。

這個 `index.html` 是 `npm run build:standalone` 產生的打包檔；要改程式請編輯
`dev.html` 與 `src/`，再重新執行 `npm run build:standalone`。

### 公司電腦擋 file:// 上傳

有些公司電腦的瀏覽器政策會禁止 `file://` 頁面選檔或拖曳上傳。改用本機伺服器即可，
資料仍然只在你的電腦上：

1. 雙擊根目錄的 `start-server.bat`（使用 Windows 內建 PowerShell，免安裝）。
2. 瀏覽器會自動開啟 <http://127.0.0.1:8787/>。
3. 用完關掉黑色視窗即可。

連接埠被占用時可以換一個：

```bat
start-server.bat -Port 8788
```

如果 `.bat` 被公司政策封鎖，或出現「已封鎖」提示（右鍵 → 內容 → 解除封鎖），
也可以改用：

```bash
python -m http.server 8787
# 或
npx serve . -l 8787
```

伺服器只綁定 `127.0.0.1`，不會對外開放。

> `package.json` 的 `xlsx` 指向 SheetJS 官方 CDN 的 0.20.3 tarball
> （npm registry 上的 0.18.5 有多個已知漏洞）。`npm install` / `npm ci` 需要連得到
> `cdn.sheetjs.com`。

## Excel 格式

第一列是欄位標題，以下欄位名稱（或英文別名）都可以辨識，順序不拘、多的欄位會忽略：

| 欄位 | 可用的標題寫法 | 說明 |
| --- | --- | --- |
| 工號 | `工號`、`員工編號`、`employee_id`、`id` | 檔名會用到 |
| 中文姓名 | `中文姓名`、`姓名`、`name_zh` | 沒填時改用英文姓名 |
| 英文姓名 | `英文姓名`、`name_en`、`english_name` | 有填才會輸出右邊英文卡 |
| 職稱 | `職稱`、`職位`、`title` | 中文卡顯示 |
| 英文職稱 | `英文職稱`、`title_en`、`english_title` | 英文卡顯示（可留空） |
| 部門 | `部門`、`單位`、`dept` | 選填 |
| 分機 | `分機`、`分機號碼`、`ext`、`extension` | 接在 `Tel` 後顯示 |
| 手機 | `手機`、`行動電話`、`mobile`、`phone` | 空白時該行隱藏 |
| Email | `Email`、`電子郵件`、`e-mail`、`mail` | 左右兩張卡都會顯示 |

專案內附範例檔 `public/sample-employees.xlsx`，網站右上角「下載範例 Excel」也可取得。
範例中包含「沒有手機」、「沒有分機」與「沒有英文姓名」的情境，可直接測試防呆效果。

## 版型（下載／上傳）

「3 · 名片版型」區塊提供三個動作：

1. **下載版型 SVG**：取得目前使用的 180 × 54 mm 版型（檔名 `business-card-template.svg`）。
2. **上傳自訂版型**：把修改後的 SVG 套用到所有名片。
3. **還原預設版型**：清掉自訂版型，回到內建版型。

版型是純 SVG，可直接用 Illustrator、Inkscape 或 Figma 開啟，改地址、換 Logo、調位置、
改顏色都可以。**請保留 `{{...}}` 佔位符**，上傳後才會換成員工資料：

| 佔位符 | 內容 |
| --- | --- |
| `{{name_zh}}` | 左卡姓名（沒有中文姓名時自動用英文姓名） |
| `{{title_zh}}` | 左卡職稱 |
| `{{company_zh}}` | 公司中文名 |
| `{{name_en}}` | 右卡英文姓名 |
| `{{title_en}}` | 右卡英文職稱 |
| `{{company_en}}` | 公司英文名 |
| `{{tel_line}}` | `Tel 886 2 1234 5678 ext 233`（含分機） |
| `{{fax}}` | 傳真 |
| `{{phone}}` | 手機 |
| `{{email}}` | Email |
| `{{website}}` | 網站 |

條件區塊（不符合時整段移除，包含外面的 `<text>`）：

```xml
{{#if has_english}} … {{/if}}   只有中英文姓名都有時才顯示右卡
{{#if has_phone}} … {{/if}}     沒有手機時隱藏
{{#if has_fax}} … {{/if}}       沒有傳真時隱藏
```

字級會依姓名長度自動縮小（存在 `data-size` 屬性）。下載的版型直接用瀏覽器或
Illustrator 打開時，佔位符會以正常字級顯示；若想固定字級，把該 `<text>` 的
`data-size` 屬性刪掉即可。

上傳的版型存在 `localStorage`（key：`business-card-template-v1`）；換電腦或無痕模式
會回到預設版型。版型不可包含 `<script>` 或事件屬性。

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
├── index.html                     # 單檔版（自動產生，可直接雙擊；請勿手改）
├── dev.html                       # Vite 開發入口（頁面骨架）
├── start-server.bat               # Windows 本機伺服器（給 file:// 被擋的環境）
├── src/
│   ├── main.js                    # 匯入流程、搜尋、勾選、下載、預覽、版型管理
│   ├── excel.js                   # SheetJS 解析、標題列偵測、欄位別名對應
│   ├── templates.js               # SVG 版型、巢狀條件引擎、字級計算、檔名規則
│   └── style.css                  # 樣式
├── public/
│   └── sample-employees.xlsx      # 範例名單
├── docs/preview.png               # README 預覽圖
├── scripts/
│   ├── rename-build.mjs           # dist/dev.html → dist/index.html
│   ├── build-standalone.mjs       # 產生根目錄單檔 index.html
│   └── serve-local.ps1            # 127.0.0.1 靜態伺服器（PowerShell）
├── .github/workflows/deploy.yml   # GitHub Pages 部署
├── vite.config.js
└── package.json
```

## 印刷注意事項

- 版型尺寸為 180 × 54 mm（兩張 90 × 54 mm 名片並排），**未含出血**。
  若要送印，可請印刷廠代為出血，或在版型外層自行加 3 mm（`viewBox="-3 -3 186 60"`）並補背景。
- 兩張卡之間沒有裁切線；如果需要裁切線或間距，可在版型自行加上。
- 文字使用系統字型（Noto Sans TC / 微軟正黑 / PingFang），並未轉外框。
  送印前建議用 Illustrator 或 Inkscape 開啟 SVG，將文字轉為曲線，避免字型缺漏。
- 一次下載多人時，瀏覽器可能會詢問「允許多重下載」，請選擇允許。

## 常見問題

**Excel 的手機號碼開頭的 0 不見了？**
Excel 會把 `0912345678` 當成數字。請把該欄格式設為「文字」，或直接留空格 /
用 `0912 345 678` 這種含空格的寫法。程式也會在偵測到 9 碼 `9xxxxxxxx` 時自動補回開頭的 0。

**上傳版型後沒反應？**
請確認 (1) 是完整的 `.svg` 檔、(2) 檔案裡仍有 `{{name_zh}}` 或 `{{name_en}}`、
(3) 沒有把文字轉成外框（轉外框後就沒有佔位符了）。

**可以改成 Vue 3 嗎？**
`main.js` 的 DOM 操作集中在檔案下半部，`excel.js` 與 `templates.js` 都是純函式，
可以直接搬進 Vue 元件；或是把 `main.js` 換成 Vue 版本，模板與解析邏輯不必改。

**公司資訊存在哪裡？**
存在瀏覽器的 `localStorage`（key：`business-card-brand-v3`），不會上傳。
換電腦或無痕模式會回到預設值，可按「還原預設」重設。
