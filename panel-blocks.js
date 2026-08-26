/* ==========================================================================
   ПАНЕЛЬ БЛОКАМИ — переделка

   Исправлено:
     1. Убрано гашение блоков. Раньше стояло pointer-events: none —
        оно не мешало вызвать функцию из кода, но блокировало живой клик
        мышью. Из-за этого не работали картинки и настройки.
     2. «Добавить плашку» вернулась внутрь рамки плашки.
     3. «Подложка под текст» вложена внутрь плашки отдельной секцией.
     4. Блок картинок называется «ВСТАВИТЬ КАРТИНКУ».
     5. Выделение плашки больше не слетает от клика по панели —
        из-за этого не менялся цвет подложки на холсте.
   ========================================================================== */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  function makeBlock(kind, title, storageKey) {
    var block = document.createElement('div');
    block.className = 'pb-block pb-' + kind;

    var head = document.createElement('div');
    head.className = 'pb-head';

    var h = document.createElement('div');
    h.className = 'pb-title';
    h.textContent = title;
    head.appendChild(h);

    var body = document.createElement('div');
    body.className = 'pb-body';

    var arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = 'pb-arrow';
    arrow.textContent = '▾';
    arrow.title = 'Свернуть или развернуть';
    arrow.setAttribute('aria-expanded', 'true');
    arrow.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var closed = block.classList.toggle('pb-collapsed');
      arrow.setAttribute('aria-expanded', String(!closed));
      try { localStorage.setItem(storageKey, closed ? '1' : '0'); } catch (err) {}
    });
    head.appendChild(arrow);

    var saved = null;
    try { saved = localStorage.getItem(storageKey); } catch (err) {}
    if (saved === '1') {
      block.classList.add('pb-collapsed');
      arrow.setAttribute('aria-expanded', 'false');
    }

    block.appendChild(head);
    block.appendChild(body);
    block._body = body;
    return block;
  }

  function tintButtons(root, skipIds) {
    var skip = skipIds || [];
    root.querySelectorAll('button').forEach(function (b) {
      if (b.classList.contains('pb-arrow')) return;
      if (skip.indexOf(b.id) !== -1) return;
      b.style.removeProperty('background');
      b.style.removeProperty('background-color');
      b.style.removeProperty('border');
      b.classList.add('pb-tinted');
    });
  }

  function tintSubLabels(root) {
    root.querySelectorAll('label').forEach(function (l) {
      if (/color\s*:/i.test(l.getAttribute('style') || '')) {
        l.style.removeProperty('color');
        l.classList.add('pb-sub');
      }
    });
  }

  ready(function () {
    var panel = document.querySelector('.panel');
    var delImg = document.getElementById('btnDeleteImg');
    if (!panel || !delImg) return;
    if (panel.querySelector('.pb-block')) return;

    var imgWrap    = delImg.parentElement;
    var tbSettings = document.getElementById('tbSettings');
    var ribToggle  = document.getElementById('tbRibbonToggle');
    var ribSet     = document.getElementById('tbRibbonSettings');

    var addBtn = null;
    imgWrap.querySelectorAll('button').forEach(function (b) {
      if ((b.getAttribute('onclick') || '').indexOf('addTextBox') !== -1) addBtn = b;
    });

    /* ---------- блок 1: платформа и текст ---------- */
    var kids = Array.prototype.slice.call(panel.children);
    var from = -1, to = -1;
    for (var i = 0; i < kids.length; i++) {
      if (from === -1 && kids[i].tagName === 'LABEL' &&
          (kids[i].textContent || '').indexOf('Платформа') !== -1) from = i;
      if (kids[i].classList && kids[i].classList.contains('dual-slider-row')) { to = i; break; }
    }
    if (from !== -1 && to !== -1 && to >= from) {
      var blockBase = makeBlock('base', 'Платформа и текст', 'pbCollapsed_base');
      panel.insertBefore(blockBase, kids[from]);
      for (var j = from; j <= to; j++) blockBase._body.appendChild(kids[j]);

      // Тулбар форматирования переезжает внутрь блока, чтобы сворачивался
      // вместе с остальными настройками основного текста.
      var mainBar = panel.querySelector('.toolbar');
      if (mainBar) blockBase._body.appendChild(mainBar);

      tintSubLabels(blockBase);
    }

    /* ---------- блок 2: вставить картинку ---------- */
    var blockImg = makeBlock('img', 'Вставить картинку', 'pbCollapsed_img');
    panel.insertBefore(blockImg, imgWrap);

    if (addBtn)     imgWrap.removeChild(addBtn);
    if (tbSettings) imgWrap.removeChild(tbSettings);

    while (imgWrap.firstChild) blockImg._body.appendChild(imgWrap.firstChild);
    imgWrap.parentNode.removeChild(imgWrap);

    blockImg._body.querySelectorAll('label').forEach(function (l) {
      if ((l.textContent || '').trim().toUpperCase().indexOf('КАРТИНКИ') !== -1) l.remove();
    });
    tintSubLabels(blockImg);
    tintButtons(blockImg, ['btnDeleteImg']);

    /* ---------- блок 3: плашка, кнопка внутри рамки ---------- */
    var blockPlate = makeBlock('plate', 'Плашка', 'pbCollapsed_plate');
    blockImg.insertAdjacentElement('afterend', blockPlate);

    if (addBtn) {
      addBtn.id = 'pbAddPlate';
      addBtn.textContent = '➕ Добавить плашку';
      addBtn.style.removeProperty('background');
      addBtn.style.removeProperty('margin-top');
      addBtn.style.removeProperty('padding');
      addBtn.classList.remove('tb-hide-mobile');
      blockPlate._body.appendChild(addBtn);
    }

    if (tbSettings) {
      if (ribToggle && ribToggle.parentNode) ribToggle.parentNode.removeChild(ribToggle);
      if (ribSet && ribSet.parentNode) ribSet.parentNode.removeChild(ribSet);

      blockPlate._body.appendChild(tbSettings);
      tbSettings.style.removeProperty('display');
      tbSettings.classList.remove('tb-hide-mobile');
      tbSettings.querySelectorAll('label').forEach(function (l) {
        if ((l.textContent || '').indexOf('Настройки выбранной надписи') !== -1) l.remove();
      });
    }

    /* ---------- подложка: вложена ВНУТРЬ плашки ---------- */
    if (ribToggle || ribSet) {
      var blockRib = makeBlock('ribbon', 'Подложка под текст', 'pbCollapsed_ribbon');
      blockPlate._body.appendChild(blockRib);

      if (ribToggle) {
        ribToggle.style.removeProperty('background');
        blockRib._body.appendChild(ribToggle);
      }
      if (ribSet) {
        blockRib._body.appendChild(ribSet);
        ribSet.style.removeProperty('display');
        ribSet.querySelectorAll('label').forEach(function (l) {
          if ((l.textContent || '').indexOf('Настройки подложки') !== -1) l.remove();
        });
      }
      tintSubLabels(blockRib);
      tintButtons(blockRib);
    }

    tintSubLabels(blockPlate);
    tintButtons(blockPlate, ['pbAddPlate']);

    /* ---------- лишние разделители ---------- */
    Array.prototype.slice.call(panel.children).forEach(function (el, i, arr) {
      if (el.tagName !== 'HR') return;
      var near = function (n) { return n && n.classList && n.classList.contains('pb-block'); };
      if (near(arr[i - 1]) || near(arr[i + 1])) el.remove();
    });

    /* ---------- настройки всегда видны ----------
       Прежде они прятались, как только снималось выделение,
       и «улетали» из-под курсора. Теперь остаются на месте. */
    if (typeof window.syncTbSettings === 'function') {
      var origSync = window.syncTbSettings;
      window.syncTbSettings = function () {
        var r = origSync.apply(this, arguments);
        try {
          if (tbSettings) tbSettings.style.display = '';
          if (ribSet) {
            var box = (typeof getTbTargetBox === 'function') ? getTbTargetBox() : null;
            var on = !!(box && box.dataset && box.dataset.mode === 'ribbon');
            ribSet.style.display = on ? '' : 'none';
          }
        } catch (e) {}
        return r;
      };
    }

    /* ---------- выделение плашки не слетает от клика по панели ----------
       Из-за этого переставал меняться цвет подложки на холсте:
       панель показывала новый цвет, а применять его было уже не к чему. */
    panel.addEventListener('mousedown', function (e) {
      if (e.target.closest('input, select, button, textarea')) {
        e.stopPropagation();
      }
    }, true);

    panel.addEventListener('pointerdown', function (e) {
      if (e.target.closest('input, select, button, textarea')) {
        e.stopPropagation();
      }
    }, true);
  });
})();
