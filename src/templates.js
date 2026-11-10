/**
 * 名片版型（180 × 54 mm，單張雙語並排）
 * ------------------------------------------------------------
 * 一張 SVG 內含兩個 90 × 54 mm 的完整卡片：
 *   左邊＝中文版、右邊＝英文版；沒有英文資料時只輸出左邊，右半留白。
 * 公司地址直接寫在版型裡（靜態文字），可透過「下載版型 → 修改 → 上傳」更換。
 *
 * 模板語法：
 *   {{key}}              插入欄位（值已在 buildContext 內做過 XML escape）
 *   {{#if key}}…{{/if}}  條件區塊；key 為空時整段（含 <text>）會被移除
 */

const RED = '#D0212F';
const INK = '#333331';
const BODY = '#46464A';

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

/** 轉義 XML 特殊字元，避免姓名／公司名中的 & < > 破壞 SVG。 */
export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * 粗略估算文字寬度（單位：mm）。SVG 沒有自動換行，
 * 用字元級估算 + 縮小字級，避免長姓名／長 Email 溢出卡片。
 */
function estimateWidth(text, size, tracking = 0) {
  const chars = [...text];
  let units = 0;
  for (const char of chars) {
    const code = char.codePointAt(0);
    if (code >= 0x2e80) units += 1; // CJK / 全形
    else if (char === ' ') units += 0.3;
    else if (/[A-Z0-9]/.test(char)) units += 0.64;
    else if (/[a-z]/.test(char)) units += 0.54;
    else units += 0.38;
  }
  return units * size + Math.max(0, chars.length - 1) * tracking;
}

/** 回傳「放得進 maxWidth 的最大字級」。 */
function fitSize(text, size, maxWidth, minSize = 1.3, tracking = 0) {
  if (!text) return size;
  const width = estimateWidth(text, size, tracking);
  if (width <= maxWidth) return size;
  return Math.max(minSize, Math.round(((size * maxWidth * 0.98) / width) * 10) / 10);
}

/** 把多個「標籤 + 值」組成一行，例如 Tel 886 2 1234 5678 ext 233 */
function joinLine(parts) {
  return parts
    .filter((part) => part && String(part.value ?? '').trim() !== '')
    .map((part) => `${part.label ? `${part.label} ` : ''}${part.value}`)
    .join(' ');
}

const TEXT_X = 45.2;
const TEXT_WIDTH = 39.5;

/**
 * 把員工資料 + 公司資訊整理成模板可用的欄位。
 * 左卡一定會有內容（沒有中文姓名時用英文姓名）；右卡只在有中英姓名時輸出。
 */
export function buildContext(employee = {}, brand = {}) {
  const companyZh = clean(brand.company_zh);
  const companyEn = clean(brand.company_en);
  const tel = clean(brand.tel);
  const fax = clean(brand.fax);
  const website = clean(brand.website).replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  const nameZh = clean(employee.name_zh);
  const nameEn = clean(employee.name_en);
  const titleZh = clean(employee.title_zh);
  const titleEn = clean(employee.title_en);
  const ext = clean(employee.ext);
  const phone = clean(employee.phone);
  const email = clean(employee.email);

  const leftName = nameZh || nameEn;
  const leftTitle = titleZh || titleEn;

  // 只有同時有中文與英文姓名時才輸出右卡，避免同一個名字重複兩次
  const hasEnglish = Boolean(nameZh && nameEn);
  const rightName = hasEnglish ? nameEn : '';
  const rightTitle = hasEnglish ? titleEn : '';

  const hasPhone = phone.length > 0;
  const hasFax = fax.length > 0;

  const telLine = joinLine([
    { label: 'Tel', value: tel },
    { label: 'ext', value: ext },
  ]);

  return {
    // 左卡（中文）
    name_zh: escapeXml(leftName),
    name_zh_size: fitSize(leftName, 3.6, TEXT_WIDTH),
    title_zh: escapeXml(leftTitle),
    title_zh_size: fitSize(leftTitle, 2.6, 38),
    company_zh: escapeXml(companyZh),
    company_zh_size: fitSize(companyZh, 2.7, TEXT_WIDTH),

    // 右卡（英文）
    name_en: escapeXml(rightName),
    name_en_size: fitSize(rightName, 3.4, TEXT_WIDTH),
    title_en: escapeXml(rightTitle),
    title_en_size: fitSize(rightTitle, 2.5, 38),
    company_en: escapeXml(companyEn),
    company_en_size: fitSize(companyEn, 2.5, TEXT_WIDTH),

    // 共用聯絡資訊
    tel: escapeXml(tel),
    tel_line: escapeXml(telLine),
    tel_line_size: fitSize(telLine, 2.3, TEXT_WIDTH, 1.6),
    has_ext: ext ? '1' : '',
    ext: escapeXml(ext),

    fax: escapeXml(fax),
    has_fax: hasFax ? '1' : '',

    phone: escapeXml(phone),
    has_phone: hasPhone ? '1' : '',

    email: escapeXml(email),
    email_size: fitSize(email, 2.3, TEXT_WIDTH, 1.5),

    website: escapeXml(website),
    website_size: fitSize(website, 2.3, TEXT_WIDTH, 1.5),

    // 條件旗標
    has_english: hasEnglish ? '1' : '',
    has_title_en: rightTitle ? '1' : '',

    aria: escapeXml(`${leftName || '名片'}${leftTitle ? `，${leftTitle}` : ''}的名片`),
  };
}

/**
 * 模板引擎：支援巢狀 {{#if}} 區塊與 {{欄位}} 變數。
 * 用堆疊解析（而不是正規表示式），避免巢狀條件互相吃掉結尾標籤。
 */
export function renderTemplate(template, context) {
  const pattern = /\{\{#if (\w+)\}\}|\{\{\/if\}\}|\{\{\s*(\w+)\s*\}\}/g;
  const root = { keep: true, parts: [] };
  const stack = [root];
  const add = (text) => stack[stack.length - 1].parts.push(text);

  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(template)) !== null) {
    add(template.slice(lastIndex, match.index));
    lastIndex = pattern.lastIndex;

    if (match[1]) {
      stack.push({ keep: Boolean(context[match[1]]), parts: [] });
    } else if (match[0] === '{{/if}}') {
      if (stack.length > 1) {
        const frame = stack.pop();
        if (frame.keep) add(frame.parts.join(''));
      }
    } else {
      add(context[match[2]] ?? '');
    }
  }
  add(template.slice(lastIndex));

  // 少寫 {{/if}} 時視為自動結尾，避免整段內容消失
  while (stack.length > 1) {
    const frame = stack.pop();
    if (frame.keep) add(frame.parts.join(''));
  }

  return root.parts.join('');
}

const FONT =
  "'Segoe UI','Helvetica Neue',Helvetica,Arial,'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";

/** EX 字標（佔位商標）：以 64×32 的網格繪製，使用時縮放到 15.5 × 7.7 mm。 */
const LOGO = `<g transform="translate(27.6 13.5) scale(0.242)" fill="${RED}" aria-label="EX">
    <path d="M0 0h6.6v32H0z"/>
    <path d="M0 0h23v6.6H0z"/>
    <path d="M0 12.4h19v6.6H0z"/>
    <path d="M0 25.4h23v6.6H0z"/>
    <path d="M36 0h7.2L64 32h-7.2z"/>
    <path d="M56.8 0H64L43.2 32h-7.2z"/>
  </g>`;

const TRIANGLE = `<polygon points="42.8 0 48.8 0 45.8 6.2" fill="${RED}"/>`;

/** 左卡：中文 */
const LEFT_CARD = `${TRIANGLE}
  ${LOGO}
  <g>
    <text x="${TEXT_X}" y="16.6" font-size="{{name_zh_size}}" font-weight="600" fill="${RED}">{{name_zh}}</text>
    <text x="${TEXT_X}" y="20.2" font-size="{{title_zh_size}}" fill="${RED}">{{title_zh}}</text>

    <text x="${TEXT_X}" y="25.6" font-size="{{company_zh_size}}" fill="${INK}">{{company_zh}}</text>

    <!-- 公司地址（靜態文字）：直接改這裡，或下載版型修改後上傳 -->
    <text x="${TEXT_X}" y="28.8" font-size="2.3" fill="${BODY}">台北市信義區範例路 100 號 5 樓</text>

    <text x="${TEXT_X}" y="32.2" font-size="{{tel_line_size}}" fill="${BODY}">{{tel_line}}</text>
    {{#if has_fax}}<text x="${TEXT_X}" y="35.2" font-size="2.3" fill="${BODY}">Fax {{fax}}</text>{{/if}}
    {{#if has_phone}}<text x="${TEXT_X}" y="38.2" font-size="2.3" fill="${BODY}">Mobile {{phone}}</text>{{/if}}
    <text x="${TEXT_X}" y="41.8" font-size="{{email_size}}" fill="${BODY}">{{email}}</text>
    <text x="${TEXT_X}" y="44.9" font-size="{{website_size}}" fill="${BODY}">{{website}}</text>
  </g>`;

/** 右卡：英文（整張往右平移 90 mm） */
const RIGHT_CARD = `<g transform="translate(90 0)">
  ${TRIANGLE}
  ${LOGO}
  <g>
    <text x="${TEXT_X}" y="16.2" font-size="{{name_en_size}}" font-weight="600" fill="${RED}">{{name_en}}</text>
    {{#if has_title_en}}<text x="${TEXT_X}" y="19.9" font-size="{{title_en_size}}" fill="${RED}">{{title_en}}</text>{{/if}}

    <text x="${TEXT_X}" y="25.2" font-size="{{company_en_size}}" fill="${INK}">{{company_en}}</text>

    <!-- 公司地址（靜態文字，英文） -->
    <text x="${TEXT_X}" y="28.4" font-size="2.25" fill="${BODY}">5F., No. 100, Example Rd.,</text>
    <text x="${TEXT_X}" y="31.2" font-size="2.25" fill="${BODY}">Xinyi Dist., Taipei, Taiwan</text>

    <text x="${TEXT_X}" y="34.4" font-size="{{tel_line_size}}" fill="${BODY}">{{tel_line}}</text>
    {{#if has_fax}}<text x="${TEXT_X}" y="37.4" font-size="2.3" fill="${BODY}">Fax {{fax}}</text>{{/if}}
    {{#if has_phone}}<text x="${TEXT_X}" y="40.4" font-size="2.3" fill="${BODY}">Mobile {{phone}}</text>{{/if}}
    <text x="${TEXT_X}" y="44" font-size="{{email_size}}" fill="${BODY}">{{email}}</text>
    <text x="${TEXT_X}" y="46.9" font-size="{{website_size}}" fill="${BODY}">{{website}}</text>
  </g>
</g>`;

export const CARD_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="180mm" height="54mm" viewBox="0 0 180 54"
     font-family="${FONT}" role="img" aria-label="{{aria}}">
  <title>{{name_zh}}｜名片</title>

  <rect width="180" height="54" fill="#FFFFFF"/>

  ${LEFT_CARD}

  {{#if has_english}}
  ${RIGHT_CARD}
  {{/if}}
</svg>`;

const TEMPLATE_TOKENS = [
  ['name_zh', '左卡姓名（沒有中文姓名時自動用英文姓名）'],
  ['title_zh', '左卡職稱'],
  ['company_zh', '公司中文名'],
  ['name_en', '右卡英文姓名'],
  ['title_en', '右卡英文職稱'],
  ['company_en', '公司英文名'],
  ['tel_line', 'Tel 886… ext 233（含分機）'],
  ['fax', '傳真號碼'],
  ['phone', '手機號碼'],
  ['email', 'Email'],
  ['website', '網站'],
];

/** 下載版型時附加的說明註解（不會出現在名片輸出）。 */
export function templateFile(template = CARD_TEMPLATE) {
  const lines = TEMPLATE_TOKENS.map(([key, desc]) => `    {{${key}}}  ${desc}`).join('\n');
  const header = `<!--
  名片版型檔（180 × 54 mm，左邊中文卡、右邊英文卡）
  可直接用 Illustrator / Inkscape 修改文字、顏色、位置與地址，
  但請保留 {{…}} 佔位符，上傳後才會換成員工資料。

  可用欄位：
${lines}

  條件區塊：
    {{#if has_english}} … {{/if}}   只有中英文姓名都有時才顯示右卡
    {{#if has_phone}} … {{/if}}     沒有手機時整段隱藏
    {{#if has_fax}} … {{/if}}       沒有傳真時整段隱藏
-->`;
  const index = template.indexOf('?>');
  if (index === -1) return `${header}\n${template}`;
  return `${template.slice(0, index + 2)}\n${header}${template.slice(index + 2)}`;
}

/** 檢查上傳的版型是否可用；回傳錯誤訊息或 null。 */
export function validateTemplate(text) {
  if (!text || !/<svg[\s>]/i.test(text) || !/<\/svg>/i.test(text)) {
    return '這不是完整的 SVG 檔，請上傳 .svg 版型。';
  }
  if (/<script[\s>]/i.test(text) || /\son\w+\s*=/i.test(text)) {
    return '版型不可包含 script 或事件屬性。';
  }
  if (!/\{\{\s*(name_zh|name_en)\s*\}\}/.test(text)) {
    return '版型缺少 {{name_zh}} 或 {{name_en}} 佔位符，上傳後會沒有姓名。';
  }
  return null;
}

/**
 * 產生單張名片 SVG。
 * @param {object} employee
 * @param {object} brand
 * @param {string} [template] 自訂版型；預設使用 CARD_TEMPLATE
 */
export function renderCard(employee, brand, template = CARD_TEMPLATE) {
  return renderTemplate(template, buildContext(employee, brand));
}

/** 移除檔名中不合法或容易出錯的字元。 */
export function sanitizeFileName(value) {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** {employee_id}_{name_zh}.svg */
export function buildFileName(employee) {
  const id = sanitizeFileName(employee.employee_id) || 'NOID';
  const name = sanitizeFileName(employee.name_zh || employee.name_en) || 'card';
  return `${id}_${name}.svg`;
}

export const CARD_SIZE = { width: 180, height: 54, unit: 'mm' };
