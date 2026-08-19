function updateUndoRedoButtons() {
document.getElementById('btnUndo').disabled = (historyIndex <= 0);
document.getElementById('btnRedo').disabled = (historyIndex >= historyStack.length - 1);
const fU = document.getElementById('floatUndo');
const fR = document.getElementById('floatRedo');
if (fU) fU.disabled = (historyIndex <= 0);
if (fR) fR.disabled = (historyIndex >= historyStack.length - 1);
}

function saveHistory() {
const textBoxesData = Array.from(exportNode.querySelectorAll('.text-box')).map(b => {
  const contentEl = b.querySelector('.tb-content');
   return {
    html: contentEl ? contentEl.innerHTML : '',
    left: b.style.left,
    top: b.style.top,
    width: b.style.width || '',
    height: (contentEl && contentEl.style.height) ? contentEl.style.height : '',
    bgColor: b.dataset.bgColor || '#000000',
    bgOpacity: (b.dataset.bgOpacity !== undefined) ? b.dataset.bgOpacity : '55',
        lineHeight: b.dataset.lineHeight || '1.25',
    fontSize: b.dataset.fontSize || '',
    fontFamily: b.dataset.fontFamily || '',
    mode: b.dataset.mode || 'plate',
    ribbonColor: b.dataset.ribbonColor || '#000000',
    ribbonOpacity: (b.dataset.ribbonOpacity !== undefined) ? b.dataset.ribbonOpacity : '85',
    ribbonRadius: b.dataset.ribbonRadius || '6',
    ribbonPadH: b.dataset.ribbonPadH || '0.3',
    ribbonPadV: b.dataset.ribbonPadV || '0.25',
    rot: b.dataset.rot || '0'
  };
});
const snapshot = { 
  html: editor.innerHTML, 
  textBoxes: textBoxesData,
  fontSize: baseFontSlider.value, 
  lineHeight: lineHeightSlider.value, 
  fontFamily: fontFamilySelector.value 
};
if (historyIndex >= 0) {
const last = historyStack[historyIndex];
if (last.html === snapshot.html && JSON.stringify(last.textBoxes) === JSON.stringify(snapshot.textBoxes) && last.fontSize === snapshot.fontSize && last.lineHeight === snapshot.lineHeight && last.fontFamily === snapshot.fontFamily) return;
}
if (historyIndex < historyStack.length - 1) historyStack = historyStack.slice(0, historyIndex + 1);
historyStack.push(snapshot);
if (historyStack.length > 50) historyStack.shift(); else historyIndex++;
updateUndoRedoButtons();
}

function applySnapshot(snapshot) {
editor.innerHTML = snapshot.html;
baseFontSlider.value = snapshot.fontSize;
document.getElementById('baseFontSizeLabel').textContent = snapshot.fontSize;
editor.style.fontSize = snapshot.fontSize + 'px';
lineHeightSlider.value = snapshot.lineHeight;
document.getElementById('lineHeightLabel').textContent = snapshot.lineHeight;
editor.style.lineHeight = snapshot.lineHeight;
fontFamilySelector.value = snapshot.fontFamily;
editor.style.fontFamily = snapshot.fontFamily;

exportNode.querySelectorAll('.text-box').forEach(b => b.remove());
if (snapshot.textBoxes && Array.isArray(snapshot.textBoxes)) {
  snapshot.textBoxes.forEach(tb => {
    const box = document.createElement('div');
    box.className = 'text-box';
      box.style.left = tb.left;
    box.style.top = tb.top;
    if (tb.width) box.style.width = tb.width;
    if (tb.bgColor) box.dataset.bgColor = tb.bgColor;
    if (tb.bgOpacity !== undefined) box.dataset.bgOpacity = tb.bgOpacity;
        if (tb.lineHeight !== undefined) box.dataset.lineHeight = tb.lineHeight;
    if (tb.fontSize) box.dataset.fontSize = tb.fontSize;
    if (tb.fontFamily !== undefined) box.dataset.fontFamily = tb.fontFamily;
    if (tb.mode !== undefined) box.dataset.mode = tb.mode;
    if (tb.ribbonColor !== undefined) box.dataset.ribbonColor = tb.ribbonColor;
    if (tb.ribbonOpacity !== undefined) box.dataset.ribbonOpacity = tb.ribbonOpacity;
    if (tb.ribbonRadius !== undefined) box.dataset.ribbonRadius = tb.ribbonRadius;
    if (tb.ribbonPadH !== undefined) box.dataset.ribbonPadH = tb.ribbonPadH;
    if (tb.ribbonPadV !== undefined) box.dataset.ribbonPadV = tb.ribbonPadV;
    if (tb.rot !== undefined) box.dataset.rot = tb.rot;
    
    const content = document.createElement('div');
    content.className = 'tb-content';
    content.contentEditable = 'true';
    content.setAttribute('data-ph', 'Твой текст…');
    content.innerHTML = tb.html;
    if (tb.lineHeight) content.style.lineHeight = tb.lineHeight;
    if (tb.fontSize) content.style.fontSize = tb.fontSize + 'px';
    if (tb.fontFamily) content.style.fontFamily = tb.fontFamily;
    if (tb.height) content.style.height = tb.height;
    box.appendChild(content);

    exportNode.appendChild(box);
    applyTbBg(box);
    bindTextBox(box);
  });
}
}

function undoAction(e) {
if(e && e.preventDefault) e.preventDefault();
if (historyIndex > 0) { historyIndex--; applySnapshot(historyStack[historyIndex]); restoreAfterHistoryChange(); }
}
function redoAction(e) {
if(e && e.preventDefault) e.preventDefault();
if (historyIndex < historyStack.length - 1) { historyIndex++; applySnapshot(historyStack[historyIndex]); restoreAfterHistoryChange(); }
}

function restoreAfterHistoryChange() {
rebindImages();
ensureAnchorBeforeImages();
updateImgCounter();
document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
updateRatio();
updateUndoRedoButtons();
currentImgBox = null;
focusEditor();
}

function rebindImages() {
editor.querySelectorAll('.img-box').forEach(function(box) {
box.setAttribute('draggable', 'true');
box.contentEditable = 'false';
box.onclick = function(e) { e.stopPropagation(); selectImgBox(box); };
let resizer = box.querySelector('.img-resizer');
if (!resizer) {
resizer = document.createElement('span');
resizer.className = 'img-resizer';
resizer.contentEditable = 'false';
box.appendChild(resizer);
}
ensureRotor(box);
applyImgStyles(box);
bindResizer(box);
});
}

function ensureAnchorBeforeImages() {
editor.querySelectorAll('.img-box').forEach(function(box) {
const prev = box.previousSibling;
const needAnchor = !prev || (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR');

const isFloat = !box.classList.contains('align-center');
const isFirstInEditor = !prev;

if (isFirstInEditor && isFloat) {
let p = box.previousSibling;
if (p && p.nodeType === Node.TEXT_NODE && p.textContent === '\u200B') p.remove();
const after = box.nextSibling;
if (!after || after.nodeType !== Node.TEXT_NODE || after.textContent !== '\u200B') {
box.parentNode.insertBefore(document.createTextNode('\u200B'), box.nextSibling);
}
return;
}

if (needAnchor) {
box.parentNode.insertBefore(document.createTextNode('\u200B'), box);
}
});
}

function snapImageToLineStart(box) {
  if (!box) return;
  let prev = box.previousSibling;
  while (prev) {
    if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR') break;
    if (prev.nodeType === Node.TEXT_NODE && prev.textContent === '\u200B') { prev = prev.previousSibling; continue; }
    if (prev.nodeType === Node.TEXT_NODE) {
      box.parentNode.insertBefore(box, prev);
      prev = box.previousSibling;
      continue;
    }
    break;
  }
}

