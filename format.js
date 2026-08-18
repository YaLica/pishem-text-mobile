function applyTextColor(color) {
restoreSelection();
document.execCommand('foreColor', false, color);
if (!currentTextBox) {
  exitSelectionFromFormatting();
  focusEditor();
} else {
  currentTextBox.focus();
}
saveHistory();
}

function format(command, value) {
if (currentImgBox) {
if (command === 'justifyLeft') { currentImgBox.classList.remove('align-right', 'align-center'); saveHistory(); return; }
else if (command === 'justifyCenter') { currentImgBox.classList.remove('align-right'); currentImgBox.classList.add('align-center'); saveHistory(); return; }
else if (command === 'justifyRight') { currentImgBox.classList.remove('align-center'); currentImgBox.classList.add('align-right'); saveHistory(); return; }
else if (command === 'justifyFull') { currentImgBox.classList.remove('align-right', 'align-center'); saveHistory(); return; }
}
restoreSelection();
document.execCommand(command, false, value || null);
if (!currentTextBox) {
  exitSelectionFromFormatting();
  focusEditor();
} else {
  currentTextBox.focus();
}
saveHistory();
}

function cleanFormat() {
restoreSelection();
const sel = window.getSelection();
if (!sel || !sel.rangeCount || sel.toString().length === 0) return;
document.execCommand('removeFormat', false, null);
saveHistory();
if (!currentTextBox) focusEditor(); else currentTextBox.focus();
}

function formatCode() {
const sel = window.getSelection();
if (sel && sel.rangeCount > 0 && sel.toString().length > 0) {
const range = sel.getRangeAt(0);
const codeNode = document.createElement('code');
codeNode.textContent = sel.toString();
range.deleteContents();
range.insertNode(codeNode);
if (!currentTextBox) exitSelectionFromFormatting();
saveHistory();
if (!currentTextBox) focusEditor(); else currentTextBox.focus();
}
}

function changeWordSize(factor) {
restoreSelection();
const sel = window.getSelection();
if (!sel || !sel.rangeCount || sel.toString().length === 0) return;
const range = sel.getRangeAt(0);
const wrapper = document.createElement('span');
try { range.surroundContents(wrapper); } catch (e) { wrapper.appendChild(range.extractContents()); range.insertNode(wrapper); }
const container = currentTextBox || editor;
const baseSize = parseFloat(getComputedStyle(container).fontSize) || (currentTextBox ? 24 : 32);
function scaleEl(el) {
let current = parseFloat(el.style.fontSize);
if (!current) current = parseFloat(getComputedStyle(el).fontSize) || baseSize;
let next = Math.round(current * factor);
if (next < 8) next = 8;
if (next > 200) next = 200;
el.style.fontSize = next + 'px';
el.setAttribute('data-custom-size', 'true');
}
scaleEl(wrapper);
wrapper.querySelectorAll('*').forEach(function(child) { if (child.style && child.style.fontSize) scaleEl(child); });
if (!currentTextBox) {
  exitSelectionFromFormatting();
  focusEditor();
} else {
  currentTextBox.focus();
}
updateRatio();
saveHistory();
}

function selectWordAtCaret() {
const sel = window.getSelection();
if (!sel || !sel.rangeCount) return;
const range = sel.getRangeAt(0);
if (!range.collapsed) return;

if (range.startContainer.nodeType === Node.TEXT_NODE) {
  const node = range.startContainer;
  const text = node.textContent;
  let start = range.startOffset;
  let end = range.startOffset;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;
  if (start < end) {
    range.setStart(node, start);
    range.setEnd(node, end);
    sel.removeAllRanges();
    sel.addRange(range);
    savedSelection = range.cloneRange();
  }
}
}

function applyWordFont(font) {
if (!font) return;
restoreSelection();
let sel = window.getSelection();

if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
selectWordAtCaret();
sel = window.getSelection();
}

if (!sel || !sel.rangeCount || sel.toString().trim().length === 0) return;

document.execCommand('fontName', false, font);

const scope = currentTextBox || editor;
scope.querySelectorAll('font[face]').forEach(el => {
const span = document.createElement('span');
span.style.fontFamily = el.getAttribute('face');
span.setAttribute('data-custom-font', 'true');
while (el.firstChild) span.appendChild(el.firstChild);
el.parentNode.replaceChild(span, el);
});

if (!currentTextBox) exitSelectionFromFormatting();
updateRatio();
saveHistory();
if (!currentTextBox) focusEditor(); else currentTextBox.focus();
}

function deleteSelection() {
restoreSelection();
const sel = window.getSelection();
if (!sel || !sel.rangeCount || sel.toString().length === 0) return;
sel.getRangeAt(0).deleteContents();
updateImgCounter();
document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
updateRatio();
saveHistory();
if (!currentTextBox) focusEditor(); else currentTextBox.focus();
}

function sanitizeUrl(rawUrl) {
if (!rawUrl) return '';
let url = rawUrl.trim();

url = url.replace(/^(https?:\/\/)+/gi, '');
url = url.replace(/^(http:\/\/)+/gi, '');

if (/^@([a-zA-Z0-9_]{3,})$/.test(url)) {
return 'https://t.me/' + url.slice(1);
}

if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) {
return 'mailto:' + url;
}
if (/^[\+]?[0-9\s\-\(\)]{7,}$/.test(url) && !url.includes('.')) {
return 'tel:' + url.replace(/[\s\-\(\)]/g, '');
}

if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) {
url = 'https://' + url.replace(/^\/+/, '');
}

url = url.replace(/\s+/g, '');

return url;
}

function insertLink() {
restoreSelection();
const sel = window.getSelection();

if (!sel || sel.rangeCount === 0 || sel.toString().trim().length === 0) {
alert('Сначала выдели слово или текст, который хочешь сделать ссылкой!');
return;
}

const rangeBackup = sel.getRangeAt(0).cloneRange();

let input = prompt('Введи адрес ссылки или @username:', '');
if (!input) return;

let url = sanitizeUrl(input);
if (!url || url === 'https://') return;

if (currentTextBox) currentTextBox.focus(); else editor.focus();
const currentSel = window.getSelection();
currentSel.removeAllRanges();
currentSel.addRange(rangeBackup);

document.execCommand('createLink', false, url);
if (!currentTextBox) exitSelectionFromFormatting();

saveHistory();
if (!currentTextBox) focusEditor(); else currentTextBox.focus();
}

