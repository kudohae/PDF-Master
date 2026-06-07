'use strict';

/* ============================================================
   PDF Master — app.js
   All PDF processing happens client-side. No data is sent to
   any server.
   ============================================================ */

// PDF.js worker (CDN must match the loaded library version)
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Wait until both libraries are available
window.addEventListener('DOMContentLoaded', () => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  App.init();
});

/* ============================================================
   TOAST — non-blocking user notifications
   ============================================================ */
const Toast = (() => {
  const container = () => document.getElementById('toast-container');

  const ICONS = {
    success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.707 7.293a1 1 0 0 0-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 11.414l1.293 1.293a1 1 0 0 0 1.414-1.414L11.414 10l1.293-1.293a1 1 0 0 0-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    warn:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z" clip-rule="evenodd"/></svg>`,
    info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clip-rule="evenodd"/></svg>`,
  };

  function show(type, title, desc = '', duration = 4000) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type]}</span>
      <div class="toast-body">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${desc ? `<div class="toast-desc">${escapeHtml(desc)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="닫기">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clip-rule="evenodd"/></svg>
      </button>`;
    el.querySelector('.toast-close').addEventListener('click', () => dismiss(el));
    container().appendChild(el);
    if (duration > 0) setTimeout(() => dismiss(el), duration);
  }

  function dismiss(el) {
    if (!el.parentNode) return;
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  return {
    success: (t, d) => show('success', t, d),
    error:   (t, d) => show('error',   t, d, 6000),
    warn:    (t, d) => show('warn',    t, d),
    info:    (t, d) => show('info',    t, d),
  };
})();

/* ============================================================
   PROGRESS — modal overlay with progress bar
   ============================================================ */
const Progress = (() => {
  let overlay, msgEl, barEl, detailEl;

  function init() {
    overlay  = document.getElementById('progress-overlay');
    msgEl    = document.getElementById('progress-message');
    barEl    = document.getElementById('progress-bar');
    detailEl = document.getElementById('progress-detail');
  }

  function show(msg = '처리 중...') {
    msgEl.textContent    = msg;
    barEl.style.width    = '0%';
    detailEl.textContent = '';
    overlay.classList.remove('hidden');
  }

  function update(pct, detail = '') {
    barEl.style.width    = `${Math.min(100, Math.max(0, pct))}%`;
    detailEl.textContent = detail;
  }

  function hide() {
    overlay.classList.add('hidden');
  }

  return { init, show, update, hide };
})();

/* ============================================================
   UTILS — shared helper functions
   ============================================================ */
const Utils = {
  /** Read File as ArrayBuffer */
  readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`파일을 읽을 수 없습니다: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  },

  /** Read File as DataURL */
  readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`파일을 읽을 수 없습니다: ${file.name}`));
      reader.readAsDataURL(file);
    });
  },

  /** Trigger browser download of Uint8Array as PDF */
  downloadPDF(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  /** Format bytes to human-readable string */
  formatSize(bytes) {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  },

  /** Parse page range string like "1, 3-5, 7" into sorted unique 1-based page numbers */
  parsePageRange(str, totalPages) {
    const pages = new Set();
    const parts = str.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        if (isNaN(a) || isNaN(b) || a < 1 || b > totalPages || a > b) return null;
        for (let i = a; i <= b; i++) pages.add(i);
      } else {
        const n = Number(part);
        if (isNaN(n) || n < 1 || n > totalPages) return null;
        pages.add(n);
      }
    }
    return [...pages].sort((a, b) => a - b);
  },

  /** Strip extension from filename */
  stripExt(name) {
    return name.replace(/\.[^.]+$/, '');
  },

  /** Yield to browser event loop to keep UI responsive */
  yield() {
    return new Promise(r => setTimeout(r, 0));
  },
};

/* ============================================================
   PDF RENDERER — generates canvas thumbnails via PDF.js
   ============================================================ */
const PDFRenderer = {
  /**
   * Load PDF bytes into a PDF.js document.
   * Returns the pdf document object.
   */
  async load(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    return await pdfjsLib.getDocument({ data }).promise;
  },

  /**
   * Render a single PDF page to a new <canvas> element.
   * @param {Object} pdfDoc - PDF.js document
   * @param {number} pageNum - 1-based page number
   * @param {number} maxWidth - max canvas width in px
   */
  async renderPage(pdfDoc, pageNum, maxWidth = 160) {
    const page     = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const scale    = maxWidth / viewport.width;
    const scaled   = page.getViewport({ scale });

    const canvas  = document.createElement('canvas');
    canvas.width  = scaled.width;
    canvas.height = scaled.height;
    const ctx     = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: scaled }).promise;
    return canvas;
  },

  /**
   * Render all pages and call onPage(pageNum, canvas) after each.
   * Yields to browser between pages so UI stays responsive.
   */
  async renderAll(pdfDoc, maxWidth, onPage) {
    const total = pdfDoc.numPages;
    for (let i = 1; i <= total; i++) {
      const canvas = await this.renderPage(pdfDoc, i, maxWidth);
      onPage(i, canvas);
      await Utils.yield();
    }
  },
};

/* ============================================================
   DRAG-AND-DROP SORT — reusable sortable list / grid
   ============================================================ */

/**
 * Make elements inside `container` draggable and sortable.
 * Children must have class `.thumb-card` or `.file-item`.
 * Calls `onSort(newOrder: number[])` with 0-based indices of the
 * new order after a drag completes.
 */
function makeSortable(container, itemSelector, onSort) {
  let dragging = null;

  container.addEventListener('dragstart', e => {
    const item = e.target.closest(itemSelector);
    if (!item) return;
    dragging = item;
    setTimeout(() => item.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('dragging');
    container.querySelectorAll(itemSelector)
      .forEach(el => el.classList.remove('drag-over-card', 'drag-over-item'));
    dragging = null;
    // Build new order as original data-index values
    const order = [...container.querySelectorAll(itemSelector)]
      .map(el => parseInt(el.dataset.index, 10));
    onSort(order);
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest(itemSelector);
    if (!target || target === dragging) return;
    container.querySelectorAll(itemSelector)
      .forEach(el => el.classList.remove('drag-over-card', 'drag-over-item'));
    target.classList.add(target.classList.contains('file-item')
      ? 'drag-over-item' : 'drag-over-card');
  });

  container.addEventListener('dragleave', e => {
    const target = e.target.closest(itemSelector);
    if (target) target.classList.remove('drag-over-card', 'drag-over-item');
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest(itemSelector);
    if (!target || target === dragging || !dragging) return;
    target.classList.remove('drag-over-card', 'drag-over-item');

    // Insert dragging before or after target based on cursor position
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const midX = rect.left + rect.width / 2;
    const afterTarget = (container.classList.contains('file-list'))
      ? e.clientY > midY
      : e.clientX > midX;

    if (afterTarget) {
      target.after(dragging);
    } else {
      target.before(dragging);
    }
  });
}

/* ============================================================
   DROP ZONE setup — bind click and drag-drop to file input
   ============================================================ */
function setupDropZone(zoneEl, inputEl, onFiles, multiple = true) {
  // Click anywhere in zone triggers file input
  zoneEl.addEventListener('click', e => {
    if (e.target.tagName === 'LABEL') return; // label handles it
    inputEl.click();
  });

  zoneEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputEl.click(); }
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFiles(Array.from(inputEl.files));
    inputEl.value = '';
  });

  zoneEl.addEventListener('dragover', e => {
    e.preventDefault();
    zoneEl.classList.add('drag-over');
  });
  zoneEl.addEventListener('dragleave', e => {
    if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over');
  });
  zoneEl.addEventListener('drop', e => {
    e.preventDefault();
    zoneEl.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => validateDropFile(f, inputEl));
    if (files.length) onFiles(multiple ? files : [files[0]]);
  });
}

function validateDropFile(file, inputEl) {
  const accept = inputEl.getAttribute('accept') || '';
  if (!accept) return true;
  const types = accept.split(',').map(s => s.trim());
  return types.some(t => {
    if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t);
    if (t.endsWith('/*')) return file.type.startsWith(t.slice(0, -1));
    return file.type === t;
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const Nav = {
  init() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => Nav.switchTo(btn.dataset.tool));
    });
  },
  switchTo(toolId) {
    document.querySelectorAll('.nav-item').forEach(b => {
      const active = b.dataset.tool === toolId;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('.tool-panel').forEach(p => {
      p.classList.toggle('active', p.id === toolId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

/* ============================================================
   THEME TOGGLE
   ============================================================ */
function initTheme() {
  const stored = localStorage.getItem('pdf-master-theme');
  const prefer = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(stored || prefer);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });
}
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('pdf-master-theme', theme);
}

/* ============================================================
   HELPER — escape HTML for safe text insertion
   ============================================================ */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   HELPER — build a page thumbnail card element
   ============================================================ */
function buildThumbCard({ index, label, canvas, selectable, removable, rotation = 0 }) {
  const card   = document.createElement('div');
  card.className = 'thumb-card';
  card.dataset.index = index;
  card.setAttribute('draggable', !selectable);
  card.setAttribute('role', 'listitem');
  card.setAttribute('data-rotation', rotation);

  const wrap   = document.createElement('div');
  wrap.className = 'thumb-canvas-wrap';

  if (canvas) {
    wrap.appendChild(canvas);
  } else {
    // skeleton placeholder
    const sk = document.createElement('div');
    sk.className = 'thumb-skeleton';
    wrap.appendChild(sk);
  }

  const labelEl = document.createElement('div');
  labelEl.className = 'thumb-label';
  labelEl.textContent = label;

  // Rotation badge
  const badge = document.createElement('div');
  badge.className = 'thumb-rotation-badge';
  badge.textContent = rotation ? `${rotation}°` : '';

  // Selection checkmark
  const check = document.createElement('div');
  check.className = 'thumb-check';
  check.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1.5,6 5,9.5 10.5,2.5"/></svg>`;
  check.setAttribute('aria-hidden', 'true');

  card.append(wrap, badge, check, labelEl);

  // Remove button (image-to-pdf only)
  if (removable) {
    const btn = document.createElement('button');
    btn.className = 'thumb-remove';
    btn.setAttribute('aria-label', '제거');
    btn.innerHTML = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>`;
    card.appendChild(btn);
  }

  return card;
}

/* ============================================================
   FEATURE 1 — IMAGE TO PDF
   ============================================================ */
const ImageToPDF = (() => {
  // State holds ordered array of { file, dataURL } objects
  const state = { items: [] };

  function init() {
    const zone  = document.getElementById('itp-dropzone');
    const input = document.getElementById('itp-input');
    const addInput = document.getElementById('itp-add-input');

    setupDropZone(zone, input, handleFiles);

    document.getElementById('itp-add-more').addEventListener('click', () => addInput.click());
    addInput.addEventListener('change', () => {
      if (addInput.files.length) handleFiles(Array.from(addInput.files));
      addInput.value = '';
    });
    document.getElementById('itp-reset').addEventListener('click', reset);
    document.getElementById('itp-generate').addEventListener('click', generate);

    makeSortable(
      document.getElementById('itp-grid'),
      '.thumb-card',
      newOrder => { state.items = newOrder.map(i => state.items[i]); }
    );
  }

  async function handleFiles(files) {
    const allowed = files.filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    if (!allowed.length) { Toast.warn('지원하지 않는 파일 형식', 'JPG, PNG, WEBP만 지원합니다.'); return; }

    for (const file of allowed) {
      const dataURL = await Utils.readAsDataURL(file);
      state.items.push({ file, dataURL });
    }
    renderPreviews();
  }

  function renderPreviews() {
    const grid    = document.getElementById('itp-grid');
    const toolbar = document.getElementById('itp-toolbar');
    const actions = document.getElementById('itp-actions');

    grid.innerHTML = '';
    state.items.forEach((item, idx) => {
      const card = buildThumbCard({ index: idx, label: item.file.name, selectable: false, removable: true });
      // Replace skeleton with real image
      const img = document.createElement('img');
      img.src       = item.dataURL;
      img.className = 'img-thumb';
      img.alt       = item.file.name;
      card.querySelector('.thumb-canvas-wrap').replaceChildren(img);
      card.setAttribute('draggable', 'true');

      // Remove button
      card.querySelector('.thumb-remove').addEventListener('click', e => {
        e.stopPropagation();
        state.items.splice(idx, 1);
        renderPreviews();
      });

      grid.appendChild(card);
    });

    const hasItems = state.items.length > 0;
    toolbar.classList.toggle('hidden', !hasItems);
    actions.classList.toggle('hidden', !hasItems);
    document.getElementById('itp-count').textContent =
      `${state.items.length}개 이미지 선택됨`;
    // Hide drop zone once items added
    document.getElementById('itp-dropzone').classList.toggle('hidden', hasItems);
  }

  async function generate() {
    if (!state.items.length) return;
    Progress.show('PDF 생성 중...');
    try {
      const { PDFDocument } = PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < state.items.length; i++) {
        const { file, dataURL } = state.items[i];
        Progress.update(
          ((i + 1) / state.items.length) * 90,
          `이미지 처리 중 ${i + 1}/${state.items.length}: ${file.name}`
        );
        await Utils.yield();

        const bytes = await Utils.readAsArrayBuffer(file);
        let image;
        if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(bytes);
        } else {
          // jpeg and webp treated as jpeg by pdf-lib
          image = await pdfDoc.embedJpg(bytes);
        }

        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      }

      Progress.update(95, '파일 저장 중...');
      const pdfBytes = await pdfDoc.save();
      Progress.update(100);
      Utils.downloadPDF(pdfBytes, 'images-to-pdf.pdf');
      Toast.success('PDF 생성 완료', `${state.items.length}개 이미지 → PDF 다운로드가 시작되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('PDF 생성 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function reset() {
    state.items = [];
    document.getElementById('itp-grid').innerHTML = '';
    document.getElementById('itp-toolbar').classList.add('hidden');
    document.getElementById('itp-actions').classList.add('hidden');
    document.getElementById('itp-dropzone').classList.remove('hidden');
  }

  return { init };
})();

/* ============================================================
   FEATURE 2 — PDF MERGE
   ============================================================ */
const MergePDF = (() => {
  const state = { items: [] }; // { file, size }

  function init() {
    setupDropZone(
      document.getElementById('mp-dropzone'),
      document.getElementById('mp-input'),
      handleFiles
    );
    const addInput = document.getElementById('mp-add-input');
    document.getElementById('mp-add-more').addEventListener('click', () => addInput.click());
    addInput.addEventListener('change', () => {
      if (addInput.files.length) handleFiles(Array.from(addInput.files));
      addInput.value = '';
    });
    document.getElementById('mp-reset').addEventListener('click', reset);
    document.getElementById('mp-generate').addEventListener('click', generate);
    makeSortable(
      document.getElementById('mp-list'),
      '.file-item',
      newOrder => { state.items = newOrder.map(i => state.items[i]); }
    );
  }

  function handleFiles(files) {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (!pdfs.length) { Toast.warn('PDF 파일만 추가 가능합니다.'); return; }
    pdfs.forEach(f => state.items.push({ file: f }));
    renderList();
  }

  function renderList() {
    const list    = document.getElementById('mp-list');
    const toolbar = document.getElementById('mp-toolbar');
    const actions = document.getElementById('mp-actions');

    list.innerHTML = '';
    state.items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className    = 'file-item';
      li.dataset.index = idx;
      li.setAttribute('draggable', 'true');
      li.innerHTML = `
        <span class="drag-handle" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6-10a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
        </span>
        <span class="file-item-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" clip-rule="evenodd"/></svg>
        </span>
        <span class="file-item-name" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span>
        <span class="file-item-meta">${Utils.formatSize(item.file.size)}</span>
        <button class="file-item-remove" data-idx="${idx}" aria-label="목록에서 제거">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
        </button>`;
      li.querySelector('.file-item-remove').addEventListener('click', () => {
        state.items.splice(idx, 1);
        renderList();
      });
      list.appendChild(li);
    });

    const has = state.items.length > 1;
    toolbar.classList.toggle('hidden', !state.items.length);
    actions.classList.toggle('hidden', !has);
    document.getElementById('mp-dropzone').classList.toggle('hidden', state.items.length > 0);
    document.getElementById('mp-count').textContent = `${state.items.length}개 PDF 선택됨`;

    if (has) {
      document.getElementById('mp-info').textContent =
        `총 ${state.items.length}개 PDF → 하나의 PDF로 병합`;
    }
  }

  async function generate() {
    if (state.items.length < 2) return;
    Progress.show('PDF 병합 중...');
    try {
      const { PDFDocument } = PDFLib;
      const merged = await PDFDocument.create();

      for (let i = 0; i < state.items.length; i++) {
        Progress.update(
          ((i + 1) / state.items.length) * 90,
          `파일 처리 중 ${i + 1}/${state.items.length}: ${state.items[i].file.name}`
        );
        await Utils.yield();
        const bytes = await Utils.readAsArrayBuffer(state.items[i].file);
        const src   = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }

      Progress.update(95, '파일 저장 중...');
      const pdfBytes = await merged.save();
      Progress.update(100);
      Utils.downloadPDF(pdfBytes, 'merged.pdf');
      Toast.success('PDF 병합 완료', `${state.items.length}개 파일이 병합되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('PDF 병합 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function reset() {
    state.items = [];
    document.getElementById('mp-list').innerHTML = '';
    document.getElementById('mp-toolbar').classList.add('hidden');
    document.getElementById('mp-actions').classList.add('hidden');
    document.getElementById('mp-dropzone').classList.remove('hidden');
  }

  return { init };
})();

/* ============================================================
   SHARED — PDF page thumbnail viewer (delete / reorder /
   extract / rotate panels all share this pattern)
   ============================================================ */

/**
 * Generic single-PDF tool setup.
 * @param {Object} cfg - configuration object
 */
function createSinglePDFTool({
  id,           // tool id (e.g. 'dp')
  dropzoneId,   // e.g. 'dp-dropzone'
  inputId,      // e.g. 'dp-input'
  gridId,       // thumbnail grid element id
  toolbarId,
  actionsId,
  infoId,       // span showing filename + page count
  selectedId,   // span showing selected count (optional)
  resetId,
  selectable,   // boolean: clicking selects cards
  sortable,     // boolean: dragging reorders cards
  onReset,      // callback to clear extra state
  onThumbClick, // callback(card, index) for selectable tools
  onSort,       // callback(newOrder) for sortable tools
}) {
  const state = { pdfDoc: null, file: null, pdfBytes: null };

  setupDropZone(
    document.getElementById(dropzoneId),
    document.getElementById(inputId),
    files => handleFile(files[0]),
    false
  );

  document.getElementById(resetId).addEventListener('click', () => {
    reset();
    onReset && onReset(state);
  });

  async function handleFile(file) {
    if (!file) return;
    Progress.show('PDF 로드 중...');
    try {
      const bytes = await Utils.readAsArrayBuffer(file);
      state.pdfBytes = bytes;
      state.file     = file;
      state.pdfDoc   = await PDFRenderer.load(bytes);

      const total = state.pdfDoc.numPages;
      document.getElementById(infoId).textContent =
        `${file.name}  ·  ${total}페이지`;

      document.getElementById(dropzoneId).classList.add('hidden');
      document.getElementById(toolbarId).classList.remove('hidden');
      document.getElementById(actionsId).classList.remove('hidden');

      renderThumbnails(state, gridId, selectable, sortable, onThumbClick, onSort, selectedId);
    } catch (err) {
      console.error(err);
      Toast.error('PDF 로드 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function reset() {
    state.pdfDoc  = null;
    state.file    = null;
    state.pdfBytes = null;
    document.getElementById(gridId).innerHTML = '';
    document.getElementById(toolbarId).classList.add('hidden');
    document.getElementById(actionsId).classList.add('hidden');
    document.getElementById(dropzoneId).classList.remove('hidden');
    if (selectedId) document.getElementById(selectedId).textContent = '';
  }

  return state;
}

async function renderThumbnails(state, gridId, selectable, sortable, onThumbClick, onSort, selectedId) {
  const grid  = document.getElementById(gridId);
  const total = state.pdfDoc.numPages;
  grid.innerHTML = '';

  // Build card shells immediately, fill thumbnails progressively
  for (let i = 0; i < total; i++) {
    const card = buildThumbCard({
      index:      i,
      label:      `페이지 ${i + 1}`,
      canvas:     null,     // skeleton until rendered
      selectable,
      removable:  false,
      rotation:   state.rotations ? (state.rotations[i] || 0) : 0,
    });
    card.setAttribute('draggable', sortable ? 'true' : 'false');
    if (selectable && onThumbClick) {
      card.addEventListener('click', () => onThumbClick(card, i, state, selectedId));
    }
    grid.appendChild(card);
  }

  if (sortable && onSort) {
    makeSortable(grid, '.thumb-card', newOrder => onSort(newOrder, state));
  }

  // Render thumbnails in the background
  await PDFRenderer.renderAll(state.pdfDoc, 160, (pageNum, canvas) => {
    const card = grid.children[pageNum - 1];
    if (!card) return;
    const wrap = card.querySelector('.thumb-canvas-wrap');
    wrap.replaceChildren(canvas);
  });
}

/* ============================================================
   FEATURE 3 — DELETE PAGES
   ============================================================ */
const DeletePages = (() => {
  const extra = { selected: new Set() };

  function onThumbClick(card, index, state, selectedId) {
    if (extra.selected.has(index)) {
      extra.selected.delete(index);
      card.classList.remove('selected');
    } else {
      extra.selected.add(index);
      card.classList.add('selected');
    }
    updateActionInfo(state);
    if (selectedId) {
      document.getElementById(selectedId).textContent =
        extra.selected.size ? `${extra.selected.size}페이지 선택됨` : '';
    }
  }

  function updateActionInfo(state) {
    const total   = state.pdfDoc ? state.pdfDoc.numPages : 0;
    const delCnt  = extra.selected.size;
    const remain  = total - delCnt;
    const infoEl  = document.getElementById('dp-action-info');
    if (infoEl) {
      infoEl.textContent = delCnt
        ? `${total}페이지 중 ${delCnt}페이지 삭제 → ${remain}페이지 남음`
        : '삭제할 페이지를 선택하세요.';
    }
    document.getElementById('dp-generate').disabled = delCnt === 0 || remain === 0;
  }

  const state = createSinglePDFTool({
    id: 'dp', dropzoneId: 'dp-dropzone', inputId: 'dp-input',
    gridId: 'dp-grid', toolbarId: 'dp-toolbar', actionsId: 'dp-actions',
    infoId: 'dp-info', selectedId: 'dp-selected', resetId: 'dp-reset',
    selectable: true, sortable: false,
    onReset: () => { extra.selected.clear(); updateActionInfo({}); },
    onThumbClick,
    onSort: null,
  });

  function init() {
    document.getElementById('dp-select-all').addEventListener('click', () => {
      if (!state.pdfDoc) return;
      for (let i = 0; i < state.pdfDoc.numPages; i++) extra.selected.add(i);
      document.querySelectorAll('#dp-grid .thumb-card')
        .forEach(c => c.classList.add('selected'));
      document.getElementById('dp-selected').textContent = `${extra.selected.size}페이지 선택됨`;
      updateActionInfo(state);
    });
    document.getElementById('dp-deselect-all').addEventListener('click', () => {
      extra.selected.clear();
      document.querySelectorAll('#dp-grid .thumb-card')
        .forEach(c => c.classList.remove('selected'));
      document.getElementById('dp-selected').textContent = '';
      updateActionInfo(state);
    });
    document.getElementById('dp-generate').addEventListener('click', () => generate(state));
  }

  async function generate(state) {
    if (!state.pdfDoc || !extra.selected.size) return;
    const toDelete = extra.selected;
    const total    = state.pdfDoc.numPages;
    if (toDelete.size === total) {
      Toast.warn('전체 페이지를 삭제할 수 없습니다.', '최소 1페이지는 남아야 합니다.');
      return;
    }

    Progress.show('페이지 삭제 중...');
    try {
      const { PDFDocument } = PDFLib;
      const src  = await PDFDocument.load(state.pdfBytes);
      const dest = await PDFDocument.create();

      const keepIndices = [];
      for (let i = 0; i < total; i++) {
        if (!toDelete.has(i)) keepIndices.push(i);
      }

      Progress.update(40, `${keepIndices.length}페이지 복사 중...`);
      const pages = await dest.copyPages(src, keepIndices);
      pages.forEach(p => dest.addPage(p));

      Progress.update(90, '저장 중...');
      const bytes = await dest.save();
      Progress.update(100);
      Utils.downloadPDF(bytes, `${Utils.stripExt(state.file.name)}_deleted.pdf`);
      Toast.success('저장 완료', `${toDelete.size}페이지가 삭제된 PDF가 다운로드되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('처리 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  return { init };
})();

/* ============================================================
   FEATURE 4 — REORDER PAGES
   ============================================================ */
const ReorderPages = (() => {
  const extra = { pageOrder: [] };

  function onSort(newOrder) {
    extra.pageOrder = newOrder;
  }

  const state = createSinglePDFTool({
    id: 'rp', dropzoneId: 'rp-dropzone', inputId: 'rp-input',
    gridId: 'rp-grid', toolbarId: 'rp-toolbar', actionsId: 'rp-actions',
    infoId: 'rp-info', selectedId: null, resetId: 'rp-reset',
    selectable: false, sortable: true,
    onReset: () => { extra.pageOrder = []; },
    onThumbClick: null,
    onSort: (newOrder) => { extra.pageOrder = newOrder; },
  });

  // Initialize default page order after file load
  const origHandleFile = state._handleFile;

  function init() {
    document.getElementById('rp-generate').addEventListener('click', () => generate(state));
  }

  async function generate(state) {
    if (!state.pdfDoc) return;
    Progress.show('페이지 재정렬 중...');
    try {
      const { PDFDocument } = PDFLib;
      const src  = await PDFDocument.load(state.pdfBytes);
      const dest = await PDFDocument.create();

      // Use dragged order if set, otherwise natural order
      const order = extra.pageOrder.length
        ? extra.pageOrder
        : Array.from({ length: state.pdfDoc.numPages }, (_, i) => i);

      Progress.update(40, `${order.length}페이지 재배열 중...`);
      const pages = await dest.copyPages(src, order);
      pages.forEach(p => dest.addPage(p));

      Progress.update(90, '저장 중...');
      const bytes = await dest.save();
      Progress.update(100);
      Utils.downloadPDF(bytes, `${Utils.stripExt(state.file.name)}_reordered.pdf`);
      Toast.success('저장 완료', '재정렬된 PDF가 다운로드되었습니다.');
    } catch (err) {
      console.error(err);
      Toast.error('처리 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  return { init };
})();

/* ============================================================
   FEATURE 5 — INSERT PAGES
   ============================================================ */
const InsertPages = (() => {
  const state = { baseBytes: null, baseFile: null, basePDF: null,
                  insertBytes: null, insertFile: null, insertPDF: null };

  function init() {
    setupDropZone(
      document.getElementById('ip-base-dropzone'),
      document.getElementById('ip-base-input'),
      files => handleBase(files[0]), false
    );
    setupDropZone(
      document.getElementById('ip-insert-dropzone'),
      document.getElementById('ip-insert-input'),
      files => handleInsert(files[0]), false
    );
    document.getElementById('ip-reset').addEventListener('click', reset);
    document.getElementById('ip-generate').addEventListener('click', generate);
  }

  async function handleBase(file) {
    if (!file) return;
    Progress.show('기본 PDF 로드 중...');
    try {
      const bytes = await Utils.readAsArrayBuffer(file);
      const pdf   = await PDFRenderer.load(bytes);
      state.baseBytes = bytes;
      state.baseFile  = file;
      state.basePDF   = pdf;
      document.getElementById('ip-base-info').textContent =
        `${file.name}  ·  ${pdf.numPages}페이지`;
      document.getElementById('ip-base-info').classList.remove('hidden');
      document.getElementById('ip-position').max = pdf.numPages;
      document.getElementById('ip-position-hint').textContent =
        `번 뒤에 삽입 (0 = 맨 앞, 최대 ${pdf.numPages})`;
      checkReady();
    } catch (err) {
      Toast.error('파일 로드 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  async function handleInsert(file) {
    if (!file) return;
    Progress.show('삽입할 PDF 로드 중...');
    try {
      const bytes = await Utils.readAsArrayBuffer(file);
      const pdf   = await PDFRenderer.load(bytes);
      state.insertBytes = bytes;
      state.insertFile  = file;
      state.insertPDF   = pdf;
      document.getElementById('ip-insert-info').textContent =
        `${file.name}  ·  ${pdf.numPages}페이지`;
      document.getElementById('ip-insert-info').classList.remove('hidden');
      checkReady();
    } catch (err) {
      Toast.error('파일 로드 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function checkReady() {
    const ready = state.basePDF && state.insertPDF;
    document.getElementById('ip-controls').classList.toggle('hidden', !ready);
    document.getElementById('ip-actions').classList.toggle('hidden', !ready);
    if (ready) {
      document.getElementById('ip-action-info').textContent =
        `기본 ${state.basePDF.numPages}페이지 + 삽입 ${state.insertPDF.numPages}페이지 = 결과 ${state.basePDF.numPages + state.insertPDF.numPages}페이지`;
    }
  }

  async function generate() {
    if (!state.basePDF || !state.insertPDF) return;
    const pos = parseInt(document.getElementById('ip-position').value, 10) || 0;
    const baseTotal = state.basePDF.numPages;

    if (pos < 0 || pos > baseTotal) {
      Toast.warn('잘못된 삽입 위치', `0~${baseTotal} 사이의 값을 입력하세요.`);
      return;
    }

    Progress.show('페이지 삽입 중...');
    try {
      const { PDFDocument } = PDFLib;
      const baseSrc   = await PDFDocument.load(state.baseBytes);
      const insertSrc = await PDFDocument.load(state.insertBytes);
      const dest      = await PDFDocument.create();

      // Copy base pages before insertion point
      if (pos > 0) {
        Progress.update(20, `기본 PDF 앞부분 복사 (${pos}페이지)...`);
        const before = await dest.copyPages(baseSrc, Array.from({ length: pos }, (_, i) => i));
        before.forEach(p => dest.addPage(p));
      }

      // Copy insert pages
      Progress.update(50, `삽입 PDF 복사 (${insertSrc.getPageCount()}페이지)...`);
      const insPages = await dest.copyPages(insertSrc, insertSrc.getPageIndices());
      insPages.forEach(p => dest.addPage(p));

      // Copy remaining base pages
      const afterCount = baseTotal - pos;
      if (afterCount > 0) {
        Progress.update(75, `기본 PDF 뒷부분 복사 (${afterCount}페이지)...`);
        const after = await dest.copyPages(
          baseSrc,
          Array.from({ length: afterCount }, (_, i) => pos + i)
        );
        after.forEach(p => dest.addPage(p));
      }

      Progress.update(90, '저장 중...');
      const bytes = await dest.save();
      Progress.update(100);
      Utils.downloadPDF(bytes, `${Utils.stripExt(state.baseFile.name)}_inserted.pdf`);
      Toast.success('저장 완료', `총 ${dest.getPageCount()}페이지 PDF가 다운로드되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('처리 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function reset() {
    Object.assign(state, { baseBytes: null, baseFile: null, basePDF: null,
                            insertBytes: null, insertFile: null, insertPDF: null });
    document.getElementById('ip-base-info').classList.add('hidden');
    document.getElementById('ip-insert-info').classList.add('hidden');
    document.getElementById('ip-controls').classList.add('hidden');
    document.getElementById('ip-actions').classList.add('hidden');
    document.getElementById('ip-position').value = '0';
  }

  return { init };
})();

/* ============================================================
   FEATURE 6 — EXTRACT PAGES
   ============================================================ */
const ExtractPages = (() => {
  const extra = { selected: new Set() };

  function onThumbClick(card, index, state, selectedId) {
    if (extra.selected.has(index)) {
      extra.selected.delete(index);
      card.classList.remove('selected');
    } else {
      extra.selected.add(index);
      card.classList.add('selected');
    }
    updateInfo(state, selectedId);
  }

  function updateInfo(state, selectedId) {
    const cnt = extra.selected.size;
    if (selectedId) {
      document.getElementById(selectedId).textContent = cnt ? `${cnt}페이지 선택됨` : '';
    }
    const infoEl = document.getElementById('ep-action-info');
    if (infoEl) infoEl.textContent = cnt ? `${cnt}페이지 추출 예정` : '추출할 페이지를 선택하세요.';
    document.getElementById('ep-generate').disabled = cnt === 0;
  }

  const state = createSinglePDFTool({
    id: 'ep', dropzoneId: 'ep-dropzone', inputId: 'ep-input',
    gridId: 'ep-grid', toolbarId: 'ep-toolbar', actionsId: 'ep-actions',
    infoId: 'ep-info', selectedId: 'ep-selected', resetId: 'ep-reset',
    selectable: true, sortable: false,
    onReset: () => { extra.selected.clear(); updateInfo({}, 'ep-selected'); },
    onThumbClick,
    onSort: null,
  });

  function init() {
    document.getElementById('ep-select-all').addEventListener('click', () => {
      if (!state.pdfDoc) return;
      for (let i = 0; i < state.pdfDoc.numPages; i++) extra.selected.add(i);
      document.querySelectorAll('#ep-grid .thumb-card')
        .forEach(c => c.classList.add('selected'));
      updateInfo(state, 'ep-selected');
    });
    document.getElementById('ep-deselect-all').addEventListener('click', () => {
      extra.selected.clear();
      document.querySelectorAll('#ep-grid .thumb-card')
        .forEach(c => c.classList.remove('selected'));
      updateInfo(state, 'ep-selected');
    });
    document.getElementById('ep-apply-range').addEventListener('click', () => applyRange(state));
    document.getElementById('ep-generate').addEventListener('click', () => generate(state));
  }

  function applyRange(state) {
    if (!state.pdfDoc) return;
    const str    = document.getElementById('ep-range').value.trim();
    const pages  = Utils.parsePageRange(str, state.pdfDoc.numPages);
    if (!pages) {
      Toast.warn('잘못된 범위 형식', '예: 1, 3-5, 7  (1부터 시작하는 페이지 번호)');
      return;
    }
    extra.selected.clear();
    document.querySelectorAll('#ep-grid .thumb-card')
      .forEach(c => c.classList.remove('selected'));
    pages.forEach(p => {
      extra.selected.add(p - 1); // convert to 0-based
      const card = document.querySelector(`#ep-grid .thumb-card[data-index="${p - 1}"]`);
      if (card) card.classList.add('selected');
    });
    updateInfo(state, 'ep-selected');
  }

  async function generate(state) {
    if (!state.pdfDoc || !extra.selected.size) return;
    Progress.show('페이지 추출 중...');
    try {
      const { PDFDocument } = PDFLib;
      const src  = await PDFDocument.load(state.pdfBytes);
      const dest = await PDFDocument.create();

      const sorted = [...extra.selected].sort((a, b) => a - b);
      Progress.update(40, `${sorted.length}페이지 복사 중...`);
      const pages = await dest.copyPages(src, sorted);
      pages.forEach(p => dest.addPage(p));

      Progress.update(90, '저장 중...');
      const bytes = await dest.save();
      Progress.update(100);
      Utils.downloadPDF(bytes, `${Utils.stripExt(state.file.name)}_extracted.pdf`);
      Toast.success('추출 완료', `${sorted.length}페이지가 추출된 PDF가 다운로드되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('처리 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  return { init };
})();

/* ============================================================
   FEATURE 7 — SPLIT PDF
   ============================================================ */
const SplitPDF = (() => {
  const state = { pdfDoc: null, file: null, pdfBytes: null };

  function init() {
    setupDropZone(
      document.getElementById('sp-dropzone'),
      document.getElementById('sp-input'),
      files => handleFile(files[0]), false
    );
    document.getElementById('sp-reset').addEventListener('click', reset);
    document.getElementById('sp-generate').addEventListener('click', generate);

    // Toggle range UI
    document.querySelectorAll('input[name="sp-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isRange = document.querySelector('input[name="sp-mode"]:checked').value === 'range';
        document.getElementById('sp-range-group').classList.toggle('hidden', !isRange);
      });
    });
  }

  async function handleFile(file) {
    if (!file) return;
    Progress.show('PDF 로드 중...');
    try {
      const bytes = await Utils.readAsArrayBuffer(file);
      const pdf   = await PDFRenderer.load(bytes);
      state.pdfBytes = bytes;
      state.file     = file;
      state.pdfDoc   = pdf;

      document.getElementById('sp-file-info').textContent =
        `${file.name}  ·  ${pdf.numPages}페이지  ·  ${Utils.formatSize(file.size)}`;
      document.getElementById('sp-controls').classList.remove('hidden');
      document.getElementById('sp-actions').classList.remove('hidden');
      document.getElementById('sp-results').classList.add('hidden');
      document.getElementById('sp-dropzone').classList.add('hidden');
    } catch (err) {
      Toast.error('파일 로드 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  async function generate() {
    if (!state.pdfDoc) return;
    const mode = document.querySelector('input[name="sp-mode"]:checked').value;
    const total = state.pdfDoc.numPages;

    // Build range list
    let ranges; // array of { label, indices[] }
    if (mode === 'each') {
      ranges = Array.from({ length: total }, (_, i) => ({
        label:   `page_${String(i + 1).padStart(3, '0')}`,
        indices: [i],
      }));
    } else {
      const rangeStr = document.getElementById('sp-ranges').value.trim();
      if (!rangeStr) { Toast.warn('범위를 입력하세요.'); return; }
      ranges = [];
      for (const line of rangeStr.split('\n').map(s => s.trim()).filter(Boolean)) {
        const pages = Utils.parsePageRange(line, total);
        if (!pages) {
          Toast.error('잘못된 범위', `"${line}"은 올바른 범위가 아닙니다.`);
          return;
        }
        ranges.push({ label: `range_${line.replace(/\s+/g, '')}`, indices: pages.map(p => p - 1) });
      }
    }

    Progress.show('PDF 분할 중...');
    const { PDFDocument } = PDFLib;
    const resultList = document.getElementById('sp-results-list');
    resultList.innerHTML = '';
    const resultItems = [];

    try {
      const src = await PDFDocument.load(state.pdfBytes);

      for (let i = 0; i < ranges.length; i++) {
        const rng = ranges[i];
        Progress.update(
          ((i + 1) / ranges.length) * 90,
          `분할 중 ${i + 1}/${ranges.length}...`
        );
        await Utils.yield();

        const dest  = await PDFDocument.create();
        const pages = await dest.copyPages(src, rng.indices);
        pages.forEach(p => dest.addPage(p));
        const bytes = await dest.save();

        resultItems.push({ bytes, label: rng.label, pages: pages.length });
      }

      Progress.update(95, '결과 준비 중...');

      // Build download list
      resultItems.forEach(({ bytes, label, pages }) => {
        const filename = `${Utils.stripExt(state.file.name)}_${label}.pdf`;
        const li = document.createElement('li');
        li.className = 'result-item';
        li.innerHTML = `
          <span class="result-item-name">${escapeHtml(filename)}</span>
          <span class="result-item-meta">${pages}페이지</span>`;
        const btn = document.createElement('button');
        btn.className   = 'btn btn-secondary btn-sm';
        btn.textContent = '다운로드';
        btn.addEventListener('click', () => Utils.downloadPDF(bytes, filename));
        li.appendChild(btn);
        resultList.appendChild(li);
      });

      Progress.update(100);
      document.getElementById('sp-results').classList.remove('hidden');
      Toast.success('분할 완료', `${ranges.length}개 PDF가 준비되었습니다. 각 파일을 다운로드하세요.`);
    } catch (err) {
      console.error(err);
      Toast.error('분할 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  function reset() {
    state.pdfDoc  = null;
    state.file    = null;
    state.pdfBytes = null;
    document.getElementById('sp-controls').classList.add('hidden');
    document.getElementById('sp-actions').classList.add('hidden');
    document.getElementById('sp-results').classList.add('hidden');
    document.getElementById('sp-dropzone').classList.remove('hidden');
    document.getElementById('sp-ranges').value = '';
    document.querySelector('input[name="sp-mode"][value="each"]').checked = true;
    document.getElementById('sp-range-group').classList.add('hidden');
  }

  return { init };
})();

/* ============================================================
   FEATURE 8 — ROTATE PAGES
   ============================================================ */
const RotatePages = (() => {
  const extra = { selected: new Set(), rotations: {} };

  function onThumbClick(card, index, state, selectedId) {
    if (extra.selected.has(index)) {
      extra.selected.delete(index);
      card.classList.remove('selected');
    } else {
      extra.selected.add(index);
      card.classList.add('selected');
    }
    updateInfo(state, selectedId);
  }

  function updateInfo(state, selectedId) {
    const cnt = extra.selected.size;
    if (selectedId) {
      document.getElementById(selectedId).textContent = cnt ? `${cnt}페이지 선택됨` : '';
    }
    const infoEl = document.getElementById('rot-action-info');
    if (infoEl) infoEl.textContent = cnt ? `${cnt}페이지에 회전 적용 예정` : '회전할 페이지를 선택하세요.';
    document.getElementById('rot-generate').disabled = Object.keys(extra.rotations).length === 0;
  }

  const state = createSinglePDFTool({
    id: 'rot', dropzoneId: 'rot-dropzone', inputId: 'rot-input',
    gridId: 'rot-grid', toolbarId: 'rot-toolbar', actionsId: 'rot-actions',
    infoId: 'rot-info', selectedId: 'rot-selected', resetId: 'rot-reset',
    selectable: true, sortable: false,
    onReset: () => { extra.selected.clear(); extra.rotations = {}; updateInfo({}, 'rot-selected'); },
    onThumbClick,
    onSort: null,
  });

  function applyRotation(angle) {
    if (!state.pdfDoc || !extra.selected.size) {
      Toast.warn('먼저 페이지를 선택하세요.');
      return;
    }
    extra.selected.forEach(idx => {
      const current = extra.rotations[idx] || 0;
      extra.rotations[idx] = (current + angle) % 360;
      // Update visual badge
      const card = document.querySelector(`#rot-grid .thumb-card[data-index="${idx}"]`);
      if (card) {
        card.dataset.rotation = extra.rotations[idx];
        const badge = card.querySelector('.thumb-rotation-badge');
        if (badge) badge.textContent = extra.rotations[idx] ? `${extra.rotations[idx]}°` : '';
      }
    });
    updateInfo(state, 'rot-selected');
  }

  function init() {
    document.getElementById('rot-90').addEventListener('click',  () => applyRotation(90));
    document.getElementById('rot-180').addEventListener('click', () => applyRotation(180));
    document.getElementById('rot-270').addEventListener('click', () => applyRotation(270));

    document.getElementById('rot-select-all').addEventListener('click', () => {
      if (!state.pdfDoc) return;
      for (let i = 0; i < state.pdfDoc.numPages; i++) extra.selected.add(i);
      document.querySelectorAll('#rot-grid .thumb-card')
        .forEach(c => c.classList.add('selected'));
      updateInfo(state, 'rot-selected');
    });
    document.getElementById('rot-deselect-all').addEventListener('click', () => {
      extra.selected.clear();
      document.querySelectorAll('#rot-grid .thumb-card')
        .forEach(c => c.classList.remove('selected'));
      updateInfo(state, 'rot-selected');
    });
    document.getElementById('rot-generate').addEventListener('click', () => generate(state));
  }

  async function generate(state) {
    if (!state.pdfDoc || !Object.keys(extra.rotations).length) return;
    Progress.show('페이지 회전 중...');
    try {
      const { PDFDocument, degrees } = PDFLib;
      const pdf = await PDFDocument.load(state.pdfBytes);
      const pages = pdf.getPages();

      for (const [idxStr, angle] of Object.entries(extra.rotations)) {
        const idx  = parseInt(idxStr, 10);
        const page = pages[idx];
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + angle) % 360));
      }

      Progress.update(90, '저장 중...');
      const bytes = await pdf.save();
      Progress.update(100);
      Utils.downloadPDF(bytes, `${Utils.stripExt(state.file.name)}_rotated.pdf`);
      Toast.success('저장 완료', `${Object.keys(extra.rotations).length}페이지가 회전된 PDF가 다운로드되었습니다.`);
    } catch (err) {
      console.error(err);
      Toast.error('처리 실패', err.message);
    } finally {
      Progress.hide();
    }
  }

  return { init };
})();

/* ============================================================
   APP — main initializer
   ============================================================ */
const App = {
  init() {
    Progress.init();
    Nav.init();
    initTheme();

    // Initialize each feature module
    ImageToPDF.init();
    MergePDF.init();
    DeletePages.init();
    ReorderPages.init();
    InsertPages.init();
    ExtractPages.init();
    SplitPDF.init();
    RotatePages.init();

    // Global drag-over prevention (stop browser from opening files)
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop',     e => e.preventDefault());
  },
};
