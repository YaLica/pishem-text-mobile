(function () {
  'use strict';

  var CLASS = 'bg-none';

  window.toggleNoBg = function (on) {
    var node = document.getElementById('export-node');
    if (!node) return;

    node.classList.toggle(CLASS, !!on);

    var picker = document.getElementById('bgColorPicker');
    if (picker) {
      picker.disabled = !!on;
      picker.style.opacity = on ? '0.4' : '';
      picker.style.cursor = on ? 'not-allowed' : '';
    }

    if (typeof updateRatio === 'function') { try { updateRatio(); } catch (e) {} }
    if (typeof saveHistory === 'function') { try { saveHistory(); } catch (e) {} }
  };

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
