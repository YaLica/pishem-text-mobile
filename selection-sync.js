/* selection-sync.js
 *
 * Синхронизирует размер и цвет выделенного (или подкурсорного) текста
 * с числовыми полями и color-input'ами во всех панелях:
 *
 *   Размер → baseFontSlider / baseFontSizeLabel  (основной текст, шторка)
 *            tbFontSize / tbFontSizeLabel          (плашка, шторка)
 *
 *   Цвет  → wordColor          (тулбар в шторке)
 *            qbWordColor        (quickBar)
 *            tbWordColor        (тулбар плашки)
 *
 * Слушает selectionchange, mouseup, touchend, keyup.
 * Не изменяет DOM и не трогает обработчики — только читает и обновляет UI.
 * Работает одинаково на компьютере и на телефоне.
 *
 * Подключать после всех остальных скриптов.
 */
(function () {
  'use strict';

  /* ── конфигурация полей ─────────────────────────────────────────── */
  var SIZE_FIELDS = [
    { id: 'baseFontSlider', labelId: 'baseFontSizeLabel' },
    { id: 'tbFontSize',     labelId: 'tbFontSizeLabel'   },
  ];

  /* На компьютере индикаторы цвета остаются синхронизированными.
     На телефоне не переписываем value у системных color-input:
     это конфликтует с мобильной палитрой и повторным применением цвета. */
  var COLOR_FIELDS = (typeof isMobile === 'function' && isMobile()) ? [] : [
    { id: 'wordColor'   },
    { id: 'qbWordColor' },
    { id: 'tbWordColor' },
  ];

  /* ── получить узел под курсором или в начале выделения ──────────── */
  function getAnchorNode() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      var node = sel.getRangeAt(0).startContainer;
      return node.nodeType === 3 ? node.parentElement : node;
    }
    var a = document.activeElement;
    return (a && a.isContentEditable) ? a : null;
  }

  /* ── проверяем, что узел внутри редактируемой области ───────────── */
  function isEditable(node) {
    if (!node) return false;
    var editor = document.getElementById('editor');
    if (editor && editor.contains(node)) return true;
    return !!(node.closest && node.closest('.text-box'));
  }

  /* ── читаем fontSize в px → целое ──────────────────────────────── */
  function readSize(node) {
    var px = parseFloat(window.getComputedStyle(node).fontSize);
    return isNaN(px) ? null : Math.round(px);
  }

  /* ── читаем color → hex ─────────────────────────────────────────── */
  function readColor(node) {
    var raw = window.getComputedStyle(node).color;
    var m = raw.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (v) {
      return ('0' + parseInt(v, 10).toString(16)).slice(-2);
    }).join('');
  }

  /* ── обновить поле (range или number) ───────────────────────────── */
  function setField(id, val) {
    var el = document.getElementById(id);
    if (!el || document.activeElement === el) return;
    if (Math.abs(parseFloat(el.value) - val) < 0.5) return;
    el.value = val;
  }

  function setLabel(id, text) {
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.textContent !== String(text)) el.textContent = text;
  }

  function setColor(id, hex) {
    var el = document.getElementById(id);
    if (!el || document.activeElement === el) return;
    if (el.value === hex) return;
    el.value = hex;
  }

  /* ── основная синхронизация ─────────────────────────────────────── */
  function sync() {
    var node = getAnchorNode();
    if (!isEditable(node)) return;

    var size  = readSize(node);
    var color = readColor(node);

    if (size !== null) {
      SIZE_FIELDS.forEach(function (f) { setField(f.id, size); setLabel(f.labelId, size); });
    }
    if (color !== null) {
      COLOR_FIELDS.forEach(function (f) { setColor(f.id, color); });
    }
  }

  /* ── дебаунс через RAF — не чаще одного раза за кадр ───────────── */
  var _raf = null;
  function schedule() {
    if (_raf) return;
    _raf = requestAnimationFrame(function () { _raf = null; sync(); });
  }

  /* ── подписки ───────────────────────────────────────────────────── */
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('mouseup',   schedule);
  document.addEventListener('touchend',  schedule);
  document.addEventListener('keyup',     schedule);
  /* На телефоне не слушаем input: это событие приходит от color-picker.
     На компьютере сохраняем прежнюю синхронизацию после форматирования. */
  if (!(typeof isMobile === 'function' && isMobile())) {
    document.addEventListener('input', function () { setTimeout(schedule, 50); });
  }

  /* Публичный вызов после программного форматирования */
  window.syncSelectionUI = sync;
})();
