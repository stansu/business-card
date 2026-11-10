/**
 * 名片批次產生器 — 主程式
 * 流程：上傳 Excel → 解析 → 搜尋／勾選 → 依勾選名單輸出單張雙語 SVG
 */

import './style.css';
import {
  renderCard,
  buildFileName,
  templateFile,
  validateTemplate,
  CARD_TEMPLATE,
} from './templates.js';
import { parseWorkbook } from './excel.js';

const BRAND_KEY = 'business-card-brand-v3';
const TEMPLATE_KEY = 'business-card-template-v1';
const MAX_TEMPLATE_BYTES = 400 * 1024;

// 預設值取自示意資料；使用者可在「公司資訊」面板修改，設定會存在瀏覽器裡。
const DEFAULT_BRAND = {
  company_zh: '範例科技股份有限公司',
  company_en: 'EXAMPLE TECHNOLOGY CO., LTD.',
  tel: '886 2 1234 5678',
  fax: '886 2 1234 5679',
  website: 'www.example.com',
};

const $ = (id) => document.getElementById(id);

const el = {
  fileInput: $('file-input'),
  dropzone: $('dropzone'),
  fileMeta: $('file-meta'),
  fileName: $('file-name'),
  fileStats: $('file-stats'),
  reloadBtn: $('reload-btn'),
  sampleLink: $('sample-link'),
  brandInputs: [...document.querySelectorAll('[data-brand]')],
  resetBrand: $('reset-brand'),
  templateStatus: $('template-status'),
  downloadTemplate: $('download-template'),
  uploadTemplate: $('upload-template'),
  resetTemplate: $('reset-template'),
  templateInput: $('template-input'),
  search: $('search'),
  selectAll: $('select-all'),
  clearSelection: $('clear-selection'),
  downloadBtn: $('download-btn'),
  downloadLabel: $('dl-label'),
  downloadCount: $('dl-count'),
  tbody: $('employee-tbody'),
  table: document.querySelector('.table-panel table'),
  empty: $('empty-state'),
  emptyTitle: document.querySelector('#empty-state .empty-title'),
  emptySub: document.querySelector('#empty-state .empty-sub'),
  status: $('status-line'),
  toast: $('toast'),
  dialog: $('preview-dialog'),
  previewTitle: $('preview-title'),
  previewSub: $('preview-sub'),
  previewImage: $('preview-image'),
  previewClose: $('preview-close'),
  previewDownload: $('preview-download'),
};

const state = {
  rows: [],
  selected: new Set(),
  query: '',
  brand: loadBrand(),
  template: loadTemplate(),
  preview: null,
  busy: false,
};

/* ────────────────────────── 公司資訊 ────────────────────────── */

function loadBrand() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRAND_KEY) ?? '{}');
    const merged = { ...DEFAULT_BRAND };
    for (const key of Object.keys(DEFAULT_BRAND)) {
      if (typeof saved[key] === 'string') merged[key] = saved[key];
    }
    return merged;
  } catch {
    return { ...DEFAULT_BRAND };
  }
}

function saveBrand() {
  try {
    localStorage.setItem(BRAND_KEY, JSON.stringify(state.brand));
  } catch {
    /* 無痕模式可能無法寫入，忽略即可 */
  }
}

function syncBrandInputs() {
  for (const input of el.brandInputs) {
    input.value = state.brand[input.dataset.brand] ?? '';
  }
}

el.brandInputs.forEach((input) => {
  input.addEventListener('input', () => {
    state.brand[input.dataset.brand] = input.value;
    saveBrand();
    if (el.dialog.open && state.preview) {
      openPreview(state.preview, { keepOpen: true });
    }
  });
});

el.resetBrand.addEventListener('click', () => {
  state.brand = { ...DEFAULT_BRAND };
  syncBrandInputs();
  saveBrand();
  if (el.dialog.open && state.preview) openPreview(state.preview, { keepOpen: true });
  showToast('已還原預設公司資訊。');
});

/* ────────────────────────── 名片版型 ────────────────────────── */

function activeTemplate() {
  return state.template || CARD_TEMPLATE;
}

function loadTemplate() {
  try {
    const saved = localStorage.getItem(TEMPLATE_KEY);
    if (!saved) return null;
    return validateTemplate(saved) ? null : saved;
  } catch {
    return null;
  }
}

function updateTemplateUI() {
  if (state.template) {
    const kb = (state.template.length / 1024).toFixed(1);
    el.templateStatus.textContent = `使用自訂版型（${kb} KB）`;
  } else {
    el.templateStatus.textContent = '使用預設版型';
  }
  el.resetTemplate.disabled = !state.template;
}

el.downloadTemplate.addEventListener('click', () => {
  triggerDownload(templateFile(activeTemplate()), 'business-card-template.svg');
  showToast('已下載版型，可用 Illustrator／Inkscape 修改後再上傳。');
});

el.uploadTemplate.addEventListener('click', () => el.templateInput.click());

el.templateInput.addEventListener('change', async () => {
  const [file] = el.templateInput.files ?? [];
  el.templateInput.value = '';
  if (!file) return;

  if (!/\.svg$/i.test(file.name)) {
    showToast('請上傳 .svg 版型檔。', 'error');
    return;
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    showToast('版型檔案過大（上限 400 KB）。', 'error');
    return;
  }

  const text = await file.text();
  const error = validateTemplate(text);
  if (error) {
    showToast(error, 'error');
    return;
  }

  state.template = text;
  try {
    localStorage.setItem(TEMPLATE_KEY, text);
  } catch {
    showToast('版型已套用，但瀏覽器無法儲存，重新整理後會回到預設。', 'warn');
  }
  updateTemplateUI();
  if (el.dialog.open && state.preview) openPreview(state.preview, { keepOpen: true });
  showToast('已套用自訂版型。', 'success');
});

el.resetTemplate.addEventListener('click', () => {
  state.template = null;
  try {
    localStorage.removeItem(TEMPLATE_KEY);
  } catch {
    /* ignore */
  }
  updateTemplateUI();
  if (el.dialog.open && state.preview) openPreview(state.preview, { keepOpen: true });
  showToast('已還原預設版型。');
});

/* ────────────────────────── 匯入 ────────────────────────── */

el.sampleLink.href = `${import.meta.env.BASE_URL}sample-employees.xlsx`;

el.dropzone.addEventListener('click', () => el.fileInput.click());
el.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    el.fileInput.click();
  }
});
el.reloadBtn.addEventListener('click', () => el.fileInput.click());

el.fileInput.addEventListener('change', () => {
  const [file] = el.fileInput.files ?? [];
  if (file) loadFile(file);
  el.fileInput.value = '';
});

for (const type of ['dragenter', 'dragover']) {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.add('is-dragging');
  });
}
for (const type of ['dragleave', 'dragend', 'drop']) {
  el.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    el.dropzone.classList.remove('is-dragging');
  });
}
el.dropzone.addEventListener('drop', (event) => {
  const [file] = event.dataTransfer?.files ?? [];
  if (file) loadFile(file);
});

async function loadFile(file) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    showToast('只接受 .xlsx、.xls 或 .csv 檔案。', 'error');
    return;
  }

  el.dropzone.classList.add('is-loading');
  try {
    const buffer = await file.arrayBuffer();
    const { rows, sheetName, skipped } = parseWorkbook(buffer);

    state.rows = rows.map((row, index) => ({ ...row, _id: `emp-${Date.now()}-${index}` }));
    state.selected.clear();
    state.query = '';
    el.search.value = '';

    el.fileName.textContent = file.name;
    el.fileStats.textContent = `${state.rows.length} 位員工 · 工作表「${sheetName}」${
      skipped ? ` · 略過 ${skipped} 個空白列` : ''
    }`;
    el.fileMeta.hidden = false;

    renderTable();
    updateSelectionUI();
    showToast(`已載入 ${state.rows.length} 位員工，開始勾選要輸出的名單。`, 'success');
  } catch (error) {
    console.error(error);
    showToast(error?.message || '匯入失敗，請確認檔案格式。', 'error');
  } finally {
    el.dropzone.classList.remove('is-loading');
  }
}

/* ────────────────────────── 列表 ────────────────────────── */

function filteredRows() {
  const query = state.query.trim().toLowerCase();
  if (!query) return state.rows;
  return state.rows.filter((row) =>
    [row.name_zh, row.name_en, row.employee_id].some((value) =>
      String(value ?? '').toLowerCase().includes(query),
    ),
  );
}

function renderTable() {
  const rows = filteredRows();
  el.tbody.replaceChildren();

  for (const employee of rows) {
    el.tbody.append(createRow(employee));
  }

  const hasData = state.rows.length > 0;
  el.empty.hidden = hasData && rows.length > 0;
  el.table.hidden = !hasData || !rows.length;

  if (!hasData) {
    el.emptyTitle.textContent = '尚未匯入資料';
    el.emptySub.textContent = '上傳 Excel 後，員工名單會出現在這裡。';
  } else if (!rows.length) {
    el.emptyTitle.textContent = '找不到符合的員工';
    el.emptySub.textContent = '換個關鍵字試試，或清空搜尋欄位。';
  }
}

function createRow(employee) {
  const row = document.createElement('tr');
  row.dataset.id = employee._id;
  row.classList.toggle('is-selected', state.selected.has(employee._id));

  const checkCell = document.createElement('td');
  checkCell.className = 'col-check';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.selected.has(employee._id);
  checkbox.setAttribute(
    'aria-label',
    `選取 ${employee.name_zh || employee.name_en || employee.employee_id}`,
  );
  checkbox.addEventListener('change', () => {
    setSelected(employee._id, checkbox.checked);
  });
  checkCell.append(checkbox);

  row.append(
    checkCell,
    textCell(employee.employee_id),
    textCell(employee.name_zh, 'name-zh'),
    textCell(employee.name_en),
    textCell(employee.title_zh || employee.title_en),
    textCell(employee.ext, 'mono'),
    textCell(employee.email, 'mono email'),
    textCell(employee.phone, 'mono'),
  );

  const actionCell = document.createElement('td');
  actionCell.className = 'col-action';
  const previewButton = document.createElement('button');
  previewButton.type = 'button';
  previewButton.className = 'btn tiny ghost';
  previewButton.textContent = '預覽';
  previewButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openPreview(employee);
  });
  actionCell.append(previewButton);
  row.append(actionCell);

  row.addEventListener('click', (event) => {
    if (event.target.closest('button, a, input, label')) return;
    checkbox.checked = !checkbox.checked;
    setSelected(employee._id, checkbox.checked);
  });

  return row;
}

function textCell(value, className = '') {
  const cell = document.createElement('td');
  const text = String(value ?? '').trim();
  if (text) {
    cell.textContent = text;
    cell.title = text;
  } else {
    cell.textContent = '—';
    cell.classList.add('muted-cell');
  }
  if (className) cell.classList.add(...className.split(' ').filter(Boolean));
  return cell;
}

/* ────────────────────────── 勾選 ────────────────────────── */

function setSelected(id, selected) {
  if (selected) state.selected.add(id);
  else state.selected.delete(id);

  const row = el.tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
  if (row) {
    row.classList.toggle('is-selected', selected);
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = selected;
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const visible = filteredRows();
  const visibleSelected = visible.filter((row) => state.selected.has(row._id)).length;
  const count = state.selected.size;

  el.downloadCount.textContent = String(count);
  // 按鈕保持可按：未勾選時點擊會顯示提示（而不是靜默失效）
  el.downloadBtn.disabled = state.busy;
  el.clearSelection.disabled = count === 0;
  el.selectAll.disabled = visible.length === 0;
  el.selectAll.checked = visible.length > 0 && visibleSelected === visible.length;
  el.selectAll.indeterminate = visibleSelected > 0 && visibleSelected < visible.length;

  const parts = [`共 ${state.rows.length} 筆`];
  if (state.query.trim()) parts.push(`符合 ${visible.length} 筆`);
  parts.push(`已勾選 ${count} 筆`);
  el.status.textContent = parts.join(' · ');
}

el.search.addEventListener('input', () => {
  state.query = el.search.value;
  renderTable();
  updateSelectionUI();
});

el.selectAll.addEventListener('change', () => {
  const visible = filteredRows();
  if (el.selectAll.checked) visible.forEach((row) => state.selected.add(row._id));
  else visible.forEach((row) => state.selected.delete(row._id));

  for (const row of el.tbody.querySelectorAll('tr')) {
    const isSelected = state.selected.has(row.dataset.id);
    row.classList.toggle('is-selected', isSelected);
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = isSelected;
  }
  updateSelectionUI();
});

el.clearSelection.addEventListener('click', () => {
  state.selected.clear();
  renderTable();
  updateSelectionUI();
});

/* ────────────────────────── 下載 ────────────────────────── */

el.downloadBtn.addEventListener('click', () => {
  const employees = state.rows.filter((row) => state.selected.has(row._id));
  if (!employees.length) {
    showToast('請先勾選至少一位員工，再點擊下載。', 'warn');
    el.selectAll.focus?.();
    return;
  }
  downloadCards(employees, el.downloadBtn, el.downloadLabel);
});

async function downloadCards(employees, button, label) {
  if (state.busy) return;
  state.busy = true;
  button.disabled = true;
  const originalLabel = label.textContent;
  const template = activeTemplate();
  let files = 0;

  try {
    for (let index = 0; index < employees.length; index += 1) {
      const employee = employees[index];
      label.textContent = `產生中 ${index + 1}/${employees.length}`;

      const svg = renderCard(employee, state.brand, template);
      triggerDownload(svg, buildFileName(employee));
      files += 1;
      // 連續觸發下載時給瀏覽器一點喘息空間，避免被誤判為惡意行為
      await sleep(180);
    }
    showToast(
      `已產生 ${files} 個 SVG 檔。${
        employees.length > 1 ? '若瀏覽器詢問「允許多重下載」，請選擇允許。' : ''
      }`,
      'success',
    );
  } catch (error) {
    console.error(error);
    showToast('產生名片時發生錯誤，請再試一次。', 'error');
  } finally {
    state.busy = false;
    label.textContent = originalLabel;
    button.disabled = false;
  }
}

function triggerDownload(svgText, filename) {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ────────────────────────── 預覽 ────────────────────────── */

function openPreview(employee, { keepOpen = false } = {}) {
  state.preview = employee;
  const svg = renderCard(employee, state.brand, activeTemplate());

  el.previewImage.src = svgToDataUrl(svg);
  el.previewTitle.textContent = employee.name_zh || employee.name_en || '名片預覽';
  el.previewSub.textContent = [
    employee.title_zh || employee.title_en,
    employee.employee_id,
    employee.phone ? employee.phone : '無手機號碼',
  ]
    .filter(Boolean)
    .join(' · ');

  if (!keepOpen && !el.dialog.open) el.dialog.showModal();
}

el.previewClose.addEventListener('click', () => el.dialog.close());
el.dialog.addEventListener('click', (event) => {
  if (event.target === el.dialog) el.dialog.close();
});
el.previewDownload.addEventListener('click', () => {
  if (!state.preview) return;
  downloadCards([state.preview], el.previewDownload, el.previewDownload);
});

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ────────────────────────── 提示訊息 ────────────────────────── */

let toastTimer;
function showToast(message, tone = 'info') {
  window.clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.className = `toast is-visible${tone !== 'info' ? ` is-${tone}` : ''}`;
  toastTimer = window.setTimeout(() => {
    el.toast.className = 'toast';
  }, 4200);
}

/* ────────────────────────── 初始化 ────────────────────────── */

syncBrandInputs();
updateTemplateUI();
renderTable();
updateSelectionUI();
