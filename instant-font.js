/* ==========================================================================
   ШРИФТЫ — мгновенное применение ко всему выделенному тексту

   Проблема была: когда ты меняешь шрифт в селекторе, ничего не происходит,
   пока не выделишь текст вручную.

   Исправление: перехватываем событие change на селекторе и мгновенно
   применяем шрифт ко ВСЕМУ тексту в редакторе (или к плашке, если она выбрана).
   ========================================================================== */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  ready(function () {
    var selector = document.getElementById('fontFamilySelector');
    if (!selector) return;

    // мгновенное применение при смене шрифта
    selector.addEventListener('change', function () {
      var font = selector.value;
      if (!font) return;

      // если выделена плашка, меняем шрифт только в ней
      if (typeof currentTextBox !== 'undefined' && currentTextBox && currentTextBox.isConnected) {
        if (typeof setTextBoxFontFamily === 'function') {
          setTextBoxFontFamily(currentTextBox, font);
        }
        return;
      }

      // иначе выделяем ВСЁ в редакторе и меняем
      var editor = document.getElementById('editor');
      if (!editor) return;

      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);

      // теперь вызываем обычную функцию изменения шрифта
      if (typeof changeFontFamily === 'function') {
        changeFontFamily(font);
      }

      // возвращаем курсор в конец
      setTimeout(function () {
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        if (editor) editor.focus();
      }, 50);
    });

    // то же самое для селектора в плашке
    var tbFontSelector = document.getElementById('tbFontFamily');
    if (tbFontSelector) {
      tbFontSelector.addEventListener('change', function () {
        var font = tbFontSelector.value;
        if (!font) return;

        if (typeof currentTextBox !== 'undefined' && currentTextBox && currentTextBox.isConnected) {
          if (typeof setTextBoxFontFamily === 'function') {
            setTextBoxFontFamily(currentTextBox, font);
          }
        }
      });
    }
  });
})();
