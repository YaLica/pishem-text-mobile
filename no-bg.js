/* ==========================================================================
   РЕЖИМ «БЕЗ ФОНА» — прозрачный пост
   Отдельный файл. Рабочий код не переписывается.

   Что делает:
   1. Холст становится прозрачным — сквозь него видно рабочую область.
   2. Хвостик спич-баббла и тень скрываются, чтобы не было мусора.
   3. Вокруг холста появляется пунктирная рамка — видно границы поста.
   4. При сохранении PNG рамка убирается, а прозрачность остаётся.

   Прозрачность держится и в браузерном рисовальщике, и в страховочном.
   ========================================================================== */

(function () {
  'use strict';

  var CLASS = 'bg-none';

  /* ---- вкл/выкл режима ---- */
  window.toggleNoBg = function (on) {
    var node = document.getElementById('export-node');
    if (!node) return;

    node.classList.toggle(CLASS, !!on);

    // выбор цвета при прозрачном фоне не нужен — гасим, чтобы не путал
    var picker = document.getElementById('bgColorPicker');
    if (picker) {
      picker.disabled = !!on;
      picker.style.opacity = on ? '0.4' : '';
      picker.style.cursor = on ? 'not-allowed' : '';
    }

    if (typeof updateRatio === 'function') { try { updateRatio(); } catch (e) {} }
    if (typeof saveHistory === 'function') { try { saveHistory(); } catch (e) {} }
  };

  /* ---- прозрачность в готовой картинке ----
     Пунктирную рамку рисует css. В снимок она попасть не должна:
     на время съёмки помечаем холст, и правило её отключает. */
  function patchExport() {
    if (typeof window.buildExportClone !== 'function') return false;

    var original = window.buildExportClone;
    window.buildExportClone = function () {
      var clone = original.apply(this, arguments);
      if (clone && clone.classList && clone.classList.contains(CLASS)) {
        clone.style.background = 'transparent';
        clone.style.boxShadow = 'none';
        clone.style.outline = 'none';
        clone.style.border = 'none';
      }
      return clone;
    };
    return true;
  }

  /* ---- страховочный рисовальщик ----
     html2canvas читает фон со страницы. Если включён режим «без фона»,
     на время съёмки убираем пунктир, чтобы он не попал в картинку. */
  function patchFallback() {
    if (typeof window.exportFallbackCanvas !== 'function') return false;

    var original = window.exportFallbackCanvas;
    window.exportFallbackCanvas = function () {
      var node = document.getElementById('export-node');
      var hide = node && node.classList.contains(CLASS);
      if (hide) node.classList.add('bg-none-shooting');

      var done = function () {
        if (hide) node.classList.remove('bg-none-shooting');
      };

      try {
        var res = original.apply(this, arguments);
        if (res && typeof res.then === 'function') {
          return res.then(function (v) { done(); return v; },
                          function (e) { done(); throw e; });
        }
        done();
        return res;
      } catch (e) {
        done();
        throw e;
      }
    };
    return true;
  }

  function init() {
    patchExport();
    patchFallback();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
