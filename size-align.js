/* ==========================================================================
   ЧАСТЬ 2 — размер до 240 и выравнивание для каждого абзаца

   1. Размер текста до 240 px: ползунок основного текста, ползунок плашки
      и кнопки A+ / A−.
   2. Плашка больше не упирается в 90% ширины холста: на крупном кегле
      текст переносился там, где этого не ждёшь.
   3. Выравнивание для каждого абзаца ОСНОВНОГО текста по отдельности.
      Текст в плашках не трогается: там кнопки работают ровно как раньше.

   Почему абзацы вообще понадобились: строки в редакторе разделены
   переносом <br>, а не блоками. Для браузера это один сплошной кусок,
   поэтому кнопка выравнивания меняла сразу весь пост. Теперь каждая
   строка — свой блок, и кнопке некуда промахнуться.
   ========================================================================== */

(function () {
  'use strict';

  var MAX_SIZE = 240;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  /* ---------------- 1. потолок размера ---------------- */

  function raiseSliders() {
    var base = document.getElementById('baseFontSlider');
    if (base) base.max = String(MAX_SIZE);
    var tb = document.getElementById('tbFontSize');
    if (tb) tb.max = String(MAX_SIZE);
  }

  // кнопки A+ / A− упирались в 200
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

  /* ---------------- 2. абзацы ---------------- */

  function isSkippable(node) {
    if (!node || node.nodeType !== 1) return false;
    return node.classList.contains('img-box') ||
           node.classList.contains('img-spacer-left') ||
           node.classList.contains('img-spacer-right');
  }

  function editorHasContent() {
    if (!editor) return false;
    if (editor.querySelector('img')) return true;
    return (editor.innerText || '').replace(/\u200B/g, '').trim().length > 0;
  }

  // нужна ли перестройка: есть ли верхнеуровневые <br> или голый текст
  function needsNormalize() {
    if (!editor) return false;
    var kids = editor.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3 && (n.textContent || '').trim()) return true;
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') return true;
        if (isSkippable(n)) continue;
        if (n.tagName !== 'DIV' && n.tagName !== 'P') return true;
      }
    }
    return false;
  }

  // Строки, разделённые <br>, превращаются в отдельные блоки.
  // Пустые строки сохраняются, картинки не трогаются.
  function normalizeParagraphs() {
    if (!editor || !editorHasContent()) return;

    var kids = Array.prototype.slice.call(editor.childNodes);
    var run = [];

    function flush(before, force) {
      if (!run.length && !force) { run = []; return; }
      var div = document.createElement('div');
      div.setAttribute('data-para', '1');
      run.forEach(function (n) { div.appendChild(n); });
      if (!div.childNodes.length) div.appendChild(document.createElement('br'));
      editor.insertBefore(div, before || null);
      run = [];
    }

    kids.forEach(function (node) {
      if (isSkippable(node)) { flush(node, false); return; }

      if (node.nodeType === 1 && node.tagName === 'BR') {
        flush(node, true);              // <br> закрывает абзац
        if (node.parentNode === editor) editor.removeChild(node);
        return;
      }

      if (node.nodeType === 1 && (node.tagName === 'DIV' || node.tagName === 'P')) {
        flush(node, false);
        node.setAttribute('data-para', '1');
        return;
      }

      if (node.nodeType === 3 && !(node.textContent || '').length) return;
      run.push(node);
    });

    flush(null, false);
  }

  // перестройка с сохранением курсора
  function normalizeKeepingCaret() {
    if (!needsNormalize()) return;

    var sel = window.getSelection();
    var range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
    var inside = range && editor.contains(range.commonAncestorContainer);

    if (!inside) { normalizeParagraphs(); return; }

    var collapsed = range.collapsed;
    var m1 = document.createElement('span');
    var m2 = document.createElement('span');
    m1.setAttribute('data-caret-marker', '1');
    m2.setAttribute('data-caret-marker', '1');

    var rEnd = range.cloneRange(); rEnd.collapse(false); rEnd.insertNode(m2);
    var rBeg = range.cloneRange(); rBeg.collapse(true);  rBeg.insertNode(m1);

    normalizeParagraphs();

    try {
      var p1 = m1.parentNode, i1 = Array.prototype.indexOf.call(p1.childNodes, m1);
      var p2 = m2.parentNode, i2 = Array.prototype.indexOf.call(p2.childNodes, m2);

      m2.parentNode.removeChild(m2);
      m1.parentNode.removeChild(m1);
      if (p2 === p1 && i2 > i1) i2--;

      var nr = document.createRange();
      nr.setStart(p1, Math.min(i1, p1.childNodes.length));
      if (collapsed) nr.collapse(true);
      else nr.setEnd(p2, Math.min(i2, p2.childNodes.length));

      sel.removeAllRanges();
      sel.addRange(nr);
    } catch (e) {
      if (m1.parentNode) m1.parentNode.removeChild(m1);
      if (m2.parentNode) m2.parentNode.removeChild(m2);
    }
  }

  function paragraphsInRange(range) {
    var out = [];
    Array.prototype.slice.call(editor.children).forEach(function (el) {
      if (isSkippable(el)) return;
      if (el.tagName !== 'DIV' && el.tagName !== 'P') return;
      var hit = false;
      try { hit = range.intersectsNode(el); } catch (e) { hit = false; }
      if (hit) out.push(el);
    });
    return out;
  }

  function setAlign(el, align) {
    el.style.textAlign = align;
    // без второго свойства последняя строка убегает влево
    el.style.textAlignLast = (align === 'justify') ? 'left' : align;
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

      // картинки — прежнее поведение
      if (typeof currentImgBox !== 'undefined' && currentImgBox) {
        return original.call(this, command);
      }
      // текст в плашках — прежнее поведение, по просьбе не трогаем
      var scope = getEditingScope();
      if (scope !== editor) return original.call(this, command);

      normalizeKeepingCaret();

      var sel = window.getSelection();
      var range = (sel && sel.rangeCount) ? sel.getRangeAt(0) : null;
      var targets = (range && editor.contains(range.commonAncestorContainer))
        ? paragraphsInRange(range) : [];

      if (!targets.length) {
        // курсора в тексте нет — как раньше, на весь пост
        setAlign(editor, align);
      } else {
        targets.forEach(function (p) { setAlign(p, align); });
      }

      finishTextOperation();
      updateAlignButtons();
      return true;
    };
  }

  /* ---------------- 3. подсветка активной кнопки ---------------- */

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
    var back = { left: 'justifyLeft', center: 'justifyCenter',
                 right: 'justifyRight', justify: 'justifyFull', start: 'justifyLeft' };
    var activeCmd = back[cur] || null;
    Object.keys(alignButtons).forEach(function (cmd) {
      alignButtons[cmd].classList.toggle('align-active', cmd === activeCmd);
    });
  }

  /* ---------------- запуск ---------------- */

  ready(function () {
    if (typeof editor === 'undefined' || !editor) return;

    raiseSliders();
    patchWordSize();
    patchAlignment();
    collectAlignButtons();

    // свой обработчик вставки: сразу абзацами, без <br>
    editor.addEventListener('paste', function (e) {
      var cd = e.clipboardData || window.clipboardData;
      if (!cd) return;
      var text = cd.getData('text/plain');
      if (text === null || text === undefined) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;

      range.deleteContents();
      normalizeKeepingCaret();

      sel = window.getSelection();
      if (!sel.rangeCount) return;
      range = sel.getRangeAt(0);

      var parts = String(text).replace(/\r\n?/g, '\n').split('\n');
      var node = range.startContainer;
      if (node.nodeType === 3) node = node.parentNode;
      var host = (node && node.closest) ? node.closest('[data-para]') : null;

      if (!host) {
        var frag = document.createDocumentFragment();
        parts.forEach(function (p, i) {
          if (i) frag.appendChild(document.createElement('br'));
          if (p) frag.appendChild(document.createTextNode(p));
        });
        range.insertNode(frag);
        // курсор в конец вставленного, иначе текст остаётся выделенным синим
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // первая строка вставляется в текущий абзац, остальные — новыми
        range.insertNode(document.createTextNode(parts[0] || ''));
        var after = host;
        for (var i = 1; i < parts.length; i++) {
          var d = document.createElement('div');
          d.setAttribute('data-para', '1');
          d.style.textAlign = host.style.textAlign || '';
          d.style.textAlignLast = host.style.textAlignLast || '';
          if (parts[i]) d.appendChild(document.createTextNode(parts[i]));
          else d.appendChild(document.createElement('br'));
          after.parentNode.insertBefore(d, after.nextSibling);
          after = d;
        }
        var r2 = document.createRange();
        r2.selectNodeContents(after);
        r2.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r2);
      }

      normalizeKeepingCaret();
      if (typeof updateRatio === 'function') updateRatio();
      if (typeof saveHistory === 'function') saveHistory();
      updateAlignButtons();
    }, true);

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

    // после отмены и повтора структура восстанавливается из истории
    ['undoAction', 'redoAction'].forEach(function (name) {
      if (typeof window[name] !== 'function') return;
      var orig = window[name];
      window[name] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(function () { normalizeParagraphs(); updateAlignButtons(); }, 0);
        return r;
      };
    });

    normalizeParagraphs();
    updateAlignButtons();
  });
})();
