/* Свой список шрифтов для телефона.
 *
 * Зачем: на кнопке шрифта стоит обычный <select>. На iPhone его список
 * рисует сама операционная система — тот самый белый лист на весь низ
 * экрана. CSS на него не действует вообще, прозрачным его сделать нельзя.
 *
 * Поэтому список рисуем свой: полупрозрачный, без размытия позади.
 * Рабочий код не переписывается — сам <select> остаётся на месте, выбор
 * шрифта по-прежнему делает штатная функция qbFont(). Этот файл только
 * перехватывает нажатие и показывает свой список вместо системного.
 */
(function () {
  'use strict';

  var SEL_ID = 'qbFontSelect';
  var sheet = null;
  var isOpen = false;

  function mobile() {
    return typeof isMobile === 'function' ? isMobile() : window.innerWidth <= 820;
  }

  function build() {
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = 'fontSheet';
    sheet.setAttribute('role', 'listbox');
    sheet.setAttribute('aria-label', 'Выбор шрифта');

    var head = document.createElement('div');
    head.className = 'fs-head';

    var title = document.createElement('span');
    title.className = 'fs-title';
    title.textContent = 'Шрифт';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'fs-close';
    close.setAttribute('aria-label', 'Закрыть список шрифтов');
    close.textContent = '✕';
    close.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hide();
    });

    head.appendChild(title);
    head.appendChild(close);
    sheet.appendChild(head);

    var list = document.createElement('div');
    list.className = 'fs-list';
    sheet.appendChild(list);

    document.body.appendChild(sheet);
    return sheet;
  }

  function fill() {
    var sel = document.getElementById(SEL_ID);
    if (!sel) return;

    var list = sheet.querySelector('.fs-list');
    list.innerHTML = '';

    Array.prototype.forEach.call(sel.options, function (opt) {
      // первый пункт — это подпись кнопки, не шрифт
      if (!opt.value) return;

      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'fs-item';
      row.setAttribute('role', 'option');
      row.textContent = opt.textContent;
      // показываем название сразу этим же шрифтом
      row.style.fontFamily = opt.value;

      row.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hide();
        if (typeof qbFont === 'function') qbFont(opt.value);
      });

      list.appendChild(row);
    });
  }

  // Список ставим над quickBar, а тот уже стоит над клавиатурой и над
  // собственной полоской Safari. Считаем от него, чтобы не дублировать
  // логику клавиатуры второй раз.
  function place() {
    if (!sheet) return;
    var qb = document.getElementById('quickBar');
    var gap = 6;
    if (qb && getComputedStyle(qb).display !== 'none') {
      var r = qb.getBoundingClientRect();
      sheet.style.bottom = Math.round(window.innerHeight - r.top + gap) + 'px';
    } else {
      sheet.style.bottom = gap + 'px';
    }
  }

  function schedulePlace() {
    place();
    [60, 180, 360, 600].forEach(function (ms) { setTimeout(place, ms); });
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () { if (isOpen) place(); });
    window.visualViewport.addEventListener('scroll', function () { if (isOpen) place(); });
  }

  function show() {
    build();
    fill();
    sheet.classList.add('open');
    isOpen = true;
    schedulePlace();
  }

  function hide() {
    if (!sheet) return;
    sheet.classList.remove('open');
    isOpen = false;
  }

  // Закрытие по нажатию мимо списка.
  document.addEventListener('click', function (e) {
    if (!isOpen) return;
    if (e.target.closest && (e.target.closest('#fontSheet') || e.target.closest('#' + SEL_ID))) return;
    hide();
  });

  document.addEventListener('keydown', function (e) {
    if (isOpen && e.key === 'Escape') hide();
  });

  function attach() {
    var sel = document.getElementById(SEL_ID);
    if (!sel) return;

    // Перехватываем нажатие раньше штатного обработчика.
    // Выделение замораживаем сами — в тот же момент, что и раньше,
    // пока фокус ещё жив. Иначе выбранное слово потеряется.
    function intercept(e) {
      if (!mobile()) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof freezeSelectionForFont === 'function') freezeSelectionForFont();
      isOpen ? hide() : show();
    }

    sel.addEventListener('touchstart', intercept, { passive: false });
    sel.addEventListener('mousedown', intercept);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
