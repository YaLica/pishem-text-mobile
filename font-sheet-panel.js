/* font-sheet-panel.js
 *
 * Подключает красивую шрифтовую панель (из font-sheet.js) к трём
 * select'ам в боковой шторке, которые раньше открывали нативный список.
 *
 * Три источника и их callback'ы:
 *   fontFamilySelector  → updateFontFamily(v)   — шрифт всего поста
 *   <select без id>     → applyWordFont(v)       — шрифт выделенного слова
 *   tbFontFamily        → setTbFontFamily(v)     — шрифт плашки
 *
 * Каждой панели даётся уникальный id (fsPanelMain, fsPanelWord,
 * fsPanelTb). Стили задаются через font-sheet.css — нужно добавить
 * одну строку в существующий файл (см. инструкцию по подключению).
 *
 * Подключать ПОСЛЕ font-sheet.js.
 */
(function () {
  'use strict';

  function mobile() {
    return typeof isMobile === 'function' ? isMobile() : window.innerWidth <= 820;
  }

  /* Собираем опции из <select> */
  function getOptions(sel) {
    var opts = [];
    Array.prototype.forEach.call(sel.options, function (opt) {
      if (opt.value) opts.push({ value: opt.value, label: opt.textContent.trim() });
    });
    return opts;
  }

  /* Создаём панель с заданным id — CSS подхватывает через #fsPanelMain и т.д.
     Структура идентична #fontSheet из font-sheet.js. */
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
    close.textContent = '✕';
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

    /* Закрытие по клику снаружи */
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

  /* Позиция: над quickBar, как у оригинального #fontSheet */
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
    [60, 180, 360, 600].forEach(function (ms) {
      setTimeout(function () { place(panel); }, ms);
    });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      document.querySelectorAll('#fsPanelMain.open, #fsPanelWord.open, #fsPanelTb.open')
        .forEach(place);
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

  function hide(panel) {
    panel.classList.remove('open');
  }

  function hideAll() {
    ['fsPanelMain', 'fsPanelWord', 'fsPanelTb'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p) hide(p);
    });
    /* Закрываем и оригинальную панель quickBar, если открыта */
    var orig = document.getElementById('fontSheet');
    if (orig) orig.classList.remove('open');
  }

  /* Перехватываем нажатие на <select>, показываем свою панель */
  function attachToSelect(selEl, panelId, panelTitle, callback, needsFreeze) {
    if (!selEl) return;
    var panel = buildPanel(panelId, panelTitle);

    function intercept(e) {
      if (!mobile()) return;  /* на компе нативный select остаётся */
      e.preventDefault();
      e.stopPropagation();

      if (panel.classList.contains('open')) { hide(panel); return; }

      if (needsFreeze) {
        if (typeof freezeSelectionForFont === 'function') freezeSelectionForFont();
        else if (typeof saveSelectionBeforeAction === 'function') saveSelectionBeforeAction();
      }

      hideAll();
      show(panel, getOptions(selEl), callback);
    }

    selEl.addEventListener('touchstart', intercept, { passive: false });
    selEl.addEventListener('mousedown', intercept);
  }

  function init() {
    /* 1. Основной шрифт поста */
    var selMain = document.getElementById('fontFamilySelector');
    if (selMain) {
      attachToSelect(selMain, 'fsPanelMain', 'Шрифт поста', function (v) {
        if (typeof updateFontFamily === 'function') updateFontFamily(v);
        selMain.value = v;
      }, false);
    }

    /* 2. Шрифт выделенного слова — select без id, ищем по onchange */
    var selWord = null;
    document.querySelectorAll('select').forEach(function (s) {
      if (!s.id && (s.getAttribute('onchange') || '').indexOf('applyWordFont') !== -1) {
        selWord = s;
      }
    });
    if (selWord) {
      attachToSelect(selWord, 'fsPanelWord', 'Шрифт слова', function (v) {
        if (typeof applyWordFont === 'function') applyWordFont(v);
        selWord.selectedIndex = 0;
      }, true);  /* нужно сохранить выделение перед открытием */
    }

    /* 3. Шрифт плашки */
    var selTb = document.getElementById('tbFontFamily');
    if (selTb) {
      attachToSelect(selTb, 'fsPanelTb', 'Шрифт плашки', function (v) {
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
