/* Единый движок Selection + Range. Не использует document.execCommand. */
function getEditingScope() {
  if (typeof currentTextBox !== 'undefined' && currentTextBox && currentTextBox.isConnected) {
    return currentTextBox;
  }
  return editor;
}

function rangeInside(scope, range) {
  return !!(scope && range && scope.contains(range.commonAncestorContainer));
}

function saveSelectionBeforeAction() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const inEditor = rangeInside(editor, range);
  const inBox = typeof currentTextBox !== 'undefined' && currentTextBox && rangeInside(currentTextBox, range);
  if (inEditor || inBox) savedSelection = range.cloneRange();
}

document.addEventListener('selectionchange', saveSelectionBeforeAction);

function freezeSelectionForFont() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed || !sel.toString().trim()) {
    savedSelectionForFont = null;
    return;
  }
  const range = sel.getRangeAt(0);
  const scope = getEditingScope();
  savedSelectionForFont = rangeInside(scope, range) ? range.cloneRange() : null;
}

editor.addEventListener('keyup', saveSelectionBeforeAction);
editor.addEventListener('mouseup', saveSelectionBeforeAction);
editor.addEventListener('touchend', saveSelectionBeforeAction);

function restoreSelection(preferredRange) {
  const scope = getEditingScope();
  const candidate = preferredRange || savedSelection;
  if (scope && scope.focus) scope.focus();
  if (!candidate || !rangeInside(scope, candidate)) return false;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(candidate.cloneRange());
  return true;
}

function setCaretAfter(node) {
  if (!node || !node.parentNode) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedSelection = range.cloneRange();
}

function selectNodeContents(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  savedSelection = range.cloneRange();
}

function getUsableRange(requireText) {
  restoreSelection();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!rangeInside(getEditingScope(), range)) return null;
  if (requireText && (range.collapsed || !sel.toString())) return null;
  return range;
}

function makeTextMark(styles, attributes) {
  const mark = document.createElement('span');
  mark.setAttribute('data-text-mark', 'true');
  Object.keys(styles || {}).forEach(function(key) { mark.style[key] = styles[key]; });
  Object.keys(attributes || {}).forEach(function(key) { mark.setAttribute(key, attributes[key]); });
  return mark;
}

function scrubFragmentStyle(fragment, property, decorationToken, all) {
  if (all) {
    Array.from(fragment.querySelectorAll('*')).reverse().forEach(function(el) {
      if (el.matches('[data-text-mark],a,code,b,strong,i,em,u,s,strike,font')) {
        el.replaceWith.apply(el, Array.from(el.childNodes));
      } else if (el.hasAttribute('style')) {
        el.removeAttribute('style');
      }
    });
    return;
  }
  fragment.querySelectorAll('*').forEach(function(el) {
    if (decorationToken) {
      let tokens = (el.style.textDecorationLine || '').split(/\s+/).filter(Boolean);
      tokens = tokens.filter(function(token) { return token !== decorationToken; });
      el.style.textDecorationLine = tokens.length ? tokens.join(' ') : 'none';
      if (decorationToken === 'underline' && el.tagName === 'U') el.style.textDecorationLine = 'none';
      if (decorationToken === 'line-through' && (el.tagName === 'S' || el.tagName === 'STRIKE')) el.style.textDecorationLine = 'none';
    } else if (property) {
      el.style[property] = '';
      // Старые семантические теги из сохранённого контента тоже нейтрализуем.
      if (property === 'fontWeight' && (el.tagName === 'B' || el.tagName === 'STRONG')) el.style.fontWeight = 'inherit';
      if (property === 'fontStyle' && (el.tagName === 'I' || el.tagName === 'EM')) el.style.fontStyle = 'inherit';
      if (property === 'fontFamily' && el.tagName === 'FONT') el.removeAttribute('face');
      if (property === 'color' && el.tagName === 'FONT') el.removeAttribute('color');
    }
  });
}

function wrapRange(range, wrapper, collapseAfter, scrub) {
  const fragment = range.extractContents();
  if (scrub) scrubFragmentStyle(fragment, scrub.property, scrub.decorationToken, scrub.all);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  getEditingScope().normalize();
  if (collapseAfter !== false) setCaretAfter(wrapper);
  else selectNodeContents(wrapper);
  return wrapper;
}

function nodeAtRangeStart(range) {
  let node = range.startContainer;
  if (node.nodeType === Node.ELEMENT_NODE) {
    node = node.childNodes[Math.min(range.startOffset, Math.max(0, node.childNodes.length - 1))] || node;
  }
  while (node && node.nodeType === Node.ELEMENT_NODE && node.firstChild) node = node.firstChild;
  return node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

function selectionHasStyle(range, property, expected) {
  const node = nodeAtRangeStart(range);
  if (!node || node === getEditingScope()) return false;
  const value = getComputedStyle(node)[property];
  if (expected(value)) return true;

  // Подчёркивание и зачёркивание не наследуются в вычисленном стиле: у вложенного
  // узла всегда стоит none, даже когда линия видна и задана на родителе. Из-за
  // этого повторное нажатие считало, что формата нет, и надевало его заново —
  // кнопка не снималась. Оборачивание в подложку добавляет ещё один слой и делает
  // это заметнее, но причина не в ней.
  //
  // Поэтому для линий дополнительно смотрим родителей вверх до самой плашки
  // или редактора: если линия задана там, формат считается активным.
  if (property !== 'textDecorationLine') return false;

  const scope = getEditingScope();
  let parent = node.parentElement;
  while (parent && parent !== scope) {
    if (expected(getComputedStyle(parent)[property] || '')) return true;
    parent = parent.parentElement;
  }
  return false;
}

function applyRangeStyle(styles, inactiveStyles, isActive, scrub) {
  const range = getUsableRange(true);
  if (!range) return null;
  const active = isActive ? isActive(range) : false;
  const mark = makeTextMark(active ? inactiveStyles : styles);
  return wrapRange(range, mark, true, scrub);
}

function insertTextAtSelection(text) {
  const range = getUsableRange(false);
  if (!range) return false;
  range.deleteContents();
  const normalized = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  const fragment = document.createDocumentFragment();
  let last = null;
  normalized.split('\n').forEach(function(part, index) {
    if (index) {
      last = document.createElement('br');
      fragment.appendChild(last);
    }
    if (part) {
      last = document.createTextNode(part);
      fragment.appendChild(last);
    }
  });
  if (!last) last = document.createTextNode('');
  range.insertNode(fragment);
  const caret = document.createRange();
  caret.setStartAfter(last);
  caret.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(caret);
  savedSelection = caret.cloneRange();
  return true;
}

function getStyledInlineParent(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  const scope = getEditingScope();
  while (current && current !== scope) {
    if (current.matches && current.matches('[data-text-mark],a,code,b,strong,i,em,u,s,strike,font,span')) return current;
    current = current.parentNode;
  }
  return null;
}

// Совместимое имя для старых обработчиков. Невидимые символы больше не создаём.
function exitSelectionFromFormatting() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return;
  savedSelection = range.cloneRange();
}
