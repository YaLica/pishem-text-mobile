/* font-sheet-panel.js
 * Открывает красивую шрифтовую панель для трёх select'ов в шторке.
 * Только мобайл. Компьютер — нативный select, не трогаем.
 *
 * Ключевое: перехватываем pointerdown на document в capture-фазе,
 * чтобы сработать до нативного открытия select. НЕ вызываем
 * stopPropagation — panel-fixes.js должен получить событие и
 * восстановить currentTextBox через keepSelected().
 *
 * Подключать после font-sheet.js.
 */
(function () {
  'use strict';

  function mobile() {
    return typeof isMobile === 'function' ? isMobile() : window.innerWidth <= 820;
  }

  function getOptions(sel) {
    var opts = [];
    Array.prototype.forEach.call(sel.options, function (opt) {
      if (opt.value) opts.push({ value: opt.value, label: opt.textContent.trim() });
    });
    return opts;
  }

  function buildPanel(panelId, titleText) {
    var existing = document.getElementById(panelId);
    if (existing) return existing;

    var sheet = document.createElement('div');
    sheet.id = panelId;

    var head = document.createElement('div');
    head.className = 'fs-head';

    var title = document.createElement('span');
    title.className = 'fs-title';
    title.textContent = titleText;

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'fs-close';
    close.setAttribute('aria-label', 'Закрыть список шрифтов');
    close.textContent = '\u2715';
    close.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hide(sheet);
    });

    head.appendChild(title);
    head.appendChild(close);
    var list = document.createElement('div');
    list.className = 'fs-list';
    sheet.appendChild(head);
    sheet.appendChild(list);
    document.body.appendChild(sheet);

    document.addEventListener('click', function (e) {
      if (!sheet.classList.contains('open')) return;
      if (e.target.closest && e.target.closest('#' + panelId)) return;
      hide(sheet);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) hide(sheet);
    });
    return sheet;
  }

  function place(panel) {
    var qb = document.getElementById('quickBar');
    var gap = 6;
    if (qb && getComputedStyle(qb).display !== 'none') {
      var r = qb.getBoundingClientRect();
      panel.style.bottom = Math.round(window.innerHeight - r.top + gap) + 'px';
    } else {
      panel.style.bottom = gap + 'px';
    }
  }

  function schedulePlace(panel) {
    place(panel);
    [60, 180, 360, 600].forEach(function (ms) { setTimeout(function () { place(panel); }, ms); });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      document.querySelectorAll('#fsPanelMain.open,#fsPanelWord.open,#fsPanelTb.open').forEach(place);
    });
  }

  function show(panel, opts, callback) {
    var list = panel.querySelector('.fs-list');
    list.innerHTML = '';
    opts.forEach(function (opt) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'fs-item';
      row.setAttribute('role', 'option');
      row.textContent = opt.label;
      row.style.fontFamily = opt.value;
      row.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hide(panel);
        callback(opt.value);
      });
      list.appendChild(row);
    });
    panel.classList.add('open');
    schedulePlace(panel);
  }

  function hide(panel) { panel.classList.remove('open'); }

  function hideAll() {
    ['fsPanelMain', 'fsPanelWord', 'fsPanelTb'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) hide(p);
    });
    var orig = document.getElementById('fontSheet');
    if (orig) orig.classList.remove('open');
  }

  function attachToSelect(selEl, panelId, panelTitle, callback, needsFreeze) {
    if (!selEl) return;
    var panel = buildPanel(panelId, panelTitle);

    /* Вешаем на document в capture-фазе через pointerdown.
     * pointerdown срабатывает до нативного открытия <select>.
     * НЕ вызываем stopPropagation — panel-fixes.js должен получить
     * событие и сделать keepSelected() чтобы currentTextBox остался
     * актуальным перед применением шрифта. */
    document.addEventListener('pointerdown', function (e) {
      if (!mobile()) return;
      if (e.target !== selEl && !selEl.contains(e.target)) return;

      /* preventDefault блокирует нативное открытие select */
      e.preventDefault();

      if (panel.classList.contains('open')) {
        hide(panel);
        return;
      }

      if (needsFreeze) {
        if (typeof freezeSelectionForFont === 'function') freezeSelectionForFont();
        else if (typeof saveSelectionBeforeAction === 'function') saveSelectionBeforeAction();
      }

      hideAll();
      var opts = getOptions(selEl);

      /* Задержка 30мс: panel-fixes делает setTimeout(keepSelected,0),
       * нам нужно открыться после того как currentTextBox восстановлен */
      setTimeout(function () { show(panel, opts, callback); }, 30);
    }, true); /* capture:true — срабатываем до panel-fixes */
  }

  function init() {
    /* 1. Основной шрифт поста */
    var selMain = document.getElementById('fontFamilySelector');
    if (selMain) {
      attachToSelect(selMain, 'fsPanelMain', '\u0428\u0440\u0438\u0444\u0442 \u043f\u043e\u0441\u0442\u0430', function (v) {
        if (typeof updateFontFamily === 'function') updateFontFamily(v);
        selMain.value = v;
      }, false);
    }

    /* 2. Шрифт выделенного слова */
    var selWord = null;
    document.querySelectorAll('select').forEach(function (s) {
      if (!s.id && (s.getAttribute('onchange') || '').indexOf('applyWordFont') !== -1) selWord = s;
    });
    if (selWord) {
      attachToSelect(selWord, 'fsPanelWord', '\u0428\u0440\u0438\u0444\u0442 \u0441\u043b\u043e\u0432\u0430', function (v) {
        if (typeof applyWordFont === 'function') applyWordFont(v);
        selWord.selectedIndex = 0;
      }, true);
    }

    /* 3. Шрифт плашки */
    var selTb = document.getElementById('tbFontFamily');
    if (selTb) {
      attachToSelect(selTb, 'fsPanelTb', '\u0428\u0440\u0438\u0444\u0442 \u043f\u043b\u0430\u0448\u043a\u0438', function (v) {
        if (typeof setTbFontFamily === 'function') setTbFontFamily(v);
        selTb.value = v;
      }, false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.reinitFontSheetPanels = init;
})();
