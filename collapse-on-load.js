/* Все сворачиваемые блоки панели («Платформа и текст», «Вставить картинку»,
   «Плашка», «Подложка под текст») сворачиваются при КАЖДОМ новом открытии
   редактора — вне зависимости от того, что было запомнено в localStorage
   в прошлый раз. Это отдельный довесок поверх panel-blocks.js, сам он
   не тронут. */
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }
  ready(function () {
    setTimeout(function () {
      document.querySelectorAll('.pb-block').forEach(function (block) {
        block.classList.add('pb-collapsed');
        var arrow = block.querySelector(':scope > .pb-head > .pb-arrow');
        if (arrow) arrow.setAttribute('aria-expanded', 'false');
      });
    }, 0);
  });
})();
