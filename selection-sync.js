/* selection-sync.js — только размер шрифта, цвет не трогаем.
 *
 * Синхронизирует fontSize выделенного (или подкурсорного) текста
 * с ползунками baseFontSlider и tbFontSize + их метками.
 *
 * Цвет намеренно НЕ синхронизируется: это ломает color picker
 * потому что 'touchend' при закрытии палитры вызывает sync(),
 * которая перезаписывает el.value обратно на старый цвет.
 *
 * Только мобайл и компьютер — работает одинаково.
 * Подключать последним.
 */
(function () {
  'use strict';

  var SIZE_FIELDS = [
    { id: 'baseFontSlider', labelId: 'baseFontSizeLabel' },
    { id: 'tbFontSize',     labelId: 'tbFontSizeLabel'   },
  ];

  function getAnchorNode() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      var n = sel.getRangeAt(0).startContainer;
      return n.nodeType === 3 ? n.parentElement : n;
    }
    var a = document.activeElement;
    return (a && a.isContentEditable) ? a : null;
  }

  function isEditable(node) {
    if (!node) return false;
    var ed = document.getElementById('editor');
    if (ed && ed.contains(node)) return true;
    return !!(node.closest && node.closest('.text-box'));
  }

  function sync() {
    var node = getAnchorNode();
    if (!isEditable(node)) return;
    var px = parseFloat(window.getComputedStyle(node).fontSize);
    if (isNaN(px)) return;
    var size = Math.round(px);
    SIZE_FIELDS.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (el && document.activeElement !== el &&
          Math.abs(parseFloat(el.value) - size) >= 0.5) {
        el.value = size;
      }
      var lbl = f.labelId && document.getElementById(f.labelId);
      if (lbl && lbl.textContent !== String(size)) lbl.textContent = size;
    });
  }

  var _raf = null;
  function schedule() {
    if (_raf) return;
    _raf = requestAnimationFrame(function () { _raf = null; sync(); });
  }

  document.addEventListener('selectionchange', schedule);
  document.addEventListener('mouseup', schedule);
  document.addEventListener('touchend', schedule);
  document.addEventListener('keyup', schedule);

  window.syncSelectionUI = sync;
})();
