/* ==========================================================================
   ЦВЕТОВЫЕ ШКАЛЫ НА ANDROID — отдельный изолированный модуль.

   Задача. На Android Chrome палитра выбора цвета — это системное окно
   с тремя ползунками (тон, насыщенность, яркость). Само окно рисует
   Android, стилями его не достать. Но что в нём показано — зависит от
   значения поля в момент открытия.

   Пять полей в проекте открываются со значением #000000. Чёрный — это
   яркость ноль, и при нулевой яркости все три шкалы вырождаются в чёрные
   полосы: ни тона, ни насыщенности не видно, ползунки прижаты к началу.

   Решение. Перед самым открытием окна, если в поле практически чёрный,
   подставляем середину: тон 180°, насыщенность 50%, яркость 50% — это
   #408080. Все три ползунка встают посередине своих шкал, шкалы
   раскрашиваются, цвета видно.

   Важно: значение подставляется молча. Событие input при программной
   записи не возникает, поэтому к посту ничего не применяется. Если
   пользователь закроет окно, ничего не выбрав, прежнее значение
   возвращается на место.

   Работает только на Android. Компьютер и iPhone не затрагиваются.
   ========================================================================== */

(function () {
  'use strict';

  if (!/Android/i.test(navigator.userAgent)) return;

  /* Середина всех трёх шкал: HSV(180°, 50%, 50%). */
  var SEED = '#408080';

  /* Ниже этого значения любого канала цвет считаем чёрным. */
  var DARK_LIMIT = 40;

  /* Что подменили и на что — чтобы вернуть при отказе от выбора. */
  var pending = null;

  function isNearlyBlack(hex) {
    if (typeof hex !== 'string') return false;
    var m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return false;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255;
    var g = (n >> 8) & 255;
    var b = n & 255;
    return Math.max(r, g, b) < DARK_LIMIT;
  }

  /* Ползунки пальцем не двигают — окно открывается по нажатию.
     pointerdown срабатывает заведомо раньше, чем окно успеет открыться. */
  function beforeOpen(e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'color') return;

    var prev = el.value || '#000000';
    if (!isNearlyBlack(prev)) return;   // цвет и так видно, не трогаем

    pending = { el: el, prev: prev, touched: false };
    el.value = SEED;
  }

  /* Пользователь что-то выбрал — возвращать прежнее не нужно. */
  function markTouched(e) {
    if (pending && e.target === pending.el) pending.touched = true;
  }

  /* Окно закрылось, страница снова получила фокус.
     Если выбора не было — тихо возвращаем прежний цвет. */
  function afterClose() {
    if (!pending) return;
    var p = pending;
    setTimeout(function () {
      if (p && !p.touched && p.el && p.el.isConnected) {
        p.el.value = p.prev;
      }
      if (pending === p) pending = null;
    }, 350);
  }

  document.addEventListener('pointerdown', beforeOpen, true);
  document.addEventListener('input',  markTouched, true);
  document.addEventListener('change', markTouched, true);
  window.addEventListener('focus', afterClose);
})();
