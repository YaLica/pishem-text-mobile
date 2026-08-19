/* ================= ЭТАП 2: ТЕКСТОВЫЕ ПЛАШКИ (ТЕКСТ-БЛОКИ) ================= */
let currentTextBox = null;

/* ===== ЭТАП 2 (Часть Б): ФОН ПЛАШКИ (цвет + прозрачность) ===== */
function hexToRgb(hex) {
  hex = (hex || '#000000').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function getTbTargetBox() {
  if (!currentTextBox) return null;
  return currentTextBox.classList && currentTextBox.classList.contains('text-box')
    ? currentTextBox
    : currentTextBox.closest('.text-box');
}

function applyTbBg(box) {
  if (!box) return;
  const content = box.querySelector('.tb-content');
  if (!content) return;
  const hex = box.dataset.bgColor || '#000000';
  const op = (box.dataset.bgOpacity !== undefined) ? parseInt(box.dataset.bgOpacity, 10) : 55;
  const rgb = hexToRgb(hex);
  const rgba = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + (op / 100) + ')';
  const mode = box.dataset.mode || 'plate';

    if (mode === 'ribbon') {
    box.classList.add('mode-ribbon');
    content.style.background = 'transparent';
    const ribHex = box.dataset.ribbonColor || '#000000';
    const ribRgb = hexToRgb(ribHex);
    const ribOp = (box.dataset.ribbonOpacity !== undefined) ? parseInt(box.dataset.ribbonOpacity, 10) : 85;
    box.style.setProperty('--ribbon-bg', 'rgba(' + ribRgb.r + ',' + ribRgb.g + ',' + ribRgb.b + ',' + (ribOp / 100) + ')');
    applyRibbonStyles(box);
    wrapTbRibbon(content);
    applyTbTypography(box);
  } else {
    box.classList.remove('mode-ribbon');
    unwrapTbRibbon(content);
    content.style.background = rgba;
  }
}

/* Оборачивает текст плашки в span.tb-ribbon (для режима лент) */
function wrapTbRibbon(content) {
  if (content.querySelector('.tb-ribbon')) return;
  const span = document.createElement('span');
  span.className = 'tb-ribbon';
  while (content.firstChild) span.appendChild(content.firstChild);
  content.appendChild(span);
}

/* Убирает обёртку span.tb-ribbon (возврат к плашке) */
function unwrapTbRibbon(content) {
  const span = content.querySelector('.tb-ribbon');
  if (!span) return;
  while (span.firstChild) content.insertBefore(span.firstChild, span);
  span.remove();
}

function setTbMode(mode) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.mode = mode;
  applyTbBg(box);
  syncTbSettings();
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbBgColor(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.bgColor = v;
  const el = document.getElementById('tbBgColor'); if (el) el.value = v;
  applyTbBg(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbBgOpacity(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.bgOpacity = v;
  const lbl = document.getElementById('tbBgOpacityLabel'); if (lbl) lbl.textContent = v;
  const rng = document.getElementById('tbBgOpacity'); if (rng) rng.value = v;
  applyTbBg(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}
  
function populateTbFontSelector() {
  const tbSel = document.getElementById('tbFontFamily');
  const mainSel = document.getElementById('fontFamilySelector');
  if (!tbSel || !mainSel || tbSel.dataset.ready === '1') return;
  Array.from(mainSel.options).forEach(function(opt, index) {
    if (index === 0) return;
    const clone = opt.cloneNode(true);
    tbSel.appendChild(clone);
  });
  tbSel.dataset.ready = '1';
}

function applyTbTypography(box) {
  if (!box) return;
  const content = box.querySelector('.tb-content');
  if (!content) return;
  const fs = box.dataset.fontSize || '24';
  const lh = box.dataset.lineHeight || '1.25';
  const ff = box.dataset.fontFamily || '';
  content.style.fontSize = fs + 'px';
  content.style.lineHeight = lh;
  content.style.fontFamily = ff || '';
  const ribbon = content.querySelector('.tb-ribbon');
  if (ribbon) {
    ribbon.style.fontSize = fs + 'px';
    ribbon.style.lineHeight = lh;
    ribbon.style.fontFamily = ff || '';
  }
}

function setTbLineHeight(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.lineHeight = v;
  applyTbTypography(box);
  const lbl = document.getElementById('tbLineHeightLabel'); if (lbl) lbl.textContent = v;
  const rng = document.getElementById('tbLineHeight'); if (rng) rng.value = v;
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}
  
function setTbFontSize(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.fontSize = v;
  applyTbTypography(box);
  const lbl = document.getElementById('tbFontSizeLabel'); if (lbl) lbl.textContent = v;
  const rng = document.getElementById('tbFontSize'); if (rng) rng.value = v;
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbFontFamily(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.fontFamily = v || '';
  applyTbTypography(box);
  const sel = document.getElementById('tbFontFamily');
  if (sel) sel.value = v || '';
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

/* ===== ПОДЛОЖКА (ЛЕНТЫ): вкл/выкл + настройки ===== */
function toggleRibbonMode() {
  const box = getTbTargetBox();
  if (!box) return;
  const isRibbon = box.dataset.mode === 'ribbon';
  box.dataset.mode = isRibbon ? 'plate' : 'ribbon';
  applyTbBg(box);
  syncTbSettings();
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function applyRibbonStyles(box) {
  if (!box) return;
  const rad = box.dataset.ribbonRadius || '6';
  const padH = box.dataset.ribbonPadH || '0.3';
  const padV = box.dataset.ribbonPadV || '0.25';
  box.style.setProperty('--ribbon-radius', rad + 'px');
  box.style.setProperty('--ribbon-pad-h', padH + 'em');
  box.style.setProperty('--ribbon-pad-v', padV + 'em');
}

function setTbRibbonColor(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.ribbonColor = v;
  const el = document.getElementById('tbRibbonColor'); if (el) el.value = v;
  applyTbBg(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbRibbonOpacity(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.ribbonOpacity = v;
  const lbl = document.getElementById('tbRibbonOpacityLabel'); if (lbl) lbl.textContent = v;
  const rng = document.getElementById('tbRibbonOpacity'); if (rng) rng.value = v;
  applyTbBg(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbRibbonRadius(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.ribbonRadius = v;
  const lbl = document.getElementById('tbRibbonRadiusLabel'); if (lbl) lbl.textContent = v;
  applyRibbonStyles(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbRibbonPadH(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.ribbonPadH = v;
  const lbl = document.getElementById('tbRibbonPadHLabel'); if (lbl) lbl.textContent = v;
  applyRibbonStyles(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function setTbRibbonPadV(v) {
  const box = getTbTargetBox();
  if (!box) return;
  box.dataset.ribbonPadV = v;
  const lbl = document.getElementById('tbRibbonPadVLabel'); if (lbl) lbl.textContent = v;
  applyRibbonStyles(box);
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function syncTbSettings() {
  populateTbFontSelector();
  const panel = document.getElementById('tbSettings');
  if (!panel) return;
  const box = getTbTargetBox();
  if (!box || isMobile()) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  const hex = box.dataset.bgColor || '#000000';
  const op = (box.dataset.bgOpacity !== undefined) ? parseInt(box.dataset.bgOpacity, 10) : 55;
  const colEl = document.getElementById('tbBgColor'); if (colEl) colEl.value = hex;
  const opEl = document.getElementById('tbBgOpacity'); if (opEl) opEl.value = op;
  const opLbl = document.getElementById('tbBgOpacityLabel'); if (opLbl) opLbl.textContent = op;
   const lh = box.dataset.lineHeight || '1.25';
  const lhEl = document.getElementById('tbLineHeight'); if (lhEl) lhEl.value = lh;
  const lhLbl = document.getElementById('tbLineHeightLabel'); if (lhLbl) lhLbl.textContent = lh;

  const fs = box.dataset.fontSize || '24';
  const fsEl = document.getElementById('tbFontSize'); if (fsEl) fsEl.value = fs;
  const fsLbl = document.getElementById('tbFontSizeLabel'); if (fsLbl) fsLbl.textContent = fs;

  const ff = box.dataset.fontFamily || '';
  const ffEl = document.getElementById('tbFontFamily'); if (ffEl) ffEl.value = ff;

  applyTbTypography(box);

  const mode = box.dataset.mode || 'plate';
  const isRibbon = (mode === 'ribbon');
  const toggleBtn = document.getElementById('tbRibbonToggle');
  const ribPanel = document.getElementById('tbRibbonSettings');
  if (toggleBtn) toggleBtn.textContent = isRibbon ? '❌ Убрать подложку' : '🎀 Добавить подложку для текста';
  if (toggleBtn) toggleBtn.style.background = isRibbon ? '#ef4444' : '#8b5cf6';
  if (ribPanel) ribPanel.style.display = isRibbon ? 'block' : 'none';

  const ribCol = box.dataset.ribbonColor || '#000000';
  const ribColEl = document.getElementById('tbRibbonColor'); if (ribColEl) ribColEl.value = ribCol;
  const ribOp = (box.dataset.ribbonOpacity !== undefined) ? parseInt(box.dataset.ribbonOpacity, 10) : 85;
  const ribOpEl = document.getElementById('tbRibbonOpacity'); if (ribOpEl) ribOpEl.value = ribOp;
  const ribOpLbl = document.getElementById('tbRibbonOpacityLabel'); if (ribOpLbl) ribOpLbl.textContent = ribOp;
  const ribRad = box.dataset.ribbonRadius || '6';
  const ribRadEl = document.getElementById('tbRibbonRadius'); if (ribRadEl) ribRadEl.value = ribRad;
  const ribRadLbl = document.getElementById('tbRibbonRadiusLabel'); if (ribRadLbl) ribRadLbl.textContent = ribRad;
  const ribPH = box.dataset.ribbonPadH || '0.3';
  const ribPHEl = document.getElementById('tbRibbonPadH'); if (ribPHEl) ribPHEl.value = ribPH;
  const ribPHLbl = document.getElementById('tbRibbonPadHLabel'); if (ribPHLbl) ribPHLbl.textContent = ribPH;
  const ribPV = box.dataset.ribbonPadV || '0.25';
  const ribPVEl = document.getElementById('tbRibbonPadV'); if (ribPVEl) ribPVEl.value = ribPV;
  const ribPVLbl = document.getElementById('tbRibbonPadVLabel'); if (ribPVLbl) ribPVLbl.textContent = ribPV;
}

function handleTbPaste(e) {
  const box = e.target.closest('.text-box');
  if (!box) return;
  e.preventDefault();
  const content = box.querySelector('.tb-content');
  if (content) currentTextBox = content;
  saveSelectionBeforeAction();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (text && insertTextAtSelection(text)) {
    content.dispatchEvent(new Event('input', { bubbles: true }));
  }
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

document.addEventListener('paste', handleTbPaste, true);

function insertImageIntoTextBox(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const box = getTbTargetBox();
  if (!box) { event.target.value = ''; return; }
  const content = box.querySelector('.tb-content');
  if (!content) { event.target.value = ''; return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.createElement('img');
    img.className = 'tb-img';
    img.src = e.target.result;
    img.contentEditable = 'false';
    content.appendChild(img);
    clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
  };
  reader.readAsDataURL(file);

  event.target.value = '';
}

function addTextBox() {
  if (isMobile()) { showTbToast(); return; }
  const count = exportNode.querySelectorAll('.text-box').length;
  if (count >= 10) { alert('Максимум 10 надписей'); return; }
  const box = document.createElement('div');
  box.className = 'text-box';
  box.style.left = (30 + count * 20) + 'px';
  box.style.top  = (30 + count * 20) + 'px';
  box.dataset.bgColor = '#000000';
  box.dataset.bgOpacity = '55';
  box.dataset.fontSize = '24';
  box.dataset.lineHeight = '1.25';
  box.dataset.fontFamily = '';

  const content = document.createElement('div');
  content.className = 'tb-content';
  content.contentEditable = 'true';
  content.setAttribute('data-ph', 'Твой текст…');
  box.appendChild(content);

  exportNode.appendChild(box);
  applyTbBg(box);
  bindTextBox(box);
  selectTextBox(box);
  setTimeout(function(){ content.focus(); }, 30);
  saveHistory();
}

function bindTextBox(box) {
  const content = box.querySelector('.tb-content');
  if (isMobile()) {
    if (content) content.setAttribute('contenteditable', 'false');
    box.addEventListener('click', function(e){ e.stopPropagation(); showTbToast(); });
    box.addEventListener('touchstart', function(e){ e.stopPropagation(); showTbToast(); }, {passive: true});
    return;
  }

  box.addEventListener('click', function(e){
    if (e.target.closest('.tb-edge') || e.target.closest('.tb-handle') || e.target.closest('.tb-delete') || e.target.closest('.tb-resize')) return;
    e.stopPropagation();
    selectTextBox(box);
    if (content) content.focus();
  });

  if (content) {
    content.addEventListener('input', function(){ clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); });
    content.addEventListener('keyup', saveSelectionBeforeAction);
    content.addEventListener('mouseup', saveSelectionBeforeAction);
    content.addEventListener('touchend', saveSelectionBeforeAction);
  }

  ensureDragFrame(box);
  makeTextBoxDraggable(box);
  makeTextBoxResizable(box);
  makeTextBoxRotatable(box);
  applyTbTypography(box);
  applyTbRotation(box);
}

function ensureDragFrame(box) {
  if (!box.querySelector('.tb-drag-frame')) {
    const frame = document.createElement('div');
    frame.className = 'tb-drag-frame';
    frame.contentEditable = 'false';
    ['top','bottom','left','right'].forEach(function(side){
      const edge = document.createElement('div');
      edge.className = 'tb-edge ' + side;
      edge.contentEditable = 'false';
      frame.appendChild(edge);
    });
    box.appendChild(frame);
  }

  if (!box.querySelector('.tb-handle')) {
    const handle = document.createElement('div');
    handle.className = 'tb-handle';
    handle.contentEditable = 'false';
    handle.textContent = '✥';
    box.appendChild(handle);
  }
  if (!box.querySelector('.tb-copy')) {
    const cp = document.createElement('div');
    cp.className = 'tb-copy';
    cp.contentEditable = 'false';
    cp.textContent = '📋';
    cp.title = 'Дублировать плашку';
    cp.addEventListener('click', function(e){
      e.stopPropagation();
      duplicateTextBox(box);
    });
    cp.addEventListener('touchstart', function(e){
      e.stopPropagation(); e.preventDefault();
      duplicateTextBox(box);
    });
    box.appendChild(cp);
  }

  if (!box.querySelector('.tb-delete')) {
    const delBtn = document.createElement('div');
    delBtn.className = 'tb-delete';
    delBtn.contentEditable = 'false';
    delBtn.textContent = '✕';
    delBtn.title = 'Удалить плашку';
    delBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteTextBox(box);
    });
    delBtn.addEventListener('touchstart', function(e) {
      e.stopPropagation();
      e.preventDefault();
      deleteTextBox(box);
    });
    box.appendChild(delBtn);
  }

  if (!box.querySelector('.tb-resize')) {
    const rs = document.createElement('div');
    rs.className = 'tb-resize';
    rs.contentEditable = 'false';
    box.appendChild(rs);
  }
  if (!box.querySelector('.tb-rotate')) {
    const rot = document.createElement('div');
    rot.className = 'tb-rotate';
    rot.contentEditable = 'false';
    rot.textContent = '🔄';
    rot.title = 'Вращать плашку';
    box.appendChild(rot);
  }
}

function deleteTextBox(box) {
  if (!box) return;
  if (currentTextBox === box || (currentTextBox && box.contains(currentTextBox))) {
    currentTextBox = null;
  }
  box.remove();
  syncTbSettings();
  saveHistory();
}

function duplicateTextBox(box) {
  if (!box) return;
  const count = exportNode.querySelectorAll('.text-box').length;
  if (count >= 10) { alert('Максимум 10 надписей'); return; }

  const srcContent = box.querySelector('.tb-content');

  const clone = document.createElement('div');
  clone.className = 'text-box';
  clone.style.left = (box.offsetLeft + 20) + 'px';
  clone.style.top  = (box.offsetTop + 20) + 'px';
  if (box.style.width) clone.style.width = box.style.width;
  clone.dataset.bgColor   = box.dataset.bgColor   || '#000000';
  clone.dataset.bgOpacity = box.dataset.bgOpacity || '55';
  clone.dataset.fontSize  = box.dataset.fontSize  || '24';
  clone.dataset.lineHeight = box.dataset.lineHeight || '1.25';
  clone.dataset.fontFamily = box.dataset.fontFamily || '';
  clone.dataset.mode = box.dataset.mode || 'plate';
  clone.dataset.ribbonColor = box.dataset.ribbonColor || '#000000';
  clone.dataset.ribbonOpacity = box.dataset.ribbonOpacity || '85';
  clone.dataset.ribbonRadius = box.dataset.ribbonRadius || '6';
  clone.dataset.ribbonPadH = box.dataset.ribbonPadH || '0.3';
  clone.dataset.ribbonPadV = box.dataset.ribbonPadV || '0.25';
  clone.dataset.rot       = box.dataset.rot       || '0';

  const content = document.createElement('div');
  content.className = 'tb-content';
  content.contentEditable = 'true';
  content.setAttribute('data-ph', 'Твой текст…');
  content.innerHTML = srcContent ? srcContent.innerHTML : '';
  if (srcContent && srcContent.style.height) content.style.height = srcContent.style.height;
  clone.appendChild(content);

  exportNode.appendChild(clone);
  applyTbBg(clone);
  bindTextBox(clone);
  selectTextBox(clone);
  saveHistory();
}

/* ===== ПРИВЯЗКА К ЦЕНТРУ ХОЛСТА (Путь А) ===== */
const SNAP_TOLERANCE = 8; // насколько близко поднести, чтобы "прилипло" (px)

function ensureSnapGuides() {
  let gv = document.getElementById('snapGuideV');
  let gh = document.getElementById('snapGuideH');
  if (!gv) {
    gv = document.createElement('div');
    gv.id = 'snapGuideV';
    gv.className = 'snap-guide vertical';
    gv.contentEditable = 'false';
    exportNode.appendChild(gv);
  }
  if (!gh) {
    gh = document.createElement('div');
    gh.id = 'snapGuideH';
    gh.className = 'snap-guide horizontal';
    gh.contentEditable = 'false';
    exportNode.appendChild(gh);
  }
  return { gv, gh };
}

function showSnapGuideV(on) {
  const { gv } = ensureSnapGuides();
  if (on) { gv.style.left = (exportNode.clientWidth / 2 - 1) + 'px'; gv.classList.add('visible'); }
  else gv.classList.remove('visible');
}

function showSnapGuideH(on) {
  const { gh } = ensureSnapGuides();
  if (on) { gh.style.top = (exportNode.clientHeight / 2 - 1) + 'px'; gh.classList.add('visible'); }
  else gh.classList.remove('visible');
}

function hideSnapGuides() {
  const gv = document.getElementById('snapGuideV');
  const gh = document.getElementById('snapGuideH');
  if (gv) gv.classList.remove('visible');
  if (gh) gh.classList.remove('visible');
}
  /* ===== ШАГ 1: ПРИЛИПАНИЕ ПЛАШЕК ДРУГ К ДРУГУ ===== */
function snapToOtherBoxes(box, newLeft, newTop) {
  const w = box.offsetWidth;
  const h = box.offsetHeight;

  // линии перетаскиваемой плашки
  const myLeft = newLeft;
  const myRight = newLeft + w;
  const myCX = newLeft + w / 2;
  const myTop = newTop;
  const myBottom = newTop + h;
  const myCY = newTop + h / 2;

  let snappedX = false, snappedY = false;

  const others = exportNode.querySelectorAll('.text-box');
  others.forEach(function(other) {
    if (other === box) return;

    const oL = other.offsetLeft;
    const oT = other.offsetTop;
    const oW = other.offsetWidth;
    const oH = other.offsetHeight;
    const oRight = oL + oW;
    const oCX = oL + oW / 2;
    const oBottom = oT + oH;
    const oCY = oT + oH / 2;

    // --- По горизонтали (X) ---
    if (!snappedX) {
      if (Math.abs(myLeft - oL) <= SNAP_TOLERANCE) { newLeft = oL; snappedX = true; }
      else if (Math.abs(myRight - oRight) <= SNAP_TOLERANCE) { newLeft = oRight - w; snappedX = true; }
      else if (Math.abs(myCX - oCX) <= SNAP_TOLERANCE) { newLeft = oCX - w / 2; snappedX = true; }
    }

    // --- По вертикали (Y) ---
    if (!snappedY) {
      if (Math.abs(myTop - oT) <= SNAP_TOLERANCE) { newTop = oT; snappedY = true; }
      else if (Math.abs(myBottom - oBottom) <= SNAP_TOLERANCE) { newTop = oBottom - h; snappedY = true; }
      else if (Math.abs(myCY - oCY) <= SNAP_TOLERANCE) { newTop = oCY - h / 2; snappedY = true; }
    }
  });

  return { left: newLeft, top: newTop, snappedX: snappedX, snappedY: snappedY };
}
  
/* ===== ЗЕРКАЛО ОТ ЦЕНТРА (по центрам плашек) ===== */
function snapMirror(box, newLeft) {
  const w = box.offsetWidth;
  const canvasCX = exportNode.clientWidth / 2;
  const myCX = newLeft + w / 2;
  const myDist = myCX - canvasCX;

  let resultLeft = newLeft;
  let snapped = false;

  const others = exportNode.querySelectorAll('.text-box');
  for (let i = 0; i < others.length; i++) {
    const other = others[i];
    if (other === box) continue;

    const oCX = other.offsetLeft + other.offsetWidth / 2;
    const oDist = oCX - canvasCX;

    if (oDist === 0) continue;
    if ((myDist < 0 && oDist < 0) || (myDist > 0 && oDist > 0)) continue;

    const targetCX = canvasCX - oDist;

    if (Math.abs(myCX - targetCX) <= SNAP_TOLERANCE) {
      resultLeft = targetCX - w / 2;
      snapped = true;
      break;
    }
  }

  return { left: resultLeft, snapped: snapped };
}

function makeTextBoxDraggable(box) {
  let isDragging = false;
  let startX, startY, origLeft, origTop;

  function onStart(e) {
    const edge = e.target.closest('.tb-edge') || e.target.closest('.tb-handle');
    if (!edge) return;

    selectTextBox(box);

    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    origLeft = box.offsetLeft;
    origTop = box.offsetTop;
    isDragging = false;

    if (e.cancelable) e.preventDefault();

    function onMove(ev) {
      const t = ev.touches ? ev.touches[0] : ev;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        isDragging = true;
      }

      if (isDragging) {
        if (ev.cancelable) ev.preventDefault();
        const z = (typeof currentZoom === 'number' && currentZoom > 0) ? currentZoom : 1;
        let newLeft = origLeft + dx / z;
        let newTop = origTop + dy / z;

        const maxLeft = exportNode.clientWidth - box.offsetWidth;
        const maxTop = exportNode.clientHeight - box.offsetHeight;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop > maxTop) newTop = maxTop;

                // === ПРИВЯЗКА К ЦЕНТРУ ХОЛСТА (Путь А) ===
        const canvasCX = exportNode.clientWidth / 2;
        const canvasCY = exportNode.clientHeight / 2;
        const boxCX = newLeft + box.offsetWidth / 2;
        const boxCY = newTop + box.offsetHeight / 2;

        let snappedToCanvasX = false;
        let snappedToCanvasY = false;

        // Центр по горизонтали (вертикальная линия)
        if (Math.abs(boxCX - canvasCX) <= SNAP_TOLERANCE) {
          newLeft = canvasCX - box.offsetWidth / 2;
          showSnapGuideV(true);
          snappedToCanvasX = true;
        } else {
          showSnapGuideV(false);
        }

        // Центр по вертикали (горизонтальная линия)
        if (Math.abs(boxCY - canvasCY) <= SNAP_TOLERANCE) {
          newTop = canvasCY - box.offsetHeight / 2;
          showSnapGuideH(true);
          snappedToCanvasY = true;
        } else {
          showSnapGuideH(false);
        }

        // === ШАГ 1: ПРИЛИПАНИЕ К ДРУГИМ ПЛАШКАМ ===
        // (только если не прилипли уже к центру холста по этой оси)
        const snapRes = snapToOtherBoxes(box, newLeft, newTop);
        if (!snappedToCanvasX && snapRes.snappedX) {
          newLeft = snapRes.left;
          showSnapGuideV(true);
        }
                if (!snappedToCanvasY && snapRes.snappedY) {
          newTop = snapRes.top;
          showSnapGuideH(true);
        }

        // === ЗЕРКАЛО ОТ ЦЕНТРА ===
        if (!snappedToCanvasX && !snapRes.snappedX) {
          const mirror = snapMirror(box, newLeft);
          if (mirror.snapped) {
            newLeft = mirror.left;
            showSnapGuideV(true);
          }
        }

        box.style.left = newLeft + 'px';
        box.style.top = newTop + 'px';
      }
    }

    function onEnd() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      hideSnapGuides();
      if (isDragging) {
        saveHistory();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd);
  }

  const handle = box.querySelector('.tb-handle');
  const edges = box.querySelectorAll('.tb-edge');

  if (handle) {
    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, {passive: false});
  }
  edges.forEach(function(edge){
    edge.addEventListener('mousedown', onStart);
    edge.addEventListener('touchstart', onStart, {passive: false});
  });
}

function makeTextBoxResizable(box) {
  const rs = box.querySelector('.tb-resize');
  if (!rs) return;

  function onStart(e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    selectTextBox(box);

    const content = box.querySelector('.tb-content');
    const touch = e.touches ? e.touches[0] : e;
    const startX = touch.clientX;
    const startY = touch.clientY;
    const startWidth = box.offsetWidth;
    const startHeight = content ? content.offsetHeight : box.offsetHeight;

    function onMove(ev) {
      if (ev.cancelable) ev.preventDefault();
      const t = ev.touches ? ev.touches[0] : ev;
      const z = (typeof currentZoom === 'number' && currentZoom > 0) ? currentZoom : 1;
      const dx = (t.clientX - startX) / z;
      const dy = (t.clientY - startY) / z;

      let newW = startWidth + dx;
      if (newW < 60) newW = 60;
      box.style.width = newW + 'px';

      if (content) {
        let newH = startHeight + dy;
        if (newH < 30) newH = 30;
        content.style.height = newH + 'px';
      }
    }

    function onEnd() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      saveHistory();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd);
  }

  rs.addEventListener('mousedown', onStart);
  rs.addEventListener('touchstart', onStart, {passive: false});
}

function applyTbRotation(box) {
  const rot = parseFloat(box.dataset.rot || '0');
  box.style.transform = 'rotate(' + rot + 'deg)';
  box.style.transformOrigin = 'center center';
}

function makeTextBoxRotatable(box) {
  const handle = box.querySelector('.tb-rotate');
  if (!handle) return;

  function onStart(e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    selectTextBox(box);

    const rect = box.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    function onMove(ev) {
      if (ev.cancelable) ev.preventDefault();
      const t = ev.touches ? ev.touches[0] : ev;
      const angle = Math.atan2(t.clientY - cy, t.clientX - cx) * 180 / Math.PI + 90;
      box.dataset.rot = angle;
      applyTbRotation(box);
    }

    function onEnd() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      saveHistory();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd);
  }

  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, {passive: false});
}

function selectTextBox(box) {
  editor.querySelectorAll('.img-box').forEach(function(b){ b.classList.remove('selected'); });
  document.querySelectorAll('.text-box').forEach(function(b){ b.classList.remove('selected'); });
  box.classList.add('selected');
  currentTextBox = box.querySelector('.tb-content') || box;
  currentImgBox = null;
  syncTbSettings();
}

