function prepareRibbonExportLayers(rootNode) {
const root = rootNode || exportNode;
const cleanups = [];
root.querySelectorAll('.text-box.mode-ribbon').forEach(function(box) {
const content = box.querySelector('.tb-content');
const ribbon = content && content.querySelector('.tb-ribbon');
if (!content || !ribbon || !ribbon.textContent.trim()) return;

const oldTransform = box.style.transform;
const oldContentPosition = content.style.position;
const oldRibbonPosition = ribbon.style.position;
const oldRibbonZ = ribbon.style.zIndex;
const oldRibbonBg = ribbon.style.background;

// Измеряем строки без поворота, чтобы координаты были локальными для плашки.
box.style.transform = 'none';
content.style.position = 'relative';
ribbon.style.position = 'relative';
ribbon.style.zIndex = '1';

const doc = root.ownerDocument || document;
const win = doc.defaultView || window;
const contentRect = content.getBoundingClientRect();
const style = win.getComputedStyle(ribbon);
const padL = parseFloat(style.paddingLeft) || 0;
const padR = parseFloat(style.paddingRight) || 0;
const padT = parseFloat(style.paddingTop) || 0;
const padB = parseFloat(style.paddingBottom) || 0;
const radius = style.borderRadius || '0px';
const background = style.backgroundColor || box.style.getPropertyValue('--ribbon-bg') || 'rgba(0,0,0,.85)';

const range = doc.createRange();
range.selectNodeContents(ribbon);
const rawRects = Array.from(range.getClientRects()).filter(function(rect) {
return rect.width > 0.5 && rect.height > 0.5;
});

// Range может вернуть несколько прямоугольников одной строки из-за вложенных span.
// Объединяем их по вертикальному положению.
const rows = [];
rawRects.forEach(function(rect) {
let row = rows.find(function(item) {
return Math.abs(item.top - rect.top) < Math.max(2, Math.min(item.height, rect.height) * 0.45);
});
if (!row) {
row = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
rows.push(row);
} else {
row.left = Math.min(row.left, rect.left);
row.right = Math.max(row.right, rect.right);
row.top = Math.min(row.top, rect.top);
row.bottom = Math.max(row.bottom, rect.bottom);
row.height = row.bottom - row.top;
}
});

if (!rows.length) {
box.style.transform = oldTransform;
content.style.position = oldContentPosition;
ribbon.style.position = oldRibbonPosition;
ribbon.style.zIndex = oldRibbonZ;
return;
}

const layer = doc.createElement('span');
layer.className = 'tb-ribbon-export-layer';
layer.setAttribute('aria-hidden', 'true');
layer.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;overflow:visible;';
rows.forEach(function(row) {
const band = doc.createElement('span');
band.className = 'tb-ribbon-export-band';
band.style.position = 'absolute';
band.style.left = (row.left - contentRect.left - padL) + 'px';
band.style.top = (row.top - contentRect.top - padT) + 'px';
band.style.width = (row.right - row.left + padL + padR) + 'px';
band.style.height = (row.bottom - row.top + padT + padB) + 'px';
band.style.background = background;
band.style.borderRadius = radius;
band.style.boxSizing = 'border-box';
layer.appendChild(band);
});

content.insertBefore(layer, content.firstChild);
ribbon.style.background = 'transparent';
box.style.transform = oldTransform;

cleanups.push(function() {
layer.remove();
box.style.transform = oldTransform;
content.style.position = oldContentPosition;
ribbon.style.position = oldRibbonPosition;
ribbon.style.zIndex = oldRibbonZ;
ribbon.style.background = oldRibbonBg;
});
});

return function cleanupRibbonExportLayers() {
cleanups.forEach(function(cleanup) { cleanup(); });
};
}

function collectTextBoxExportStyles() {
const records = [];
exportNode.querySelectorAll('.text-box').forEach(function(box, index) {
const content = box.querySelector('.tb-content');
if (!content) return;
const id = 'tb-export-' + index + '-' + Date.now();
box.setAttribute('data-export-id', id);
const boxStyle = getComputedStyle(box);
const contentStyle = getComputedStyle(content);
const ribbon = content.querySelector('.tb-ribbon');
const ribbonStyle = ribbon ? getComputedStyle(ribbon) : null;
records.push({
id: id,
box: {
width: boxStyle.width,
height: boxStyle.height,
left: box.style.left,
top: box.style.top,
transform: box.style.transform || boxStyle.transform,
transformOrigin: boxStyle.transformOrigin
},
content: {
width: contentStyle.width,
height: contentStyle.height,
fontSize: contentStyle.fontSize,
lineHeight: contentStyle.lineHeight,
fontFamily: contentStyle.fontFamily,
fontWeight: contentStyle.fontWeight,
fontStyle: contentStyle.fontStyle,
letterSpacing: contentStyle.letterSpacing,
textAlign: contentStyle.textAlign,
textAlignLast: contentStyle.textAlignLast,
wordBreak: contentStyle.wordBreak,
overflowWrap: contentStyle.overflowWrap,
whiteSpace: contentStyle.whiteSpace,
padding: contentStyle.padding,
boxSizing: contentStyle.boxSizing,
borderRadius: contentStyle.borderRadius,
background: contentStyle.background,
color: contentStyle.color
},
ribbon: ribbonStyle ? {
fontSize: ribbonStyle.fontSize,
lineHeight: ribbonStyle.lineHeight,
fontFamily: ribbonStyle.fontFamily,
fontWeight: ribbonStyle.fontWeight,
fontStyle: ribbonStyle.fontStyle,
letterSpacing: ribbonStyle.letterSpacing,
textAlign: ribbonStyle.textAlign,
textAlignLast: ribbonStyle.textAlignLast,
whiteSpace: ribbonStyle.whiteSpace,
padding: ribbonStyle.padding,
borderRadius: ribbonStyle.borderRadius
} : null
});
});
return records;
}

function applyTextBoxExportStyles(clonedDoc, records) {
(records || []).forEach(function(record) {
const box = clonedDoc.querySelector('[data-export-id="' + record.id + '"]');
if (!box) return;
const content = box.querySelector('.tb-content');
const ribbon = content && content.querySelector('.tb-ribbon');
Object.keys(record.box).forEach(function(key) {
if (record.box[key]) box.style.setProperty(key.replace(/[A-Z]/g, function(m){ return '-' + m.toLowerCase(); }), record.box[key], 'important');
});
if (content) Object.keys(record.content).forEach(function(key) {
if (record.content[key]) content.style.setProperty(key.replace(/[A-Z]/g, function(m){ return '-' + m.toLowerCase(); }), record.content[key], 'important');
});
if (ribbon && record.ribbon) Object.keys(record.ribbon).forEach(function(key) {
if (record.ribbon[key]) ribbon.style.setProperty(key.replace(/[A-Z]/g, function(m){ return '-' + m.toLowerCase(); }), record.ribbon[key], 'important');
});
});
}

function cleanupTextBoxExportIds() {
exportNode.querySelectorAll('.text-box[data-export-id]').forEach(function(box) { box.removeAttribute('data-export-id'); });
}

function generatePlainText() {
const clone = editor.cloneNode(true);
clone.querySelectorAll('.img-box, .img-spacer-left, .img-spacer-right').forEach(el => el.remove());
return clone.innerText.replace(/\u200B/g, '').trim();
}

function processExport() {
const btn = document.getElementById('exportBtn');
const originalText = btn.innerHTML;
btn.innerHTML = '⏳ Рисую...';
btn.disabled = true;
editor.querySelectorAll('.img-box').forEach(function(i) { i.classList.remove('selected'); });
currentImgBox = null;
const savedTransform = zoomWrapper.style.transform;
zoomWrapper.style.transform = 'scale(1)';
const textBoxExportStyles = collectTextBoxExportStyles();
const cleanupRibbonLayers = function(){};

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

setTimeout(function() {
html2canvas(exportNode, {
  backgroundColor: null,
  scale: 2,
  useCORS: true,
  width: exportNode.offsetWidth,
  // Ширина 800 px включала мобильный режим экспортного iframe и могла
  // активировать увеличение текста в узких плашках.
  windowWidth: Math.max(document.documentElement.clientWidth, 1024),
  windowHeight: Math.max(document.documentElement.clientHeight, exportNode.offsetHeight + 200),
  scrollX: 0,
  scrollY: 0,
  x: 0,
  y: 0,
  onclone: function(clonedDoc) {
    var root = clonedDoc.documentElement;
    var clonedBody = clonedDoc.body;
    if (root) {
      root.style.setProperty('-webkit-text-size-adjust', '100%');
      root.style.setProperty('text-size-adjust', '100%');
    }
    if (clonedBody) {
      clonedBody.style.setProperty('-webkit-text-size-adjust', '100%');
      clonedBody.style.setProperty('text-size-adjust', '100%');
    }
    clonedDoc.querySelectorAll('.text-box, .tb-content, .tb-ribbon').forEach(function(el) {
      el.style.setProperty('-webkit-text-size-adjust', '100%');
      el.style.setProperty('text-size-adjust', '100%');
    });
    applyTextBoxExportStyles(clonedDoc, textBoxExportStyles);
    var clonedExportNode = clonedDoc.getElementById('export-node');
    if (clonedExportNode) prepareRibbonExportLayers(clonedExportNode);
    var ed = clonedDoc.getElementById('editor');
    if (ed) {
      ed.style.setProperty('-webkit-hyphens', 'none');
      ed.style.setProperty('-moz-hyphens', 'none');
      ed.style.setProperty('-ms-hyphens', 'none');
      ed.style.setProperty('hyphens', 'none');
      ed.style.setProperty('word-break', 'normal');
      ed.style.setProperty('overflow-wrap', 'break-word');
      ed.style.setProperty('text-align', 'justify');
      ed.querySelectorAll('*').forEach(function(el){
        el.style.setProperty('-webkit-hyphens', 'none');
        el.style.setProperty('hyphens', 'none');
      });
    }
    var cn = clonedDoc.documentElement;
    if (cn) cn.setAttribute('lang', 'ru');
  }
}).then(function(canvas) {
const dataUrl = canvas.toDataURL('image/png');

let imgPreview = document.getElementById('previewImage');
if (!imgPreview) {
imgPreview = document.createElement('img');
imgPreview.id = 'previewImage';
imgPreview.style.cssText = 'width:100%; max-height:250px; object-fit:contain; border-radius:8px; border:1px solid #2a2f3a; margin-bottom:10px;';
const modalTextarea = document.getElementById('markdownOutput');
modalTextarea.parentNode.insertBefore(imgPreview, modalTextarea);
}
imgPreview.src = dataUrl;
imgPreview.style.display = 'block';

function finish() {
document.getElementById('markdownOutput').value = generatePlainText();
document.getElementById('textModal').style.display = 'flex';
btn.innerHTML = originalText;
btn.disabled = false;
zoomWrapper.style.transform = savedTransform;
cleanupRibbonLayers();
cleanupTextBoxExportIds();
updateRatio();
}

if (isIOS) {
canvas.toBlob(function(blob) {
if (blob) {
const file = new File([blob], 'texter-post.png', { type: 'image/png' });
if (navigator.canShare && navigator.canShare({ files: [file] })) {
navigator.share({ files: [file] }).then(finish).catch(finish);
return;
}
}
finish();
}, 'image/png');
} else if (isAndroid) {
canvas.toBlob(function(blob) {
if (blob && navigator.canShare) {
const file = new File([blob], 'texter-post.png', { type: 'image/png' });
if (navigator.canShare({ files: [file] })) {
navigator.share({ files: [file] }).then(finish).catch(finish);
return;
}
}
const link = document.createElement('a');
link.download = 'texter-post.png';
link.href = dataUrl;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
finish();
}, 'image/png');
} else {
const link = document.createElement('a');
link.download = 'texter-post.png';
link.href = dataUrl;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
finish();
}

}).catch(function(err) {
btn.innerHTML = originalText;
btn.disabled = false;
zoomWrapper.style.transform = savedTransform;
cleanupRibbonLayers();
cleanupTextBoxExportIds();
});
}, 100);
}

function escapeClipboardHtml(text) {
return String(text)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;');
}

function getClipboardStyle(parentState, el) {
const state = Object.assign({}, parentState);
const tag = el.tagName;

// Поддерживаем и старую, и новую модель оформления.
if (tag === 'B' || tag === 'STRONG') state.bold = true;
if (tag === 'I' || tag === 'EM') state.italic = true;
if (tag === 'U') state.underline = true;
if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') state.strike = true;
if (tag === 'CODE') state.code = true;
if (tag === 'A') state.href = sanitizeUrl(el.getAttribute('href') || '');

const style = el.style;
if (style) {
const weight = style.fontWeight;
if (weight) state.bold = weight === 'bold' || parseInt(weight, 10) >= 600;
if (style.fontStyle) state.italic = style.fontStyle === 'italic' || style.fontStyle === 'oblique';

const decoration = style.textDecorationLine || style.textDecoration || '';
if (decoration) {
if (decoration === 'none') {
state.underline = false;
state.strike = false;
} else {
if (decoration.includes('underline')) state.underline = true;
if (decoration.includes('line-through')) state.strike = true;
}
}
}
return state;
}

function wrapClipboardText(text, state) {
let html = escapeClipboardHtml(text.replace(/\u200B/g, ''));
if (!html) return '';
if (state.code) html = '<code>' + html + '</code>';
if (state.strike) html = '<s>' + html + '</s>';
if (state.underline) html = '<u>' + html + '</u>';
if (state.italic) html = '<i>' + html + '</i>';
if (state.bold) html = '<b>' + html + '</b>';
if (state.href) html = '<a href="' + escapeClipboardHtml(state.href) + '">' + html + '</a>';
return html;
}

function getEditorLines() {
const src = editor.cloneNode(true);
src.querySelectorAll('.img-box, .img-spacer-left, .img-spacer-right').forEach(function(el) { el.remove(); });

let html = '';
const initialState = {
bold: false,
italic: false,
underline: false,
strike: false,
code: false,
href: ''
};

function walk(node, state) {
node.childNodes.forEach(function(child) {
if (child.nodeType === Node.TEXT_NODE) {
html += wrapClipboardText(child.textContent, state);
return;
}
if (child.nodeType !== Node.ELEMENT_NODE) return;

const tag = child.tagName;
if (tag === 'BR') {
html += '\n';
return;
}

const nextState = getClipboardStyle(state, child);
if (tag === 'DIV' || tag === 'P' || child.classList.contains('editor-block')) {
if (html.length && !html.endsWith('\n')) html += '\n';
walk(child, nextState);
if (!html.endsWith('\n')) html += '\n';
} else {
walk(child, nextState);
}
});
}
walk(src, initialState);

let lines = html.split('\n');
while (lines.length && lines[0].trim() === '') lines.shift();
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

const cleaned = [];
let prevEmpty = false;
lines.forEach(function(line) {
const isEmpty = line.trim() === '';
if (!isEmpty || !prevEmpty) cleaned.push(line);
prevEmpty = isEmpty;
});
return cleaned;
}

function copyRichSelection(html) {
const temp = document.createElement('div');
temp.contentEditable = 'true';
temp.setAttribute('aria-hidden', 'true');
temp.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none;';
temp.innerHTML = html;
document.body.appendChild(temp);

const range = document.createRange();
range.selectNodeContents(temp);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);

let ok = false;
try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
sel.removeAllRanges();
temp.remove();
return ok;
}

async function writeToClipboard(html, plain, btnId) {
let ok = false;
const btn = btnId ? document.getElementById(btnId) : null;
const original = btn ? btn.innerHTML : '';

// Desktop Telegram надёжнее принимает форматирование из обычного rich-copy.
// На iOS/Android этот путь может быть запрещён — там используем Clipboard API.
if (!isMobile()) ok = copyRichSelection(html);

if (!ok && navigator.clipboard && window.ClipboardItem) {
  try {
    const fullHtml = '<div>' + html + '</div>';
    const item = new ClipboardItem({
      'text/html': new Blob([fullHtml], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    ok = true;
  } catch (_) { ok = false; }
}

if (!ok) ok = copyRichSelection(html);

if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
  try {
    await navigator.clipboard.writeText(plain);
    ok = true;
  } catch (_) { ok = false; }
}

if (ok && btn) {
  btn.innerHTML = '✅ Скопировано!';
  setTimeout(function() { btn.innerHTML = original; }, 2000);
}

restoreSelection();
}

async function copyForTelegram() {
if (!editor.innerText.trim()) return;
const lines = getEditorLines();

const finalHtml = lines.join('<br>');

// Plain-text строим напрямую из строк. innerText у элемента вне DOM
// в Chromium склеивает <br>, из-за чего раньше пропадали все отступы.
const finalPlain = lines.map(function(line) {
const row = document.createElement('div');
row.innerHTML = line;
row.querySelectorAll('a[href]').forEach(function(a) {
const href = sanitizeUrl(a.getAttribute('href'));
const text = a.textContent.trim();
a.textContent = href && text && text !== href ? text + ' (' + href + ')' : (href || text);
});
return row.textContent || '';
}).join('\n');

await writeToClipboard(finalHtml, finalPlain, 'copyTgBtn');
}

