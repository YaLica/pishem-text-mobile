/* ==========================================================================
   ЧАСТЬ 3 — размер по умолчанию 38 и защита выделения плашки

   1. Текст поста начинается с 38 px вместо 32 — и на компьютере,
      и на телефоне. Уже начатый пост не трогается.

   2. Выделение плашки перестаёт слетать при работе с панелью.
      Раньше клик по настройке снимал выделение, и дальше:
        • блок настроек считал, что работать не с чем;
        • цвет подложки менялся в панели, но не на холсте.
      Теперь панель помнит последнюю плашку и возвращает её,
      если выделение потерялось.
   ========================================================================== */

(function () {
  'use strict';

  var DEFAULT_SIZE = 38;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  ready(function () {
    /* ---------------- 1. размер по умолчанию ---------------- */

    var slider = document.getElementById('baseFontSlider');
    var label  = document.getElementById('baseFontSizeLabel');

    // Меняем стартовое значение только для чистого холста.
    // Если в редакторе уже есть текст — это открытый черновик, не трогаем.
    var untouched = false;
    try {
      untouched = !editor || !(editor.innerText || '').replace(/\u200B/g, '').trim();
      if (untouched && editor && editor.querySelector('img')) untouched = false;
    } catch (e) {}

    if (slider) {
      slider.setAttribute('min', '16');
      if (untouched) {
        slider.value = String(DEFAULT_SIZE);
        if (label) label.textContent = String(DEFAULT_SIZE);
        if (typeof applyBase === 'function') {
          applyBase(DEFAULT_SIZE);
        } else if (typeof editor !== 'undefined' && editor) {
          editor.style.fontSize = DEFAULT_SIZE + 'px';
        }
        if (typeof updateRatio === 'function') updateRatio();
      }
    }

    // сброс поста должен возвращать 38, а не 32
    if (typeof window.clearAll === 'function') {
      var origClear = window.clearAll;
      window.clearAll = function () {
        var r = origClear.apply(this, arguments);
        setTimeout(function () {
          if (slider) slider.value = String(DEFAULT_SIZE);
          if (label) label.textContent = String(DEFAULT_SIZE);
          if (typeof applyBase === 'function') applyBase(DEFAULT_SIZE);
          if (typeof updateRatio === 'function') updateRatio();
        }, 0);
        return r;
      };
    }

    /* ---------------- 2. выделение плашки не теряется ---------------- */

    if (typeof window.getTbTargetBox !== 'function') return;

    var lastBox = null;

    // запоминаем плашку, пока выделение живое
    var origGet = window.getTbTargetBox;
    window.getTbTargetBox = function () {
      var box = origGet.apply(this, arguments);
      if (box && box.isConnected) {
        lastBox = box;
        return box;
      }
      // выделение слетело — возвращаем последнюю, если она ещё на холсте
      if (lastBox && lastBox.isConnected) return lastBox;
      return box;
    };

    // Клик по панели не должен уводить фокус с плашки.
    // Рамка выделения возвращается сразу, иначе она мигает
    // и выглядит так, будто плашка «слетела».
    var panel = document.querySelector('.panel');

    function keepSelected() {
      var box = (lastBox && lastBox.isConnected) ? lastBox : null;
      if (!box) return;
      try {
        if (typeof currentTextBox === 'undefined' ||
            !currentTextBox || !currentTextBox.isConnected) {
          // Возвращаем именно поле для ввода внутри плашки: на него смотрят
          // кнопки форматирования. Раньше здесь стояло присваивание
          // window.currentTextBox, которое до настоящей привязки не доходило.
          var field = box.querySelector('.tb-content') || box;
          if (typeof window.setCurrentTextBox === 'function') {
            window.setCurrentTextBox(field);
          }
        }
        if (!box.classList.contains('selected')) {
          document.querySelectorAll('.text-box.selected').forEach(function (b) {
            if (b !== box) b.classList.remove('selected');
          });
          box.classList.add('selected');
        }
      } catch (err) {}
    }

    if (panel) {
      ['mousedown', 'pointerdown', 'click', 'input', 'change'].forEach(function (ev) {
        panel.addEventListener(ev, function (e) {
          if (!e.target.closest('input, select, button, textarea')) return;
          // кнопка удаления плашки — не мешаем ей отработать
          if (e.target.closest('.tb-delete')) return;
          keepSelected();
          setTimeout(keepSelected, 0);
        }, true);
      });

      // пока крутится ползунок, рамка держится
      panel.addEventListener('input', function (e) {
        if (e.target.type === 'range' || e.target.type === 'color') keepSelected();
      });
    }

    // плашку удалили — забываем её
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.tb-delete')) {
        setTimeout(function () {
          if (lastBox && !lastBox.isConnected) lastBox = null;
        }, 50);
      }
    }, true);
  });
})();
