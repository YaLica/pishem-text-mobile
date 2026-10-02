function updateLineHeight(val) {
document.getElementById('lineHeightLabel').textContent = val;
editor.style.lineHeight = val;
updateRatio();
scheduleHistorySave();
}

function applyBase(base) {
baseFontSlider.value = base;
document.getElementById('baseFontSizeLabel').textContent = base;
editor.style.fontSize = base + 'px';
editor.querySelectorAll('*').forEach(el => {
if (!el.getAttribute('data-custom-size') && el.tagName !== 'CODE' && !el.classList.contains('img-box') && !el.classList.contains('img-resizer')) {
el.style.fontSize = '';
}
});
}

function updateBaseFontSize(size) { applyBase(size); updateRatio(); scheduleHistorySave(); }

let typeTimer = null;
editor.addEventListener('input', function() {
document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
updateImgCounter();
updateRatio();
scheduleHistorySave();
});

editor.addEventListener('paste', function(e) {
e.preventDefault();
const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r\n?/g, '\n');
const sel = window.getSelection();
if (!sel || !sel.rangeCount) return;
const range = sel.getRangeAt(0);
if (!editor.contains(range.commonAncestorContainer)) return;

range.deleteContents();
const fragment = document.createDocumentFragment();
const parts = text.split('\n');
let lastNode = null;
parts.forEach(function(part, index) {
if (index > 0) {
const br = document.createElement('br');
fragment.appendChild(br);
lastNode = br;
}
if (part) {
const node = document.createTextNode(part);
fragment.appendChild(node);
lastNode = node;
}
});
range.insertNode(fragment);

if (lastNode) {
const caret = document.createRange();
caret.setStartAfter(lastNode);
caret.collapse(true);
sel.removeAllRanges();
sel.addRange(caret);
}

// Сначала даём браузеру разложить все вставленные строки, затем измеряем холст.
requestAnimationFrame(function() {
editor.dispatchEvent(new Event('input', { bubbles: true }));
updateRatio();
saveHistory();
});
});

function clearEditor() {
if (typeof imageImportBusy !== 'undefined' && imageImportBusy) {
  imageImportNotice('Дождитесь окончания загрузки картинки, затем очистите холст.');
  return;
}
if (!confirm('Очистить холст и начать новый пост?')) return;
// Облако может остановить очистку, пока сервер подтверждает сохранение.
if (!document.dispatchEvent(new CustomEvent('texttura:before-new-post', {cancelable:true}))) return;
clearTimeout(typeTimer);
typeTimer = null;
savedSelection = null;
savedSelectionForFont = null;
releaseSelection();
window.getSelection().removeAllRanges();
editor.innerHTML = '';
editor.removeAttribute('style');
// Цвет выделения не должен оставаться от предыдущей работы.
['wordColor', 'tbWordColor', 'qbWordColor'].forEach(function(id) {
  var input = document.getElementById(id); if (input) input.value = input.defaultValue;
});
exportNode.querySelectorAll('.text-box').forEach(b => b.remove());
currentImgBox = null;
currentTextBox = null;
baseFontSlider.value = baseFontSlider.defaultValue;
lineHeightSlider.value = lineHeightSlider.defaultValue;
fontFamilySelector.selectedIndex = 0;
editor.style.fontSize = baseFontSlider.value + 'px';
editor.style.lineHeight = lineHeightSlider.value;
editor.style.fontFamily = fontFamilySelector.value;
document.getElementById('baseFontSizeLabel').textContent = baseFontSlider.value;
document.getElementById('lineHeightLabel').textContent = lineHeightSlider.value;
document.getElementById('bgColorPicker').value = '#ffffff';
document.getElementById('mainTextColorPicker').value = '#000000';
updateBgColor('#ffffff');
updateMainTextColor('#000000');
if (typeof setPostBackground === 'function') setPostBackground('');
// Убираем оставшиеся панели выделенной картинки/плашки.
['imgSettings', 'imgMiniBar', 'imgMobilePanel', 'tbSettings', 'tbRibbonSettings'].forEach(function(id) {
  var el = document.getElementById(id); if (el) el.style.display = 'none';
});
document.querySelectorAll('input[type="file"]').forEach(function(el) { el.value = ''; });
var notice = document.getElementById('imageImportNotice'); if (notice) notice.hidden = true;
updateImgCounter();
document.getElementById('charCount').textContent = '0';
updateRatio();
historyStack = [];
historyIndex = -1;
saveHistory();
document.dispatchEvent(new CustomEvent('texttura:new-post'));
focusEditor();
}

function setPreset(mode, btn) {
document.querySelectorAll('.preset').forEach(function(b) { b.classList.remove('active'); });
btn.classList.add('active');
const widthControl = document.getElementById('widthControl');
exportNode.classList.remove('no-tail');
widthControl.style.display = 'none';
if (mode === 'telegram') {
exportNode.style.width = '800px';
exportNode.classList.add('no-tail');
exportNode.style.borderRadius = '16px';
stageArea.style.backgroundColor = '#748eaa';
} else if (mode === 'custom') {
widthControl.style.display = 'block';
exportNode.classList.add('no-tail');
exportNode.style.borderRadius = '16px';
stageArea.style.backgroundColor = '#2a2f3a';
updateCustomWidth();
}
setTimeout(updateRatio, 100);
}

function updateCustomWidth() {
const w = document.getElementById('width').value;
document.getElementById('wLabel').textContent = w;
exportNode.style.width = w + 'px';
updateRatio();
}

