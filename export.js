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

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

setTimeout(function() {
html2canvas(exportNode, {
  backgroundColor: null,
  scale: 2,
  useCORS: true,
  width: exportNode.offsetWidth,
  windowWidth: exportNode.offsetWidth,
  scrollX: 0,
  scrollY: 0,
  x: 0,
  y: 0,
  onclone: function(clonedDoc) {
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

