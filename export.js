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

function getEditorLines() {
const src = document.createElement('div');
src.innerHTML = editor.innerHTML;
src.querySelectorAll('.img-box, .img-spacer-left, .img-spacer-right').forEach(el => el.remove());

src.querySelectorAll('span, font').forEach(function(el) {
const parent = el.parentNode;
while (el.firstChild) parent.insertBefore(el.firstChild, el);
parent.removeChild(el);
});

src.querySelectorAll('strong').forEach(el => {
const b = document.createElement('b');
b.innerHTML = el.innerHTML;
el.parentNode.replaceChild(b, el);
});
src.querySelectorAll('em').forEach(el => {
const i = document.createElement('i');
i.innerHTML = el.innerHTML;
el.parentNode.replaceChild(i, el);
});

src.querySelectorAll('b,i,u,s,strike,del,a,code,div,p').forEach(function(el) {
el.removeAttribute('style');
el.removeAttribute('class');
el.removeAttribute('data-custom-size');
if (el.tagName === 'A') {
Array.from(el.attributes).forEach(a => { if (a.name !== 'href') el.removeAttribute(a.name); });
}
});

const walker = document.createTreeWalker(src, NodeFilter.SHOW_TEXT, null);
const textNodes = [];
while (walker.nextNode()) textNodes.push(walker.currentNode);
textNodes.forEach(t => { t.textContent = t.textContent.replace(/\u200B/g, ''); });

let html = '';
function walk(node) {
node.childNodes.forEach(function(child) {
if (child.nodeType === Node.TEXT_NODE) {
html += child.textContent;
} else if (child.nodeType === Node.ELEMENT_NODE) {
const tag = child.tagName;
if (tag === 'BR') {
html += '\n';
} else if (tag === 'DIV' || tag === 'P') {
if (html.length && !html.endsWith('\n')) html += '\n';
walk(child);
if (!html.endsWith('\n')) html += '\n';
} else {
const rawHref = child.getAttribute('href');
const cleanHref = rawHref ? sanitizeUrl(rawHref) : '';
html += '<' + tag.toLowerCase() + (tag === 'A' && cleanHref ? ' href="' + cleanHref + '"' : '') + '>';
walk(child);
html += '</' + tag.toLowerCase() + '>';
}
}
});
}
walk(src);

let lines = html.split('\n');

while (lines.length && lines[0].trim() === '') lines.shift();
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

const cleaned = [];
let prevEmpty = false;
for (const line of lines) {
const isEmpty = line.trim() === '';
if (isEmpty && prevEmpty) continue;
cleaned.push(line);
prevEmpty = isEmpty;
}
return cleaned;
}

async function writeToClipboard(html, plain, btnId) {
let ok = false;
const btn = btnId ? document.getElementById(btnId) : null;
const original = btn ? btn.innerHTML : '';

if (navigator.clipboard && window.ClipboardItem) {
  try {
    const fullHtml =
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
      '<div>' + html + '</div></body></html>';
    const item = new ClipboardItem({
      'text/html': new Blob([fullHtml], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' })
    });
    await navigator.clipboard.write([item]);
    ok = true;
  } catch (e) {
    ok = false;
  }
}

if (!ok) {
  const temp = document.createElement('div');
  temp.contentEditable = 'true';
  temp.style.position = 'fixed';
  temp.style.left = '-9999px';
  temp.style.top = '-9999px';
  temp.innerHTML = '<div>' + html + '</div>';
  document.body.appendChild(temp);

  const range = document.createRange();
  range.selectNodeContents(temp);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  try {
    ok = document.execCommand('copy');
  } catch (e) { ok = false; }
  document.body.removeChild(temp);
}

if (!ok && navigator.clipboard && navigator.clipboard.writeText) {
  try {
    await navigator.clipboard.writeText(plain);
    ok = true;
  } catch (err) { ok = false; }
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

const tempPlainDiv = document.createElement('div');
tempPlainDiv.innerHTML = finalHtml;

tempPlainDiv.querySelectorAll('a[href]').forEach(function(a) {
const href = sanitizeUrl(a.getAttribute('href'));
const text = a.textContent.trim();
if (href && text && text !== href) {
a.textContent = text + '\n' + href;
} else if (href) {
a.textContent = href;
}
});

const finalPlain = tempPlainDiv.innerText || tempPlainDiv.textContent;

await writeToClipboard(finalHtml, finalPlain, 'copyTgBtn');
}

