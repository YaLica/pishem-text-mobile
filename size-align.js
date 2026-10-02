/* ==========================================================================
   size-align.js — написан заново

   Делает три вещи и больше ничего:

   1. Размер текста до 240 px (ползунки и кнопки A+ / A−).
   2. Выравнивание отдельно для каждой строки ОСНОВНОГО текста.
   3. Подсветку активной кнопки выравнивания.

   Чего этот файл НЕ делает — специально:
   • не перехватывает вставку текста (этим занимается editor-events.js),
   • не перехватывает вставку картинок,
   • не перестраивает редактор при загрузке, вводе, фокусе и отмене.

   Почему так. Прошлая версия при каждом действии перекраивала весь
   редактор и считала картинку разделителем строк: текст заворачивался
   в блок, а картинка выталкивалась наружу. Из-за этого ехала вёрстка,
   картинка уходила вниз и переставала слушаться курсора.

   Здесь картинка — обычная часть своей строки. Трогается только та
   строка, на которой стоит курсор. Всё остальное остаётся как есть.
   ========================================================================== */

(function () {
  'use strict';

  var MAX_SIZE = 240;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  /* ======================= 1. размер до 240 ======================= */

  function raiseSliders() {
    var base = document.getElementById('baseFontSlider');
    if (base) base.max = String(MAX_SIZE);
    var tb = document.getElementById('tbFontSize');
    if (tb) tb.max = String(MAX_SIZE);
  }

  // кнопки A+ / A- упирались в 200
  function patchWordSize() {
    if (typeof window.changeWordSize !== 'function') return;
    if (typeof window.getUsableRange !== 'function') return;

    window.changeWordSize = function (factor) {
      var range = getUsableRange(true);
      if (!range) return;
      var start = nodeAtRangeStart(range);
      var current = parseFloat(
        start ? getComputedStyle(start).fontSize
              : getComputedStyle(getEditingScope()).fontSize
      ) || 32;
      var next = Math.max(8, Math.min(MAX_SIZE, Math.round(current * factor)));
      var mark = makeTextMark({ fontSize: next + 'px' }, { 'data-custom-size': 'true' });
      wrapRange(range, mark, true, { property: 'fontSize' });
      finishTextOperation();
    };
  }

  /* ======================= 2. выравнивание ======================= */

  var paragraphRoot;

  // Строку заканчивает перенос <br> или готовый блок.
  // Картинка НЕ заканчивает строку: она стоит в строке вместе с текстом.
  function isLineBreaker(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.tagName === 'BR') return true;
    return isBlock(node);
  }

  function isBlock(node) {
    return node && node.nodeType === 1 &&
           (node.tagName === 'DIV' || node.tagName === 'P' || node.hasAttribute('data-para')) &&
           !node.closest('.img-box');
  }

  // Ближайший блок, внутри которого лежит узел. Именно он отвечает за
  // выравнивание своей строки. Брать самый верхний блок нельзя: Enter
  // иногда вкладывает новую строку внутрь предыдущей, и тогда выравнивание
  // задело бы соседний текст.
  function nearestBlock(node) {
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== paragraphRoot) {
      if (isBlock(node)) return node;
      node = node.parentNode;
    }
    return null;
  }

  // поднимаемся до прямого потомка редактора
  function topLevel(node) {
    while (node && node.parentNode && node.parentNode !== paragraphRoot) {
      node = node.parentNode;
    }
    return (node && node.parentNode === paragraphRoot) ? node : null;
  }

  // строка целиком: соседи слева и справа до ближайшего переноса
  function lineAround(node) {
    var run = [node];
    var n = node.previousSibling;
    while (n && !isLineBreaker(n)) { run.unshift(n); n = n.previousSibling; }
    n = node.nextSibling;
    while (n && !isLineBreaker(n)) { run.push(n); n = n.nextSibling; }
    return run;
  }

  // верхнеуровневые узлы, попавшие в выделение
  function nodesInRange(range) {
    var out = [];
    Array.prototype.slice.call(paragraphRoot.childNodes).forEach(function (n) {
      var hit = false;
      try { hit = range.intersectsNode(n); } catch (e) { hit = false; }
      if (hit) out.push(n);
    });
    return out;
  }

  // пустой ли узел: пробелы и служебные символы за содержимое не считаем
  function isBlank(node) {
    if (node.nodeType !== 3) return false;
    return !(node.textContent || '').replace(/\u200B/g, '').trim();
  }

  // Строки, которые нужно выровнять. Каждая — либо готовый блок,
  // либо набор соседних узлов между переносами.
  function linesToAlign(range, caretMarker) {
    var lines = [];

    function addLine(nodes) {
      if (!nodes.length) return;
      // не дублируем уже собранную строку
      for (var i = 0; i < lines.length; i++) {
        if (lines[i][0] === nodes[0]) return;
      }
      lines.push(nodes);
    }

    if (range.collapsed) {
      // курсор стоит в тексте: берём ближайший блок, а если его нет —
      // собираем строку из соседей вокруг курсора
      var near = nearestBlock(caretMarker) || paragraphRoot;
      var top = caretMarker;
      while (top.parentNode !== near) top = top.parentNode;
      var run = lineAround(top);
      // Пустой перенос не превращаем в нулевой по высоте блок.
      if (!run.some(function (n) {
        return n.nodeType !== 8 && ((n.textContent || '').replace(/\u200B/g, '').length ||
          (n.nodeType === 1 && (n.matches('.img-box,img') || n.querySelector('.img-box,img'))));
      })) return lines;
      if (near !== paragraphRoot && run.length === near.childNodes.length) addLine([near]);
      else addLine(run);
      return lines;
    }

    // Выделение может пересекать несколько строк внутри одного контейнера.
    // Не берём контейнер целиком: проверяем каждую строку отдельно.
    function visit(parent) {
      var run = [];
      function flush() {
        if (!run.length) return;
        var part = document.createRange();
        part.setStartBefore(run[0]);
        part.setEndAfter(run[run.length - 1]);
        var overlap = part.cloneRange();
        if (overlap.compareBoundaryPoints(Range.START_TO_START, range) < 0)
          overlap.setStart(range.startContainer, range.startOffset);
        if (overlap.compareBoundaryPoints(Range.END_TO_END, range) > 0)
          overlap.setEnd(range.endContainer, range.endOffset);
        if (!overlap.collapsed && overlap.toString().replace(/\u200B/g, '').length) {
          addLine(parent !== paragraphRoot && run.length === parent.childNodes.length ? [parent] : run);
        }
        run = [];
      }
      Array.prototype.slice.call(parent.childNodes).forEach(function (n) {
        if (isLineBreaker(n)) {
          flush();
          if (isBlock(n)) visit(n);
        } else run.push(n);
      });
      flush();
    }
    visit(paragraphRoot);
    return lines;
  }

  // BR внутри жирного текста/ссылки тоже является границей строки.
  // Разделяем только inline-обёртки затронутого контейнера, перемещая
  // существующие узлы: картинки и их обработчики не пересоздаются.
  function exposeLineBreaks(range, caretMarker) {
    var scope = range.collapsed ? (nearestBlock(caretMarker) || paragraphRoot) : null;
    Array.prototype.slice.call(paragraphRoot.querySelectorAll('br')).forEach(function (br) {
      if (br.closest('.img-box')) return;
      var parentBlock = nearestBlock(br) || paragraphRoot;
      if (scope ? parentBlock !== scope : !range.intersectsNode(parentBlock)) return;
      while (br.parentNode !== parentBlock) {
        var inline = br.parentNode;
        var tail = inline.cloneNode(false);
        tail.removeAttribute('id');
        while (br.nextSibling) tail.appendChild(br.nextSibling);
        inline.parentNode.insertBefore(br, inline.nextSibling);
        if (tail.hasChildNodes()) br.parentNode.insertBefore(tail, br.nextSibling);
        if (!inline.hasChildNodes()) inline.remove();
      }
    });
  }

  function setAlign(el, align) {
    el.style.textAlign = align;
    // без второго свойства последняя строка убегает влево
    el.style.textAlignLast = (align === 'justify') ? 'left' : align;
  }

  // Оборачиваем строку в блок, чтобы у неё было своё выравнивание.
  // Картинки внутри остаются на своих местах — строка не распадается.
  function wrapLine(nodes) {
    var parent = nodes[0].parentNode;
    // В P допустим phrasing-элемент; display:block даёт отдельное выравнивание
    // без невалидного вложения DIV в P при сохранении и повторном открытии.
    var div = document.createElement(parent.tagName === 'P' ? 'span' : 'div');
    if (div.tagName === 'SPAN') div.style.display = 'block';
    div.setAttribute('data-para', '1');
    parent.insertBefore(div, nodes[0]);
    nodes.forEach(function (n) { div.appendChild(n); });

    // Блок сам начинает новую строку и сам её заканчивает, поэтому перенос
    // СРАЗУ ПОСЛЕ него становится лишним: он был концом этой же строки и
    // теперь добавил бы пустую строку, сдвинув текст ниже.
    var after = div.nextSibling;
    if (after && after.nodeType === 1 && after.tagName === 'BR') {
      div.parentNode.removeChild(after);
    }

    // Перенос ПЕРЕД блоком удалять нельзя. Он не относится к этой строке —
    // это конец предыдущей строки или пустая строка, поставленная Enter.
    // Раньше он тоже удалялся, и выравнивание абзаца съедало отступ над ним:
    // блок подпрыгивал вплотную к тексту выше, а нажатые Enter пропадали.
    return div;
  }

  function alignSelection(align, root) {
    paragraphRoot = root || editor;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;

    var range = sel.getRangeAt(0);
    if (!paragraphRoot.contains(range.commonAncestorContainer)) return false;

    // Закладки сохраняют и курсор между узлами (после вставки), и выделение
    // при перемещении строк. В историю и PNG они не попадают.
    var collapsed = range.collapsed;
    var start = document.createComment('align-start');
    var end = collapsed ? null : document.createComment('align-end');
    if (end) { var endRange = range.cloneRange(); endRange.collapse(false); endRange.insertNode(end); }
    var startRange = range.cloneRange(); startRange.collapse(true); startRange.insertNode(start);
    range = document.createRange();
    range.setStartAfter(start);
    if (end) range.setEndBefore(end); else range.collapse(true);
    exposeLineBreaks(range, start);
    range.setStartAfter(start);
    if (end) range.setEndBefore(end); else range.collapse(true);
    var lines = linesToAlign(range, start);

    // Кнопка работает и до ввода текста: создаёт пустой абзац-цитату.
    if (align === 'quote' && !lines.length && collapsed) {
      var emptyBlock = nearestBlock(start);
      if (emptyBlock && !(emptyBlock.textContent || '').replace(/\u200B/g, '').trim()) {
        lines.push([emptyBlock]);
      } else {
        var blank = document.createElement('br');
        start.parentNode.insertBefore(blank, start.nextSibling);
        lines.push([start, blank]);
      }
    }

    var quoteMode = align === 'quote';
    var removeQuotes = quoteMode && lines.length && lines.every(function(nodes) {
      var node = nodes[0].nodeType === 1 ? nodes[0] : nodes[0].parentElement;
      return !!(node && node.closest('[data-post-quote]'));
    });
    lines.forEach(function (nodes) {
      var box = (nodes.length === 1 && isBlock(nodes[0])) ? nodes[0] : wrapLine(nodes);
      if (!quoteMode) { setAlign(box, align); return; }
      var existing = box.closest('[data-post-quote]');
      if (removeQuotes) {
        if (existing) {
          existing.removeAttribute('data-post-quote');
          ['border-left', 'padding-left', 'margin-left'].forEach(function(p) { existing.style.removeProperty(p); });
        }
      } else if (!existing) {
        box.setAttribute('data-post-quote', '1');
        box.style.borderLeft = '0.12em solid currentColor';
        box.style.paddingLeft = '0.65em';
        box.style.marginLeft = '0.25em';
      }
    });

    try {
      var r = document.createRange();
      r.setStartAfter(start);
      if (end) r.setEndBefore(end); else r.collapse(true);
      start.remove();
      if (end) end.remove();
      sel.removeAllRanges();
      sel.addRange(r);
    } finally {
      if (start.parentNode) start.remove();
      if (end && end.parentNode) end.remove();
    }

    return lines.length > 0;
  }

  function patchAlignment() {
    if (typeof window.applyAlignment !== 'function') return;
    var original = window.applyAlignment;

    window.applyAlignment = function (command) {
      var map = {
        justifyLeft: 'left',
        justifyCenter: 'center',
        justifyRight: 'right',
        justifyFull: 'justify'
      };
      var align = map[command];
      if (!align) return false;

      // выбрана картинка — прежнее поведение
      if (typeof currentImgBox !== 'undefined' && currentImgBox) {
        return original.call(this, command);
      }
      // текст в плашке — прежнее поведение, не трогаем
      if (typeof getEditingScope === 'function' && getEditingScope() !== editor) {
        return original.call(this, command);
      }

      if (typeof restoreSelection === 'function') restoreSelection();

      if (!alignSelection(align)) return false;

      if (typeof saveSelectionBeforeAction === 'function') saveSelectionBeforeAction();
      if (typeof updateRatio === 'function') updateRatio();
      if (typeof saveHistory === 'function') saveHistory();
      updateAlignButtons();
      return true;
    };
  }

  window.togglePostQuote = function() {
    if (typeof restoreSelection === 'function') restoreSelection();
    var scope = getEditingScope();
    if (scope.classList.contains('text-box')) scope = scope.querySelector('.tb-content');
    if (!scope) return;
    // До операции фиксируем ввод, чтобы отмена снимала именно цитату.
    saveHistory();
    if (!alignSelection('quote', scope)) return;
    releaseSelection();
    saveSelectionBeforeAction();
    updateRatio();
    saveHistory();
    updateQuoteButton();
  };
  function updateQuoteButton() {
    var btn = document.getElementById('quoteBtn');
    var sel = window.getSelection();
    var node = sel && sel.anchorNode;
    if (node && node.nodeType !== 1) node = node.parentElement;
    if (btn) btn.setAttribute('aria-pressed', String(!!(node && node.closest && node.closest('[data-post-quote]'))));
  }
  document.addEventListener('selectionchange', updateQuoteButton);
  document.addEventListener('texttura:new-post', updateQuoteButton);

  /* ==================== 3. подсветка кнопок ==================== */

  var alignButtons = null;

  function collectAlignButtons() {
    alignButtons = {};
    Array.prototype.slice.call(document.querySelectorAll('button')).forEach(function (b) {
      var h = b.getAttribute('onclick') || b.getAttribute('onmousedown') || '';
      var m = h.match(/justify(Left|Center|Right|Full)/);
      if (m) alignButtons['justify' + m[1]] = b;
    });
  }

  function currentAlign() {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    var range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;

    var node = range.startContainer;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node || !node.closest) return null;

    var box = node.closest('[data-para]') || editor;
    return getComputedStyle(box).textAlign;
  }

  function updateAlignButtons() {
    if (!alignButtons) collectAlignButtons();
    var cur = currentAlign();
    var back = {
      left: 'justifyLeft', start: 'justifyLeft',
      center: 'justifyCenter', right: 'justifyRight',
      end: 'justifyRight', justify: 'justifyFull'
    };
    var active = back[cur] || null;
    Object.keys(alignButtons).forEach(function (cmd) {
      alignButtons[cmd].classList.toggle('align-active', cmd === active);
    });
  }

  /* ========================== запуск ========================== */

  ready(function () {
    if (typeof editor === 'undefined' || !editor) return;

    raiseSliders();
    patchWordSize();
    patchAlignment();
    collectAlignButtons();

    // новая строка наследует выравнивание предыдущей
    editor.addEventListener('keyup', function (e) {
      if (e.key !== 'Enter') return;
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var node = sel.getRangeAt(0).startContainer;
      if (node.nodeType === 3) node = node.parentNode;
      var cur = (node && node.closest) ? node.closest('[data-para]') : null;
      if (!cur) return;
      var prev = cur.previousElementSibling;
      if (prev && prev.hasAttribute && prev.hasAttribute('data-para') && !cur.style.textAlign) {
        cur.style.textAlign = prev.style.textAlign || '';
        cur.style.textAlignLast = prev.style.textAlignLast || '';
      }
      updateAlignButtons();
    });

    document.addEventListener('selectionchange', function () {
      clearTimeout(updateAlignButtons._t);
      updateAlignButtons._t = setTimeout(updateAlignButtons, 80);
    });

    updateAlignButtons();
  });

})();
