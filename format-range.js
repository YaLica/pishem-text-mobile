/* Форматирование на Selection + Range. Не использует document.execCommand. */
function finishTextOperation() {
  updateRatio();
  saveHistory();
  const scope = getEditingScope();
  if (scope && scope.focus) scope.focus();
}

function applyTextColor(color) {
  const mark = applyRangeStyle(
    { color: color },
    { color: 'inherit' },
    function(range) {
      return selectionHasStyle(range, 'color', function(value) {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.appendChild(probe);
        const wanted = getComputedStyle(probe).color;
        probe.remove();
        return value === wanted;
      });
    },
    { property: 'color' }
  );
  if (mark) finishTextOperation();
}

function applyAlignment(command) {
  const alignments = {
    justifyLeft: 'left',
    justifyCenter: 'center',
    justifyRight: 'right',
    justifyFull: 'justify'
  };
  const align = alignments[command];
  if (!align) return false;

  if (currentImgBox) {
    if (command === 'justifyCenter') {
      currentImgBox.classList.remove('align-right');
      currentImgBox.classList.add('align-center');
    } else if (command === 'justifyRight') {
      currentImgBox.classList.remove('align-center');
      currentImgBox.classList.add('align-right');
    } else {
      currentImgBox.classList.remove('align-right', 'align-center');
    }
    saveHistory();
    return true;
  }

  const scope = getEditingScope();
  scope.style.textAlign = align;
  scope.style.textAlignLast = align === 'justify' ? 'left' : align;
  finishTextOperation();
  return true;
}

function format(command) {
  if (/^justify/.test(command)) {
    applyAlignment(command);
    return;
  }

  const definitions = {
    bold: {
      on: { fontWeight: '700' }, off: { fontWeight: '400' }, scrub: { property: 'fontWeight' },
      active: function(r) { return selectionHasStyle(r, 'fontWeight', function(v) { return parseInt(v, 10) >= 600 || v === 'bold'; }); }
    },
    italic: {
      on: { fontStyle: 'italic' }, off: { fontStyle: 'normal' }, scrub: { property: 'fontStyle' },
      active: function(r) { return selectionHasStyle(r, 'fontStyle', function(v) { return v === 'italic' || v === 'oblique'; }); }
    },
    underline: {
      on: { textDecorationLine: 'underline' }, off: { textDecorationLine: 'none' }, scrub: { decorationToken: 'underline' },
      active: function(r) { return selectionHasStyle(r, 'textDecorationLine', function(v) { return v.includes('underline'); }); }
    },
    strikeThrough: {
      on: { textDecorationLine: 'line-through' }, off: { textDecorationLine: 'none' }, scrub: { decorationToken: 'line-through' },
      active: function(r) { return selectionHasStyle(r, 'textDecorationLine', function(v) { return v.includes('line-through'); }); }
    }
  };
  const def = definitions[command];
  if (!def) return;
  const mark = applyRangeStyle(def.on, def.off, def.active, def.scrub);
  if (mark) finishTextOperation();
}

function cleanFormat() {
  const range = getUsableRange(true);
  if (!range) return;
  const mark = makeTextMark({
    fontWeight: '400',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    background: 'transparent'
  }, { 'data-format-reset': 'true' });
  wrapRange(range, mark, true, { all: true });
  finishTextOperation();
}

function formatCode() {
  const range = getUsableRange(true);
  if (!range) return;
  const node = nodeAtRangeStart(range);
  const activeCode = node && node.closest && node.closest('code');
  const wrapper = activeCode
    ? makeTextMark({ fontFamily: 'inherit', background: 'transparent', padding: '0' })
    : document.createElement('code');
  if (!activeCode) wrapper.setAttribute('data-text-mark', 'true');
  wrapRange(range, wrapper, true);
  finishTextOperation();
}

function changeWordSize(factor) {
  const range = getUsableRange(true);
  if (!range) return;
  const start = nodeAtRangeStart(range);
  const current = parseFloat(start ? getComputedStyle(start).fontSize : getComputedStyle(getEditingScope()).fontSize) || 32;
  const next = Math.max(8, Math.min(200, Math.round(current * factor)));
  const mark = makeTextMark({ fontSize: next + 'px' }, { 'data-custom-size': 'true' });
  wrapRange(range, mark, true, { property: 'fontSize' });
  finishTextOperation();
}

function selectWordAtCaret() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return;
  const node = range.startContainer;
  const text = node.textContent;
  let start = range.startOffset;
  let end = start;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  while (end < text.length && !/\s/.test(text[end])) end++;
  if (start === end) return;
  range.setStart(node, start);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
  savedSelection = range.cloneRange();
}

function applyWordFont(font) {
  if (!font) return;
  restoreSelection(savedSelectionForFont || savedSelection);
  let sel = window.getSelection();
  if (sel && sel.rangeCount && sel.isCollapsed) {
    selectWordAtCaret();
    sel = window.getSelection();
  }
  if (!sel || !sel.rangeCount || !sel.toString().trim()) return;
  savedSelection = sel.getRangeAt(0).cloneRange();
  const range = getUsableRange(true);
  if (!range) return;
  const mark = makeTextMark({ fontFamily: font }, { 'data-custom-font': 'true' });
  wrapRange(range, mark, true, { property: 'fontFamily' });
  savedSelectionForFont = null;
  finishTextOperation();
}

function deleteSelection() {
  const range = getUsableRange(true);
  if (!range) return;
  range.deleteContents();
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedSelection = range.cloneRange();
  updateImgCounter();
  document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
  finishTextOperation();
}

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/^(https?:\/\/)+/gi, '').replace(/^(http:\/\/)+/gi, '');
  if (/^@([a-zA-Z0-9_]{3,})$/.test(url)) return 'https://t.me/' + url.slice(1);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return 'mailto:' + url;
  if (/^[+]?[0-9\s\-()]{7,}$/.test(url) && !url.includes('.')) return 'tel:' + url.replace(/[\s\-()]/g, '');
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  return url.replace(/\s+/g, '');
}

function applyLinkToSelection(rawUrl) {
  const url = sanitizeUrl(rawUrl);
  if (!url || url === 'https://') return false;
  const range = getUsableRange(true);
  if (!range) return false;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('data-text-mark', 'true');
  wrapRange(range, link, true);
  finishTextOperation();
  return true;
}

function insertLink() {
  const range = getUsableRange(true);
  if (!range) {
    alert('Сначала выдели слово или текст, который хочешь сделать ссылкой!');
    return;
  }
  savedSelection = range.cloneRange();
  const input = prompt('Введи адрес ссылки или @username:', '');
  if (!input) return;
  restoreSelection(savedSelection);
  applyLinkToSelection(input);
}
