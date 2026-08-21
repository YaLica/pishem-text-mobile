/* ==========================================================================
   ПАНЕЛЬ БЛОКАМИ — часть 1

   Скрипт не создаёт кнопки заново, а переносит существующие внутрь блоков.
   Поэтому все обработчики, id и функции остаются рабочими: меняется
   только расположение и оформление.

   Что делает:
     1. Блок «Платформа и текст»  — от платформы до ползунков включительно
     2. Блок «Картинки»
     3. Кнопку «Добавить плашку» выносит из блока картинок — ниже него
     4. Блок «Плашка»    — сворачивается стрелкой
     5. Блок «Подложка»  — сворачивается стрелкой, независимо от плашки
     6. Снимает самопроизвольное сворачивание: секции закрываются
        только по клику на стрелку

   Панель форматирования не трогается: она общая для основного текста
   и для текста плашек.
   ========================================================================== */

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function makeBlock(kind, title, collapsible, storageKey) {
    const block = document.createElement('div');
    block.className = 'pb-block pb-' + kind;

    const head = document.createElement('div');
    head.className = 'pb-head';

    const h = document.createElement('div');
    h.className = 'pb-title';
    h.textContent = title;
    head.appendChild(h);

    const body = document.createElement('div');
    body.className = 'pb-body';

    if (collapsible) {
      const arrow = document.createElement('button');
      arrow.type = 'button';
      arrow.className = 'pb-arrow';
      arrow.textContent = '▾';
      arrow.title = 'Свернуть или развернуть';
      arrow.setAttribute('aria-expanded', 'true');
      arrow.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const closed = block.classList.toggle('pb-collapsed');
        arrow.setAttribute('aria-expanded', String(!closed));
        if (storageKey) {
          try { localStorage.setItem(storageKey, closed ? '1' : '0'); } catch (err) {}
        }
      });
      head.appendChild(arrow);

      // состояние запоминается между заходами
      let saved = null;
      try { saved = localStorage.getItem(storageKey); } catch (err) {}
      if (saved === '1') {
        block.classList.add('pb-collapsed');
        arrow.setAttribute('aria-expanded', 'false');
      }
    }

    block.appendChild(head);
    block.appendChild(body);
    block._body = body;
    return block;
  }

  function addHint(block, text) {
    const p = document.createElement('p');
    p.className = 'pb-hint';
    p.textContent = text;
    block._body.insertBefore(p, block._body.firstChild);
  }

  // кнопки внутри блока красим в цвет блока, снимая жёстко заданный фон
  function tintButtons(root, skipIds) {
    const skip = skipIds || [];
    root.querySelectorAll('button').forEach(function (b) {
      if (b.classList.contains('pb-arrow')) return;
      if (skip.indexOf(b.id) !== -1) return;
      b.style.removeProperty('background');
      b.style.removeProperty('background-color');
      b.style.removeProperty('border');
      b.classList.add('pb-tinted');
    });
  }

  // подписи-заголовки внутри блока — цветом блока
  function tintSubLabels(root) {
    root.querySelectorAll('label').forEach(function (l) {
      const c = (l.getAttribute('style') || '');
      if (/color\s*:/i.test(c)) {
        l.style.removeProperty('color');
        l.classList.add('pb-sub');
      }
    });
  }

  ready(function build() {
    const panel = document.querySelector('.panel');
    const delImg = document.getElementById('btnDeleteImg');
    if (!panel || !delImg) return;
    if (panel.querySelector('.pb-block')) return; // уже перестроено

    const imgWrap    = delImg.parentElement;
    const tbSettings = document.getElementById('tbSettings');
    const ribToggle  = document.getElementById('tbRibbonToggle');
    const ribSet     = document.getElementById('tbRibbonSettings');
    const imgSet     = document.getElementById('imgSettings');

    // кнопка «Добавить надпись (плашку)» лежит внутри блока картинок
    let addBtn = null;
    imgWrap.querySelectorAll('button').forEach(function (b) {
      const h = b.getAttribute('onclick') || '';
      if (h.indexOf('addTextBox') !== -1) addBtn = b;
    });

    /* ---------- блок 1: платформа и текст ---------- */
    const kids = Array.prototype.slice.call(panel.children);
    let from = -1, to = -1;
    for (let i = 0; i < kids.length; i++) {
      const t = (kids[i].textContent || '');
      if (from === -1 && kids[i].tagName === 'LABEL' && t.indexOf('Платформа') !== -1) from = i;
      if (kids[i].classList && kids[i].classList.contains('dual-slider-row')) { to = i; break; }
    }

    let blockBase = null;
    if (from !== -1 && to !== -1 && to >= from) {
      blockBase = makeBlock('base', 'Платформа и текст', true, 'pbCollapsed_base');
      panel.insertBefore(blockBase, kids[from]);
      for (let i = from; i <= to; i++) blockBase._body.appendChild(kids[i]);
      tintSubLabels(blockBase);
      // кнопки выбора платформы оставляем как есть: у них своё состояние active
    }

    /* ---------- блок 2: картинки ---------- */
    const blockImg = makeBlock('img', 'Картинки', true, 'pbCollapsed_img');
    panel.insertBefore(blockImg, imgWrap);

    // сначала уносим из коробки картинок всё, что к ней не относится
    if (addBtn)     imgWrap.removeChild(addBtn);
    if (tbSettings) imgWrap.removeChild(tbSettings);

    // остальное содержимое коробки переезжает в блок
    while (imgWrap.firstChild) blockImg._body.appendChild(imgWrap.firstChild);
    imgWrap.parentNode.removeChild(imgWrap);

    // убираем прежний заголовок-дубль «КАРТИНКИ»
    blockImg._body.querySelectorAll('label').forEach(function (l) {
      if ((l.textContent || '').trim().toUpperCase().indexOf('КАРТИНКИ') !== -1) l.remove();
    });
    tintSubLabels(blockImg);
    tintButtons(blockImg, ['btnDeleteImg']);
    addHint(blockImg, 'Выбери картинку на холсте — появятся её настройки.');

    /* ---------- кнопка «Добавить плашку» — ниже блока картинок ---------- */
    if (addBtn) {
      addBtn.id = 'pbAddPlate';
      addBtn.textContent = '➕ Добавить плашку';
      addBtn.style.removeProperty('background');
      addBtn.style.removeProperty('margin-top');
      addBtn.style.removeProperty('padding');
      blockImg.insertAdjacentElement('afterend', addBtn);
    }

    /* ---------- блок 3: плашка ---------- */
    let blockPlate = null;
    if (tbSettings) {
      blockPlate = makeBlock('plate', 'Плашка', true, 'pbCollapsed_plate');
      (addBtn || blockImg).insertAdjacentElement('afterend', blockPlate);

      // кнопку подложки и её настройки забираем в отдельный блок
      if (ribToggle && ribToggle.parentNode) ribToggle.parentNode.removeChild(ribToggle);
      if (ribSet && ribSet.parentNode) ribSet.parentNode.removeChild(ribSet);

      blockPlate._body.appendChild(tbSettings);
      tbSettings.style.removeProperty('display');
      tbSettings.classList.remove('tb-hide-mobile');

      // прежний заголовок внутри больше не нужен
      tbSettings.querySelectorAll('label').forEach(function (l) {
        if ((l.textContent || '').indexOf('Настройки выбранной надписи') !== -1) l.remove();
      });
      tintSubLabels(blockPlate);
      tintButtons(blockPlate);
      addHint(blockPlate, 'Выбери плашку на холсте — здесь появятся её настройки.');
    }

    /* ---------- блок 4: подложка ---------- */
    let blockRib = null;
    if (ribToggle || ribSet) {
      blockRib = makeBlock('ribbon', 'Подложка под текст', true, 'pbCollapsed_ribbon');
      (blockPlate || addBtn || blockImg).insertAdjacentElement('afterend', blockRib);

      if (ribToggle) {
        ribToggle.style.removeProperty('background');
        ribToggle.classList.add('pb-keep'); // остаётся активной, когда подложка выключена
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
      addHint(blockRib, 'Выбери плашку, затем включи подложку кнопкой ниже.');
    }

    /* ---------- лишние разделители между блоками ---------- */
    Array.prototype.slice.call(panel.children).forEach(function (el, i, arr) {
      if (el.tagName !== 'HR') return;
      const prev = arr[i - 1], next = arr[i + 1];
      const near = function (n) { return n && n.classList && n.classList.contains('pb-block'); };
      if (near(prev) || near(next)) el.remove();
    });

    /* ---------- секции больше не сворачиваются сами ---------- */
    // Прежде настройки прятались, как только снималось выделение,
    // и «улетали» из-под курсора. Теперь блок остаётся на месте,
    // а его содержимое просто гаснет, пока работать не с чем.
    function refreshStates() {
      const onMobile = window.matchMedia('(max-width: 900px)').matches;
      let box = null;
      try { box = (typeof getTbTargetBox === 'function') ? getTbTargetBox() : null; } catch (e) {}

      if (blockPlate && tbSettings) {
        tbSettings.style.display = '';
        blockPlate.classList.toggle('pb-idle', !box || onMobile);
      }
      if (blockRib) {
        if (ribSet) ribSet.style.display = '';
        const isRibbon = !!(box && box.dataset && box.dataset.mode === 'ribbon');
        blockRib.classList.toggle('pb-idle', !box || !isRibbon || onMobile);
      }
      if (blockImg) {
        let hasImg = false;
        try { hasImg = !!document.querySelector('.img-box.selected'); } catch (e) {}
        if (imgSet) imgSet.style.display = '';
        blockImg.classList.toggle('pb-idle', !hasImg);
      }
    }

    if (typeof window.syncTbSettings === 'function') {
      const original = window.syncTbSettings;
      window.syncTbSettings = function () {
        const r = original.apply(this, arguments);
        try { refreshStates(); } catch (e) {}
        return r;
      };
    }

    // подстраховка: состояние обновляется и на обычные действия мышью
    ['click', 'keyup', 'input'].forEach(function (ev) {
      document.addEventListener(ev, function () {
        clearTimeout(build._t);
        build._t = setTimeout(refreshStates, 60);
      }, true);
    });

    refreshStates();
  });
})();
