function generatePlainText() {
const clone = editor.cloneNode(true);
clone.querySelectorAll('.img-box, .img-spacer-left, .img-spacer-right').forEach(el => el.remove());
return clone.innerText.replace(/\u200B/g, '').trim();
}

/* ==========================================================================
   ЭКСПОРТ PNG: рисует сам браузер

   Раньше картинку рисовал html2canvas. Он не поддерживает
   box-decoration-break: clone — то самое свойство, которым сделана подложка
   под текстом. Поэтому подложку приходилось вычислять вручную, и она
   разъезжалась с текстом.

   Теперь разметка отдаётся браузеру через SVG foreignObject: он верстает её
   своим движком — так же, как в редакторе. Подложка, переносы строк,
   выравнивание по ширине и шрифты получаются штатно, без вычислений.

   html2canvas остаётся страховкой: если новый способ не сработает,
   экспорт молча уходит на старый путь.
   ========================================================================== */

const EXPORT_SCALE = 2;
const exportFontCache = {};
let exportCssCache = null;

// Собираем CSS страницы: без него разметка внутри картинки будет без стилей.
function collectPageCss() {
  if (exportCssCache !== null) return Promise.resolve(exportCssCache);

  let css = '';
  try {
    for (const sheet of document.styleSheets) {
      if (sheet.href && sheet.href.indexOf(location.origin) !== 0) continue; // чужие домены не читаются
      let rules = null;
      try { rules = sheet.cssRules; } catch (e) { rules = null; }
      if (!rules) continue;
      for (const rule of rules) css += rule.cssText + '\n';
    }
  } catch (e) { css = ''; }

  if (css) { exportCssCache = css; return Promise.resolve(css); }

  // Запасной путь: если правила прочитать не дали — качаем файл напрямую.
  const link = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  if (!link) { exportCssCache = ''; return Promise.resolve(''); }
  return fetch(link.href)
    .then(r => r.text())
    .then(t => { exportCssCache = t; return t; })
    .catch(() => { exportCssCache = ''; return ''; });
}

function fileToBase64(url, attempt) {
  if (exportFontCache[url]) return Promise.resolve(exportFontCache[url]);
  attempt = attempt || 1;
  return fetch(url, { cache: 'force-cache' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    })
    .then(buf => {
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const out = 'data:font/woff2;base64,' + btoa(bin);
      exportFontCache[url] = out;
      return out;
    })
    .catch(err => {
      // Одна сорвавшаяся загрузка = потерянный шрифт в PNG. Раньше ошибка
      // гасилась молча, и картинка выходила с чужим шрифтом «через раз».
      if (attempt >= 3) {
        console.warn('PNG: шрифт не загрузился после 3 попыток:', url, err && err.message);
        throw err;
      }
      return new Promise(r => setTimeout(r, 150 * attempt))
        .then(() => fileToBase64(url, attempt + 1));
    });
}

// Берём спецификации шрифтов из <link> самой страницы: так набор начертаний
// заведомо совпадает с тем, что уже отображается в редакторе.
function fontSpecsFromPage() {
  const specs = new Map();
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const matches = link.href.match(/family=[^&]+/g) || [];
    matches.forEach(part => {
      const spec = part.slice('family='.length);
      const name = decodeURIComponent(spec.split(':')[0]).replace(/\+/g, ' ');
      if (!specs.has(name)) specs.set(name, spec);
    });
  });
  return specs;
}

function usedFontSpecs() {
  const available = fontSpecsFromPage();
  const used = [];
  const seen = {};
  const nodes = exportNode.querySelectorAll('*');
  const all = [exportNode].concat(Array.prototype.slice.call(nodes));
  all.forEach(el => {
    const family = getComputedStyle(el).fontFamily;
    if (!family) return;
    family.split(',').forEach(part => {
      const name = part.trim().replace(/^['"]|['"]$/g, '');
      if (available.has(name) && !seen[name]) { seen[name] = true; used.push(available.get(name)); }
    });
  });
  return used;
}

// Шрифты нужно вложить внутрь картинки: внешние ссылки оттуда не работают.
function buildFontCss() {
  const specs = usedFontSpecs();
  if (!specs.length) return Promise.resolve('');
  const url = 'https://fonts.googleapis.com/css2?' + specs.map(s => 'family=' + s).join('&') + '&display=swap';
  return fetch(url, { cache: 'force-cache' })
    .then(r => r.text())
    .then(css => {
      const urls = [];
      const re = /url\((https:\/\/[^)]+)\)/g;
      let m;
      while ((m = re.exec(css))) { if (urls.indexOf(m[1]) === -1) urls.push(m[1]); }
      return Promise.all(urls.map(u =>
        fileToBase64(u).then(data => ({ u: u, data: data })).catch(() => {
          console.warn('PNG: не удалось вшить файл шрифта:', u);
          return null;
        })
      )).then(pairs => {
        pairs.forEach(p => { if (p) css = css.split(p.u).join(p.data); });
        return css;
      });
    })
    .catch(() => '');
}

function loadImage(src) {
  // Раньше decode() и onload соревновались, кто первым отдаст картинку.
  // decode() часто выигрывал, и холст рисовался до того, как браузер
  // применил шрифты внутри SVG — отсюда «то тот шрифт, то не тот».
  // Теперь ждём именно полной загрузки, и только потом decode.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.decode) { resolve(img); return; }
      img.decode().then(() => resolve(img)).catch(() => resolve(img));
    };
    img.onerror = () => reject(new Error('SVG image failed'));
    img.src = src;
  });
}

// Принудительный прогрев шрифтов.
// Файлы уже скачаны и вшиты в CSS как base64. Подкладываем этот CSS в саму
// страницу и просим браузер по-настоящему подготовить каждое начертание.
// После этого шрифт лежит в памяти уже разобранным, и рисование SVG не
// начинается раньше, чем шрифт готов.
async function warmUpFonts(fontCss) {
  if (!fontCss || !document.fonts) return;

  const style = document.createElement('style');
  style.setAttribute('data-export-warmup', '1');
  style.textContent = fontCss;
  document.head.appendChild(style);

  try {
    const families = [];
    const re = /font-family:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(fontCss))) {
      if (families.indexOf(m[1]) === -1) families.push(m[1]);
    }

    const jobs = [];
    families.forEach(name => {
      ['normal 400 32px', 'normal 700 32px', 'italic 400 32px'].forEach(spec => {
        jobs.push(document.fonts.load(spec + ' "' + name + '"').catch(() => null));
      });
    });
    await Promise.all(jobs);
    await document.fonts.ready;

    // два кадра на то, чтобы браузер закончил внутреннюю подготовку
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  } catch (e) {
    console.warn('PNG: прогрев шрифтов не удался:', e && e.message);
  } finally {
    if (style.parentNode) style.parentNode.removeChild(style);
  }
}

function buildExportClone() {
  const clone = exportNode.cloneNode(true);
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.style.transition = 'none';
  clone.style.boxShadow = 'none';

  // Убираем всё служебное: рамки, ручки, кнопки, выделение.
  clone.querySelectorAll(
    '.tb-drag-frame, .tb-handle, .tb-copy, .tb-delete, .tb-resize, .tb-rotate,' +
    '.img-resizer, .img-rotate-handle, #snapGuideV, #snapGuideH'
  ).forEach(el => el.remove());
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('[contenteditable]').forEach(el => el.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('[placeholder]').forEach(el => el.removeAttribute('placeholder'));
  return clone;
}

async function exportNativeCanvas() {
  const width = Math.ceil(exportNode.offsetWidth);
  const height = Math.ceil(exportNode.offsetHeight);
  if (!width || !height) throw new Error('нулевой размер холста');

  const clone = buildExportClone();
  const results = await Promise.all([collectPageCss(), buildFontCss()]);
  const pageCss = results[0];
  const fontCss = results[1];

  const markup = new XMLSerializer().serializeToString(clone);
  const css = fontCss + '\n' + pageCss +
    '\n#export-node{margin:0 !important;box-shadow:none !important;transform:none !important;}' +
    '\n*{-webkit-text-size-adjust:100%;text-size-adjust:100%;}';

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + (width * EXPORT_SCALE) +
    '" height="' + (height * EXPORT_SCALE) + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<foreignObject x="0" y="0" width="' + width + '" height="' + height + '">' +
    '<div xmlns="http://www.w3.org/1999/xhtml">' +
    '<style><![CDATA[' + css + ']]></style>' +
    markup +
    '</div></foreignObject></svg>';

  const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  // 1. Готовим шрифты заранее.
  await warmUpFonts(fontCss);

  // 2. Первый проход — «холостой». Браузер разбирает разметку и шрифты
  //    внутри SVG. Результат не используем.
  try { await loadImage(src); } catch (e) { /* не критично */ }

  // 3. Второй проход — рабочий. К этому моменту всё уже подготовлено,
  //    поэтому шрифт попадает в картинку с первого раза.
  const img = await loadImage(src);

  const canvas = document.createElement('canvas');
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Пустой результат означает, что браузер не отрисовал разметку.
  const probe = ctx.getImageData(0, 0, Math.min(canvas.width, 40), Math.min(canvas.height, 40)).data;
  let filled = false;
  for (let i = 3; i < probe.length; i += 4) { if (probe[i] !== 0) { filled = true; break; } }
  if (!filled) throw new Error('пустая картинка');

  return canvas;
}

function exportFallbackCanvas() {
  return html2canvas(exportNode, {
    backgroundColor: null,
    scale: EXPORT_SCALE,
    useCORS: true,
    width: exportNode.offsetWidth,
    windowWidth: Math.max(document.documentElement.clientWidth, 1024),
    windowHeight: Math.max(document.documentElement.clientHeight, exportNode.offsetHeight + 200),
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0
  });
}

async function processExport() {
const btn = document.getElementById('exportBtn');
const originalText = btn.innerHTML;
btn.innerHTML = '⏳ Рисую...';
btn.disabled = true;
editor.querySelectorAll('.img-box').forEach(function(i) { i.classList.remove('selected'); });
document.querySelectorAll('.text-box.selected').forEach(function(b) { b.classList.remove('selected'); });
currentImgBox = null;

const savedTransform = zoomWrapper.style.transform;
zoomWrapper.style.transform = 'scale(1)';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);

if (document.fonts) { try { await document.fonts.ready; } catch (e) {} }
await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });

let canvas = null;
try {
  canvas = await exportNativeCanvas();
} catch (err) {
  console.warn('PNG: браузерный экспорт не удался, пробую html2canvas:', err && err.message);
  try {
    canvas = await exportFallbackCanvas();
  } catch (err2) {
    console.error('PNG: не удалось создать картинку:', err2);
    zoomWrapper.style.transform = savedTransform;
    btn.innerHTML = originalText;
    btn.disabled = false;
    updateRatio();
    alert('Не удалось создать PNG. Попробуй ещё раз.');
    return;
  }
}

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
link.remove();
finish();
}, 'image/png');
} else {
const link = document.createElement('a');
link.download = 'texter-post.png';
link.href = dataUrl;
document.body.appendChild(link);
link.click();
link.remove();
finish();
}
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
