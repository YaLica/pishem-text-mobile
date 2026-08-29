/* Единый движок Selection + Range. Не использует document.execCommand. */
/* Где сейчас идёт правка текста.

   Раньше здесь смотрели только на currentTextBox — привязку к последней
   выбранной плашке. Беда в том, что привязка не снимается при возврате
   в основной текст: она живёт, пока плашку не удалят. Поэтому после
   работы с плашкой кнопки форматирования считали своей областью плашку,
   выделение в основном тексте в неё не попадало, и нажатие просто
   не срабатывало. Отсюда и было «иногда работает, иногда нет».

   Теперь опираемся на само выделение: где текст выделен, там и правим.
   Порядок проверки — удержанное выделение, живое, последнее сохранённое.
   Привязку currentTextBox не трогаем: на неё смотрят настройки плашки
   в шторке, и сбрасывать её нельзя. */
function getEditingScope() {
  var range = null;

  try {
    if (typeof stickySelection !== 'undefined' && stickySelection && stickyAlive()) {
      range = stickySelection;
    }
  } catch (e) {}

  if (!range) {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) range = sel.getRangeAt(0);
  }

  if (!range) {
    try {
      if (typeof savedSelection !== 'undefined' && savedSelection) range = savedSelection;
    } catch (e) {}
  }

  if (range) {
    var node = range.commonAncestorContainer;
    if (node && node.nodeType === 3) node = node.parentElement;
    if (node && node.closest) {
      var box = node.closest('.text-box');
      if (box) {
        var field = box.querySelector('.tb-content');
        return (field && field.isConnected) ? field : box;
      }
      if (typeof editor !== 'undefined' && editor && editor.contains(node)) return editor;
    }
  }

  // Выделения нет вовсе — держимся за последнюю выбранную плашку, как раньше.
  if (typeof currentTextBox !== 'undefined' && currentTextBox && currentTextBox.isConnected) {
    return currentTextBox;
  }
  return editor;
}

function rangeInside(scope, range) {
  return !!(scope && range && scope.contains(range.commonAncestorContainer));
}

/* ---------- Удержание выделения ----------
   Раньше выделение жило только до следующего события браузера. Обработчик
   висит на selectionchange, а браузер посылает это событие и когда сам
   схлопывает выделение в точку — например при уходе фокуса в панель. Тогда
   вместо выделенного слова запоминалась точка, и выделение «слетало». Успеет
   событие прийти или нет — дело случая, поэтому иногда выделение держалось
   несколько нажатий, а иногда пропадало сразу.

   Теперь осознанное выделение (не точка) хранится отдельно и переживает
   схлопывание. Снимается по клику вне выделенного текста, по Escape и при
   печати поверх — как везде. */

let stickySelection = null;

/* Запомнить выделение, если оно осознанное: не точка и с текстом */
function holdSelection() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed || !sel.toString().trim()) return;
  const inEditor = rangeInside(editor, range);
  const inBox = typeof currentTextBox !== 'undefined' && currentTextBox
                && rangeInside(currentTextBox, range);
  if (inEditor || inBox) stickySelection = range.cloneRange();
}

function releaseSelection() {
  stickySelection = null;
}

/* Живо ли удержанное выделение: узлы могли переложить или удалить */
function stickyAlive() {
  if (!stickySelection) return false;
  const node = stickySelection.commonAncestorContainer;
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el || !el.isConnected) { stickySelection = null; return false; }
  return true;
}

/* Попала ли точка клика внутрь удержанного выделения */
function pointInsideSticky(x, y) {
  if (!stickyAlive()) return false;
  const rects = stickySelection.getClientRects();
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2) {
      return true;
    }
  }
  return false;
}

/* Клик мимо выделенного текста — отпускаем. Клик по панели и тулбарам не
   считается: там кнопки, которые с этим выделением и работают. */
document.addEventListener('pointerdown', function (e) {
  if (!stickyAlive()) return;
  if (e.target.closest && (e.target.closest('.panel') || e.target.closest('.toolbar')
      || e.target.closest('#quickBar') || e.target.closest('#imgMiniBar'))) return;
  if (!pointInsideSticky(e.clientX, e.clientY)) releaseSelection();
}, true);

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') releaseSelection();
}, true);

/* Печать, вставка и удаление поверх выделения — отпускаем, как везде.
   Стрелки и обычные нажатия сюда не попадают: beforeinput приходит только
   когда текст действительно меняется. */
document.addEventListener('beforeinput', function () {
  releaseSelection();
}, true);

function saveSelectionBeforeAction() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const inEditor = rangeInside(editor, range);
  const inBox = typeof currentTextBox !== 'undefined' && currentTextBox && rangeInside(currentTextBox, range);
  if (!inEditor && !inBox) return;
  savedSelection = range.cloneRange();
  // Осознанное выделение запоминаем, схлопнутой точкой его не перебиваем.
  if (!range.collapsed && sel.toString().trim()) {
    stickySelection = range.cloneRange();
  }
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
  // Удержанное выделение важнее последнего положения курсора.
  const candidate = preferredRange
    || (stickyAlive() && rangeInside(scope, stickySelection) ? stickySelection : null)
    || savedSelection;
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
  // Удержанное выделение переезжает на новое место того же текста.
  if (stickySelection) stickySelection = range.cloneRange();
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
  // Если выделение удерживается, после применения формата оно должно
  // остаться на том же тексте, а не схлопнуться в точку.
  const keep = stickyAlive();
  const fragment = range.extractContents();
  if (scrub) scrubFragmentStyle(fragment, scrub.property, scrub.decorationToken, scrub.all);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  getEditingScope().normalize();
  if (keep) selectNodeContents(wrapper);
  else if (collapseAfter !== false) setCaretAfter(wrapper);
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

/* ---------- Снятие подчёркивания и зачёркивания ----------
   Подчёркивание и зачёркивание в CSS ведут себя не как остальные свойства:
   потомок НЕ может их отменить. Линия, заданная родителю, продолжает
   рисоваться поверх вложенного текста, даже если поставить ему none.
   Поэтому прежний способ «обернуть выделение в span с none» линию не убирал:
   надеть формат получалось, снять — нет.

   Здесь линия снимается с того элемента, который её задал, а сам элемент
   при необходимости делится на части: до выделения, выделение и после.
   Границы выделения запоминаются числом символов от начала плашки, потому
   что перекладывание узлов делает прежние ссылки недействительными. */

function declaresDecoration(el, token) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.style && (el.style.textDecorationLine || '').indexOf(token) !== -1) return true;
  if (token === 'underline' && el.tagName === 'U') return true;
  if (token === 'line-through' && (el.tagName === 'S' || el.tagName === 'STRIKE')) return true;
  return false;
}

function clearDecoration(el, token) {
  const current = (el.style && el.style.textDecorationLine)
    ? el.style.textDecorationLine
    : (getComputedStyle(el).textDecorationLine || '');
  const left = current.split(/\s+/).filter(function (t) {
    return t && t !== 'none' && t !== token;
  });
  el.style.textDecorationLine = left.length ? left.join(' ') : 'none';
  if (el.tagName === 'U' || el.tagName === 'S' || el.tagName === 'STRIKE') {
    const plain = document.createElement('span');
    plain.setAttribute('data-text-mark', 'true');
    plain.style.textDecorationLine = el.style.textDecorationLine;
    while (el.firstChild) plain.appendChild(el.firstChild);
    el.replaceWith(plain);
    return plain;
  }
  return el;
}

/* Сколько символов от начала области до точки выделения.
   Точка может указывать и на элемент, а не только на текст — тогда считаем
   символы до первого текста внутри этого элемента. */
function offsetInScope(scope, container, offset) {
  // Позиция границы в символах от начала области. Границей может быть как
  // текст, так и элемент: например после применения формата выделение
  // ставится на всю обёртку целиком, и тогда контейнер — сам элемент.
  //
  // Прежняя версия для элемента возвращала начало его первого текста и
  // смещение не учитывала. Из-за этого начало и конец выделения давали одну
  // и ту же позицию, снятие линий считало диапазон пустым и отказывалось
  // работать: подчёркивание и зачёркивание переставали сниматься, пока
  // выделение не переставишь заново.
  //
  // Теперь границу сначала приводим к точке в тексте, а потом считаем.
  let node = container;
  let shift = offset;

  if (container.nodeType === Node.ELEMENT_NODE) {
    const kids = container.childNodes;
    if (offset >= kids.length) {
      // Граница за последним ребёнком — это конец содержимого элемента.
      node = container;
      shift = container.textContent.length;
      let count = 0;
      const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        if (container.contains(n)) break;
        count += n.textContent.length;
      }
      return count + shift;
    }
    // Иначе — начало ребёнка с этим номером.
    const target = kids[offset];
    let count = 0;
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n === target || (target.nodeType === Node.ELEMENT_NODE && target.contains(n))) {
        return count;
      }
      count += n.textContent.length;
    }
    return count;
  }

  let count = 0;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n === node) return count + shift;
    count += n.textContent.length;
  }
  return count;
}

/* Обратное действие: по числу символов находим узел и позицию в нём */
function pointAtOffset(scope, target) {
  let count = 0;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let node, last = null;
  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    if (count + len >= target) return { node: node, offset: target - count };
    count += len;
    last = node;
  }
  return last ? { node: last, offset: last.textContent.length } : null;
}

/* Оборачивает участок текста внутри элемента в span без линии.
   Всё, что вне участка, остаётся с линией — соседние слова не страдают. */
function markSpanInside(owner, from, to, token) {
  const start = pointAtOffset(owner, from);
  const end = pointAtOffset(owner, to);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  const plain = document.createElement('span');
  plain.setAttribute('data-text-mark', 'true');
  plain.appendChild(range.extractContents());

  // внутри участка линию могли задавать и вложенные элементы
  Array.prototype.forEach.call(plain.querySelectorAll('*'), function (el) {
    if (declaresDecoration(el, token)) clearDecoration(el, token);
  });
  plain.style.textDecorationLine = 'none';

  range.insertNode(plain);
  return plain;
}

function removeDecorationFromRange(range, token) {
  const scope = getEditingScope();

  // Границы запоминаем числом символов от начала плашки: перекладывание
  // узлов делает прежние ссылки на них недействительными.
  const from = offsetInScope(scope, range.startContainer, range.startOffset);
  const to = offsetInScope(scope, range.endContainer, range.endOffset);
  if (to <= from) return null;

  // Элементы, которые задают линию. Идём от внешних к внутренним.
  let owners = [];
  if (declaresDecoration(scope, token)) owners.push(scope);
  Array.prototype.forEach.call(scope.querySelectorAll('*'), function (el) {
    if (declaresDecoration(el, token)) owners.push(el);
  });
  if (!owners.length) return null;

  owners.forEach(function (owner) {
    if (!owner.isConnected) return;

    // Начало этого элемента в символах от начала плашки
    const base = offsetInScope(scope, owner, 0);
    const total = owner.textContent.length;
    const localFrom = Math.max(0, from - base);
    const localTo = Math.min(total, to - base);
    if (localTo <= localFrom) return;

    // Линию с самого элемента снимаем...
    const box = clearDecoration(owner, token) || owner;

    // ...и заодно у вложенных элементов внутри выделения, иначе линия
    // останется на них. Делаем это до возврата линии на края.
    const q1 = pointAtOffset(box, localFrom);
    const q2 = pointAtOffset(box, localTo);
    if (q1 && q2) {
      const inside = document.createRange();
      inside.setStart(q1.node, q1.offset);
      inside.setEnd(q2.node, q2.offset);
      Array.prototype.slice.call(box.querySelectorAll('*')).forEach(function (el) {
        let hit = false;
        try { hit = inside.intersectsNode(el); } catch (e) { hit = false; }
        if (hit && declaresDecoration(el, token)) clearDecoration(el, token);
      });
    }

    // ...и возвращаем её тем частям, которые в выделение не попали.
    // Куски считаем заранее и оборачиваем с конца, чтобы уже вставленные
    // обёртки не сбивали отсчёт символов для следующего куска.
    const parts = [];
    if (localFrom > 0) parts.push([0, localFrom]);
    if (localTo < total) parts.push([localTo, total]);
    parts.reverse().forEach(function (p) {
      wrapPartWithDecoration(box, p[0], p[1], token);
    });


  });

  scope.normalize();

  // Возвращаем выделение на прежнее место
  const s1 = pointAtOffset(scope, from);
  const s2 = pointAtOffset(scope, to);
  let back = null;
  if (s1 && s2) {
    back = document.createRange();
    back.setStart(s1.node, s1.offset);
    back.setEnd(s2.node, s2.offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(back);
    savedSelection = back.cloneRange();
  }
  return back || scope;
}

/* Оборачивает участок текста элемента в span с линией */
function wrapPartWithDecoration(owner, from, to, token) {
  const start = pointAtOffset(owner, from);
  const end = pointAtOffset(owner, to);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  if (range.collapsed) return null;

  const keep = document.createElement('span');
  keep.setAttribute('data-text-mark', 'true');
  keep.style.textDecorationLine = token;
  keep.appendChild(range.extractContents());
  range.insertNode(keep);
  return keep;
}

/* ---------- Снятие моноширинного ----------
   Моноширинный задаёт тег <code>, а не свойство стиля. Накрыть его сверху
   нельзя: вложенный span наследует шрифт обёртки, и текст остаётся monospace.
   Поэтому обёртку разбираем: части до и после выделения снова оборачиваем
   в <code>, а выделенный участок остаётся без обёртки.
   Границы считаем в символах — перекладывание узлов рвёт ссылки на них. */

function wrapPartWithCode(owner, from, to) {
  const start = pointAtOffset(owner, from);
  const end = pointAtOffset(owner, to);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  if (range.collapsed) return null;
  const keep = document.createElement('code');
  keep.setAttribute('data-text-mark', 'true');
  keep.appendChild(range.extractContents());
  range.insertNode(keep);
  return keep;
}

function removeCodeFromRange(range) {
  const scope = getEditingScope();
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const owner = node && node.closest ? node.closest('code') : null;
  if (!owner || !scope.contains(owner)) return null;

  const from = offsetInScope(scope, range.startContainer, range.startOffset);
  const to = offsetInScope(scope, range.endContainer, range.endOffset);
  if (to <= from) return null;

  const base = offsetInScope(scope, owner, 0);
  const total = owner.textContent.length;
  const localFrom = Math.max(0, from - base);
  const localTo = Math.min(total, to - base);
  if (localTo <= localFrom) return null;

  // Куски вне выделения снова оборачиваем в <code>. С конца, чтобы
  // вставленные обёртки не сбивали отсчёт для следующего куска.
  // Сначала разбираем вложенные <code>, которые уже были внутри обёртки.
  // Делать это надо ДО возврата обёрток соседям, иначе мы разобрали бы и
  // свои же только что созданные обёртки, и соседние слова потеряли бы
  // моноширинный.
  Array.prototype.slice.call(owner.querySelectorAll('code')).forEach(function (el) {
    el.replaceWith.apply(el, Array.prototype.slice.call(el.childNodes));
  });
  owner.normalize();

  const parts = [];
  if (localFrom > 0) parts.push([0, localFrom]);
  if (localTo < total) parts.push([localTo, total]);
  parts.reverse().forEach(function (pr) {
    wrapPartWithCode(owner, pr[0], pr[1]);
  });

  // Саму обёртку убираем, дети встают на её место.
  const parent = owner.parentNode;
  owner.replaceWith.apply(owner, Array.prototype.slice.call(owner.childNodes));
  if (parent) parent.normalize();
  scope.normalize();

  const s1 = pointAtOffset(scope, from);
  const s2 = pointAtOffset(scope, to);
  if (s1 && s2) {
    const back = document.createRange();
    back.setStart(s1.node, s1.offset);
    back.setEnd(s2.node, s2.offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(back);
    savedSelection = back.cloneRange();
    return back;
  }
  return scope;
}

function applyRangeStyle(styles, inactiveStyles, isActive, scrub) {
  const range = getUsableRange(true);
  if (!range) return null;
  const active = isActive ? isActive(range) : false;

  // Линии снимаем отдельным путём: накрыть их сверху нельзя.
  if (active && scrub && scrub.decorationToken) {
    const cleared = removeDecorationFromRange(range, scrub.decorationToken);
    if (cleared) return cleared;
  }

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
