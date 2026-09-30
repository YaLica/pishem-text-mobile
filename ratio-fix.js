/* ==========================================================================
   ratio-fix.js — точная калибровка индикатора пропорций + переключатель
   режима публикации (чистый пост / прикреплено к сообщению).

   Не трогает существующий updateRatio() — оборачивает его и подрисовывает
   поверх правильный цвет/подпись. Пороги измерены вручную методом подбора
   на реальных устройствах:
     • "чистый пост" — три ширины (800 / ~1400 / 2000), порог зависит
       от ширины, интерполируется линейно, подтверждено на всех точках;
     • "прикреплено к сообщению" — порог практически не зависит от ширины,
       граница около ratio = 1.0, без жёлтой зоны. Подтверждено и методом
       подбора в редакторе, и на живом Telegram (1400×1401 → красный).
   ========================================================================== */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  // --- "чистый пост": порог зависит от ширины, интерполируем линейно ---
  var CLEAN_W1 = 800,  CLEAN_GREEN_W1 = 1.72625,  CLEAN_YELLOW_W1 = 1.759375;
  var CLEAN_W2 = 2000, CLEAN_GREEN_W2 = 1.68875,  CLEAN_YELLOW_W2 = 1.705;

  // --- "прикреплено к сообщению": порог не зависит от ширины, без жёлтой зоны ---
  var MSG_GREEN_MAX = 0.999;

  function lerp(w, w1, v1, w2, v2) {
    var t = (w - w1) / (w2 - w1);
    return v1 + (v2 - v1) * t;
  }

  function cleanThresholds(width) {
    var w = Math.max(CLEAN_W1, Math.min(CLEAN_W2, width));
    return {
      greenMax:  lerp(w, CLEAN_W1, CLEAN_GREEN_W1,  CLEAN_W2, CLEAN_GREEN_W2),
      yellowMax: lerp(w, CLEAN_W1, CLEAN_YELLOW_W1, CLEAN_W2, CLEAN_YELLOW_W2)
    };
  }

  var STORAGE_KEY = 'texterAttachToMessage';
  function getMode() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function setMode(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
  }

  function computeStatus(width, height) {
    var ratio = height / width;

    if (getMode()) {
      if (ratio <= MSG_GREEN_MAX) {
        return { ratio: ratio, cls: 'ok',  title: '🟢 Не обрежется при отправке в сообщении' };
      }
      return { ratio: ratio, cls: 'bad', title: '🔴 Обрежется — прикреплено к сообщению' };
    }

    var t = cleanThresholds(width);
    if (ratio <= t.greenMax) {
      return { ratio: ratio, cls: 'ok',   title: '🟢 Идеальные пропорции для ленты (PNG)' };
    }
    if (ratio <= t.yellowMax) {
      return { ratio: ratio, cls: 'warn', title: '🟡 Слегка обрежется в компактном виде' };
    }
    return { ratio: ratio, cls: 'bad', title: '🔴 Будет заметно обрезан в мессенджере' };
  }

  function paint() {
    if (typeof exportNode === 'undefined' || !exportNode) return;
    var w = exportNode.offsetWidth;
    var h = exportNode.offsetHeight;
    if (!w || !h) return;

    var r = computeStatus(w, h);

    var titleEl = document.getElementById('ratioTitle');
    if (titleEl) { titleEl.textContent = r.title; titleEl.className = 'ratio-title ' + r.cls; }
    var sizeEl = document.getElementById('ratioSize');
    if (sizeEl) sizeEl.textContent = w + ' × ' + h;
    var valEl = document.getElementById('ratioValue');
    if (valEl) valEl.textContent = r.ratio.toFixed(2);

    // Полоску (ratioFill) красит своей логикой оригинальный updateRatio() —
    // он всегда красит её в зелёный, потому что не знает про новые пороги.
    // Красим поверх, сразу после оригинала, чтобы полоска совпадала со
    // статусом, а не только заголовок с кружком.
    var fillEl = document.getElementById('ratioFill');
    if (fillEl) {
      var color = (r.cls === 'ok') ? '#4ade80' : (r.cls === 'warn') ? '#facc15' : '#ef4444';
      fillEl.style.background = color;
    }
  }

  ready(function () {
    if (typeof window.updateRatio !== 'function') return;

    var original = window.updateRatio;
    window.updateRatio = function () {
      var res = original.apply(this, arguments); // прежнее поведение не теряем
      paint();                                    // поверх — правильный цвет
      return res;
    };

    var box = document.getElementById('ratioBox');
    if (box && !document.getElementById('ratioModeRow')) {
      var row = document.createElement('div');
      row.id = 'ratioModeRow';
      row.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

      var btnClean = document.createElement('button');
      btnClean.type = 'button';
      btnClean.textContent = '📄 Чистый пост';
      btnClean.style.cssText = 'flex:1;padding:6px;font-size:11px;border-radius:6px;cursor:pointer;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;';

      var btnMsg = document.createElement('button');
      btnMsg.type = 'button';
      btnMsg.textContent = '💬 Прикреплено к сообщению';
      btnMsg.style.cssText = 'flex:1;padding:6px;font-size:11px;border-radius:6px;cursor:pointer;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;';

      function refreshButtons() {
        var attach = getMode();
        btnClean.style.opacity    = attach ? '0.5' : '1';
        btnMsg.style.opacity      = attach ? '1' : '0.5';
        btnClean.style.fontWeight = attach ? '400' : '700';
        btnMsg.style.fontWeight   = attach ? '700' : '400';
      }

      btnClean.addEventListener('click', function () { setMode(false); refreshButtons(); window.updateRatio(); });
      btnMsg.addEventListener('click',   function () { setMode(true);  refreshButtons(); window.updateRatio(); });

      row.appendChild(btnClean);
      row.appendChild(btnMsg);
      box.appendChild(row);
      refreshButtons();
    }

    paint();
  });
})();
