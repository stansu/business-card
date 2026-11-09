/**
 * SVG 名片模板（90 × 54 mm，中英雙面）
 * ------------------------------------------------------------
 * 版面粉色：左側 EX 字標（佔位商標）、上方紅色三角、右側資訊欄。
 * 正面為中文，背面為英文。
 *
 * 模板語法：
 *   {{key}}              插入欄位（值已在 buildContext 內做過 XML escape）
 *   {{#if key}}…{{/if}}  條件區塊；key 為空時整段（含 <text>）會被移除
 *
 * 要調整配色或版面，直接改下面的模板字串；
 * 要新增欄位，請在 buildContext() 補上對應的 key。
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

/** 依寬度把英文地址拆成最多兩行；優先斷在逗號後，避免把 "Xinyi Dist." 拆開。 */
function wrapLines(text, size, maxWidth, maxLines = 2) {
  const source = clean(text);
  if (!source) return Array.from({ length: maxLines }, () => '');

  const chunks = source
    .split(/,\s*/)
    .filter(Boolean)
    .map((chunk, index, all) => (index < all.length - 1 ? `${chunk},` : chunk));

  const lines = [];
  let current = '';
  for (const chunk of chunks) {
    const candidate = current ? `${current} ${chunk}` : chunk;
    if (current && estimateWidth(candidate, size) > maxWidth && lines.length < maxLines - 1) {
      lines.push(current);
      current = chunk;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const overflow = lines.splice(maxLines - 1);
    lines[maxLines - 1] = overflow.join(' ');
  }

  return Array.from({ length: maxLines }, (_, index) => lines[index] ?? '');
}

/** 把多個「標籤 + 值」組成一行，例如 Tel 886 2 1234 5678 ext 233 */
function joinLine(parts) {
  return parts
    .filter((part) => part && String(part.value ?? '').trim() !== '')
    .map((part) => `${part.label ? `${part.label} ` : ''}${part.value}`)
    .join(' ');
}

/**
 * 把員工資料 + 公司資訊整理成模板可用的欄位。
 * 所有文字欄位都先 escape，並預先算好字級與會隨資料變動的座標。
 */
export function buildContext(employee = {}, brand = {}) {
  const companyZh = clean(brand.company_zh);
  const companyEn = clean(brand.company_en);
  const tel = clean(brand.tel);
  const fax = clean(brand.fax);
  const website = clean(brand.website).replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const addressZh = clean(employee.address_zh) || clean(brand.address_zh);
  const addressEn = clean(employee.address_en) || clean(brand.address_en);
  const branchZh = clean(brand.branch_zh);
  const branchEn = clean(brand.branch_en);
  const branchTel = clean(brand.branch_tel);
  const branchFax = clean(brand.branch_fax);
  const branchTitleEn = clean(brand.branch_title_en) || 'Branch office';

  const nameZh = clean(employee.name_zh);
  const nameEn = clean(employee.name_en);
  const titleZh = clean(employee.title_zh);
  const titleEn = clean(employee.title_en);
  const ext = clean(employee.ext);
  const phone = clean(employee.phone);
  const email = clean(employee.email);

  const frontName = nameZh || nameEn;
  const backName = nameEn || nameZh;
  const frontTitle = titleZh || titleEn;
  const backTitle = titleEn || titleZh;

  const hasExt = ext.length > 0;
  const hasPhone = phone.length > 0;
  const hasBranch = Boolean(branchZh || branchEn);
  const hasFax = fax.length > 0;

  const telLine = joinLine([
    { label: 'Tel', value: tel },
    { label: 'ext', value: ext },
  ]);
  const branchTelLine = [branchTel && `Tel ${branchTel}`, branchFax && `Fax ${branchFax}`]
    .filter(Boolean)
    .join('   ');

  const [addressEn1, addressEn2] = wrapLines(addressEn, 2.2, 41, 2);
  const [branchEn1, branchEn2] = wrapLines(branchEn, 2.2, 41, 2);

  // 手機不存在時，下方區塊自動上移，避免留下空洞
  const frontBranchY = hasPhone ? 36.9 : 34.1;
  const frontBranchTelY = frontBranchY + 2.8;
  const frontEmailY = hasBranch ? frontBranchTelY + 3.0 : frontBranchY;
  const frontWebY = frontEmailY + 2.9;

  const backBranchY = hasPhone ? 37.7 : 35.0;
  const backBranchAddrY = backBranchY + 2.6;
  const backBranchAddr2Y = backBranchAddrY + 2.4;
  const backBranchTelY = backBranchAddrY + (branchEn2 ? 4.8 : 2.4);
  const backEmailY = hasBranch ? backBranchTelY + 2.8 : backBranchY;
  const backWebY = backEmailY + 2.6;

  return {
    // ── 姓名／職稱 ──
    name_zh: escapeXml(frontName),
    name_zh_size: fitSize(frontName, 3.2, 41),
    name_en: escapeXml(backName),
    name_en_size: fitSize(backName, 3.1, 41),

    title_zh: escapeXml(frontTitle),
    title_zh_size: fitSize(frontTitle, 2.45, 40),
    title_en: escapeXml(backTitle),
    title_en_size: fitSize(backTitle, 2.45, 40),

    company_zh: escapeXml(companyZh),
    company_zh_size: fitSize(companyZh, 2.55, 41),
    company_en: escapeXml(companyEn),
    company_en_size: fitSize(companyEn, 2.55, 41),

    // ── 聯絡方式 ──
    tel: escapeXml(tel),
    tel_line: escapeXml(telLine),
    tel_line_size: fitSize(telLine, 2.2, 41, 1.6),
    has_ext: hasExt ? '1' : '',
    ext: escapeXml(ext),

    fax: escapeXml(fax),
    has_fax: hasFax ? '1' : '',

    phone: escapeXml(phone),
    has_phone: hasPhone ? '1' : '',

    email: escapeXml(email),
    email_size: fitSize(email, 2.2, 41, 1.5),

    website: escapeXml(website),
    website_size: fitSize(website, 2.2, 41, 1.5),

    // ── 正面（中文）──
    address_zh: escapeXml(addressZh),
    address_zh_size: fitSize(addressZh, 2.2, 41, 1.6),

    // ── 背面（英文）──
    address_en_1: escapeXml(addressEn1),
    address_en_2: escapeXml(addressEn2),
    address_en_size: Math.min(
      fitSize(addressEn1, 2.2, 41, 1.4),
      fitSize(addressEn2, 2.2, 41, 1.4),
    ),
    has_address_en: addressEn ? '1' : '',

    // ── 分公司 ──
    branch_zh: escapeXml(branchZh),
    branch_zh_size: fitSize(branchZh, 2.2, 41, 1.6),
    branch_en_1: escapeXml(branchEn1),
    branch_en_2: escapeXml(branchEn2),
    branch_en_size: Math.min(
      fitSize(branchEn1, 2.2, 41, 1.4),
      fitSize(branchEn2, 2.2, 41, 1.4),
    ),
    branch_tel_line: escapeXml(branchTelLine),
    branch_tel_size: fitSize(branchTelLine, 2.2, 41, 1.5),
    has_branch: hasBranch ? '1' : '',
    has_branch_tel: branchTelLine ? '1' : '',
    has_branch_zh: branchZh ? '1' : '',
    branch_title_en: escapeXml(branchTitleEn),

    // ── 會隨資料變動的座標 ──
    front_branch_y: frontBranchY.toFixed(1),
    front_branch_tel_y: frontBranchTelY.toFixed(1),
    front_email_y: frontEmailY.toFixed(1),
    front_web_y: frontWebY.toFixed(1),
    back_branch_y: backBranchY.toFixed(1),
    back_branch_addr_y: backBranchAddrY.toFixed(1),
    back_branch_addr2_y: backBranchAddr2Y.toFixed(1),
    back_branch_tel_y: backBranchTelY.toFixed(1),
    back_email_y: backEmailY.toFixed(1),
    back_web_y: backWebY.toFixed(1),

    aria: escapeXml(`${frontName || '名片'}${frontTitle ? `，${frontTitle}` : ''}的名片`),
  };
}

/** 簡易模板引擎：先處理條件區塊，再替換變數。 */
export function renderTemplate(template, context) {
  const withConditionals = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, body) => (context[key] ? body : ''),
  );
  return withConditionals.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    context[key] === undefined ? '' : String(context[key]),
  );
}

const FONT =
  "'Segoe UI','Helvetica Neue',Helvetica,Arial,'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif";

/** EX 字標（佔位商標）：以 64×32 的網格繪製，使用時縮放到約 15.5 × 7.7 mm。 */
const LOGO = `<g transform="translate(27.6 13.5) scale(0.242)" fill="${RED}" aria-label="EX">
    <path d="M0 0h6.6v32H0z"/>
    <path d="M0 0h23v6.6H0z"/>
    <path d="M0 12.4h19v6.6H0z"/>
    <path d="M0 25.4h23v6.6H0z"/>
    <path d="M36 0h7.2L64 32h-7.2z"/>
    <path d="M56.8 0H64L43.2 32h-7.2z"/>
  </g>`;

export const FRONT_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="54mm" viewBox="0 0 90 54"
     font-family="${FONT}" role="img" aria-label="{{aria}}">
  <title>{{name_zh}}｜名片正面</title>

  <rect width="90" height="54" fill="#FFFFFF"/>
  <polygon points="42.8 0 48.8 0 45.8 6.2" fill="${RED}"/>
  ${LOGO}

  <g fill="${INK}">
    <text x="45.2" y="15" font-size="{{name_zh_size}}" font-weight="600" fill="${RED}">{{name_zh}}</text>
    <text x="45.2" y="18.15" font-size="{{title_zh_size}}" fill="${RED}">{{title_zh}}</text>

    <text x="45.2" y="22.6" font-size="{{company_zh_size}}">{{company_zh}}</text>
    <text x="45.2" y="25.5" font-size="{{address_zh_size}}" fill="${BODY}">{{address_zh}}</text>
    <text x="45.2" y="28.3" font-size="{{tel_line_size}}" fill="${BODY}">{{tel_line}}</text>
    {{#if has_fax}}<text x="45.2" y="31.1" font-size="2.2" fill="${BODY}">Fax {{fax}}</text>{{/if}}
    {{#if has_phone}}<text x="45.2" y="33.9" font-size="2.2" fill="${BODY}">Mobile {{phone}}</text>{{/if}}
  </g>

  {{#if has_branch}}
  <g fill="${BODY}">
    {{#if has_branch_zh}}<text x="45.2" y="{{front_branch_y}}" font-size="{{branch_zh_size}}">{{branch_zh}}</text>{{/if}}
    {{#if has_branch_tel}}<text x="45.2" y="{{front_branch_tel_y}}" font-size="{{branch_tel_size}}">{{branch_tel_line}}</text>{{/if}}
  </g>
  {{/if}}

  <g fill="${BODY}">
    <text x="45.2" y="{{front_email_y}}" font-size="{{email_size}}">{{email}}</text>
    <text x="45.2" y="{{front_web_y}}" font-size="{{website_size}}">{{website}}</text>
  </g>
</svg>`;

export const BACK_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="54mm" viewBox="0 0 90 54"
     font-family="${FONT}" role="img" aria-label="{{aria}}（English）">
  <title>{{name_en}}｜名片背面</title>

  <rect width="90" height="54" fill="#FFFFFF"/>
  <polygon points="42.8 0 48.8 0 45.8 6.2" fill="${RED}"/>
  ${LOGO}

  <g fill="${INK}">
    <text x="45.2" y="14.7" font-size="{{name_en_size}}" font-weight="600" fill="${RED}">{{name_en}}</text>
    <text x="45.2" y="17.65" font-size="{{title_en_size}}" fill="${RED}">{{title_en}}</text>

    <text x="45.2" y="21.8" font-size="{{company_en_size}}">{{company_en}}</text>
    {{#if has_address_en}}
    <text x="45.2" y="24.5" font-size="{{address_en_size}}" fill="${BODY}">{{address_en_1}}</text>
    {{#if address_en_2}}<text x="45.2" y="27" font-size="{{address_en_size}}" fill="${BODY}">{{address_en_2}}</text>{{/if}}
    {{/if}}
    <text x="45.2" y="29.8" font-size="{{tel_line_size}}" fill="${BODY}">{{tel_line}}</text>
    {{#if has_fax}}<text x="45.2" y="32.4" font-size="2.2" fill="${BODY}">Fax {{fax}}</text>{{/if}}
    {{#if has_phone}}<text x="45.2" y="35.1" font-size="2.2" fill="${BODY}">Mobile {{phone}}</text>{{/if}}
  </g>

  {{#if has_branch}}
  <g fill="${BODY}">
    <text x="45.2" y="{{back_branch_y}}" font-size="2.3" font-weight="600" fill="${INK}">{{branch_title_en}}</text>
    {{#if branch_en_1}}<text x="45.2" y="{{back_branch_addr_y}}" font-size="{{branch_en_size}}">{{branch_en_1}}</text>{{/if}}
    {{#if branch_en_2}}<text x="45.2" y="{{back_branch_addr2_y}}" font-size="{{branch_en_size}}">{{branch_en_2}}</text>{{/if}}
    {{#if has_branch_tel}}<text x="45.2" y="{{back_branch_tel_y}}" font-size="{{branch_tel_size}}">{{branch_tel_line}}</text>{{/if}}
  </g>
  {{/if}}

  <g fill="${BODY}">
    <text x="45.2" y="{{back_email_y}}" font-size="{{email_size}}">{{email}}</text>
    <text x="45.2" y="{{back_web_y}}" font-size="{{website_size}}">{{website}}</text>
  </g>
</svg>`;

/**
 * 產生單面名片 SVG。
 * @param {'front'|'back'} side
 */
export function renderCard(side, employee, brand) {
  const context = buildContext(employee, brand);
  const template = side === 'back' ? BACK_TEMPLATE : FRONT_TEMPLATE;
  return renderTemplate(template, context);
}

/** 移除檔名中不合法或容易出錯的字元。 */
export function sanitizeFileName(value) {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** {employee_id}_{name_zh}_front.svg / _back.svg */
export function buildFileName(employee, side) {
  const id = sanitizeFileName(employee.employee_id) || 'NOID';
  const name = sanitizeFileName(employee.name_zh || employee.name_en) || 'card';
  return `${id}_${name}_${side}.svg`;
}

export const CARD_SIZE = { width: 90, height: 54, unit: 'mm' };
