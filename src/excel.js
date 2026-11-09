/**
 * Excel 匯入與欄位對應
 * ------------------------------------------------------------
 * 使用 SheetJS 讀取第一個「有標題列」的工作表，轉成 JSON 陣列。
 * 標題列支援中文與英文別名，例如「工號 / employee_id / 員工編號」都可以。
 */

import * as XLSX from 'xlsx';

/** 欄位順序即為表格顯示與範例檔的順序。 */
export const FIELDS = [
  ['employee_id', '工號'],
  ['name_zh', '中文姓名'],
  ['name_en', '英文姓名'],
  ['title_zh', '職稱'],
  ['title_en', '英文職稱'],
  ['dept_zh', '部門'],
  ['ext', '分機'],
  ['phone', '手機'],
  ['email', 'Email'],
  ['address_zh', '地址'],
  ['address_en', '英文地址'],
];

const ALIASES = {
  employee_id: ['employee_id', 'emp_id', 'id', '工號', '員工編號', '員工代號', '編號'],
  name_zh: ['name_zh', 'name', '中文姓名', '姓名', '中文名'],
  name_en: ['name_en', 'english_name', '英文姓名', '英文名'],
  title_zh: ['title_zh', 'title', '職稱', '職位', '中文職稱'],
  title_en: ['title_en', 'english_title', '英文職稱', 'job_title'],
  dept_zh: ['dept_zh', 'dept', 'department', '部門', '單位', '中文部門'],
  dept_en: ['dept_en', 'english_dept', '英文部門'],
  ext: ['ext', 'extension', '分機', '分機號碼', '內線'],
  phone: ['phone', 'mobile', 'cell', '手機', '手機號碼', '行動電話'],
  email: ['email', 'e_mail', 'mail', '電子郵件', 'email_address', '信箱'],
  address_zh: ['address_zh', 'address', '地址', '中文地址', '通訊地址'],
  address_en: ['address_en', 'english_address', '英文地址'],
};

const ALIAS_LOOKUP = new Map();
for (const [field, aliases] of Object.entries(ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normalizeHeader(alias), field);
  }
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()]/g, '');
}

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Excel 會把 0912… 存成數字而吃掉開頭的 0，這裡補回來。 */
function normalizePhone(value) {
  const text = clean(value);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (/^9\d{8}$/.test(digits)) return `0${digits}`;
  return text;
}

function mapHeaders(row) {
  const columns = {};
  row.forEach((cell, index) => {
    const field = ALIAS_LOOKUP.get(normalizeHeader(cell));
    if (field && columns[field] === undefined) columns[field] = index;
  });
  return columns;
}

/** 找出最像標題列的那一列（允許前幾列是標題／說明）。 */
function detectHeaderRow(matrix) {
  let best = { index: -1, columns: {}, score: 0 };
  const limit = Math.min(matrix.length, 15);
  for (let index = 0; index < limit; index += 1) {
    const columns = mapHeaders(matrix[index] ?? []);
    const score = Object.keys(columns).length;
    if (score > best.score) best = { index, columns, score };
  }
  return best;
}

function cellToText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return clean(value);
}

/**
 * @param {ArrayBuffer} buffer 檔案內容
 * @returns {{ rows: object[], sheetName: string, headerRow: number, skipped: number }}
 */
export function parseWorkbook(buffer) {
  const bytes = new Uint8Array(buffer);
  // .xlsx 是 ZIP（PK）、.xls 是 OLE；其餘視為文字 CSV，先以 UTF-8 解碼，
  // 否則 SheetJS 會用 cp1252 解讀，中文會變成亂碼。
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  let workbook;
  try {
    if (isZip || isOle) {
      workbook = XLSX.read(bytes, { type: 'array' });
    } else {
      const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
      workbook = XLSX.read(text, { type: 'string' });
    }
  } catch {
    throw new Error('無法解析這個檔案，請確認是有效的 .xlsx / .xls / .csv。');
  }

  let picked = null;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) continue;
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
    if (!matrix.length) continue;
    const header = detectHeaderRow(matrix);
    if (header.score >= 2) {
      picked = { sheetName, matrix, header };
      break;
    }
  }

  if (!picked) {
    throw new Error('找不到可辨識的欄位標題，請確認第一列包含「工號、中文姓名、Email」等欄位。');
  }

  const { sheetName, matrix, header } = picked;
  const { columns, index: headerRow } = header;
  const rows = [];
  let skipped = 0;

  for (let rowIndex = headerRow + 1; rowIndex < matrix.length; rowIndex += 1) {
    const source = matrix[rowIndex] ?? [];
    const record = {};
    for (const [field] of FIELDS) {
      const columnIndex = columns[field];
      record[field] = columnIndex === undefined ? '' : cellToText(source[columnIndex]);
    }
    record.phone = normalizePhone(record.phone);
    record.email = record.email.replace(/\s+/g, '');

    const hasIdentity = record.employee_id || record.name_zh || record.name_en;
    if (!hasIdentity) {
      skipped += 1;
      continue;
    }
    record.sourceRow = rowIndex + 1;
    rows.push(record);
  }

  if (!rows.length) {
    throw new Error('檔案讀取成功，但沒有找到任何員工資料列。');
  }

  return { rows, sheetName, headerRow: headerRow + 1, skipped };
}
