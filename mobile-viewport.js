/* Coordinates of the visible page, including Safari keyboard/panning changes. */
(function () {
  'use strict';
  function bounds() {
    var vv = window.visualViewport;
    return {
      top: vv ? Math.max(0, vv.offsetTop || 0) : 0,
      left: vv ? Math.max(0, vv.offsetLeft || 0) : 0,
      width: vv && vv.width > 0 ? vv.width : window.innerWidth,
      height: vv && vv.height > 0 ? vv.height : window.innerHeight
    };
  }
  function update() {
    var b = bounds(), style = document.documentElement.style;
    style.setProperty('--visual-top', b.top + 'px');
    style.setProperty('--visual-left', b.left + 'px');
    style.setProperty('--visual-width', b.width + 'px');
    style.setProperty('--visual-height', b.height + 'px');
    document.documentElement.classList.toggle('mobile-viewport', window.innerWidth <= 820);
  }
  window.TextturaViewport = {bounds: bounds, update: update};
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', function () {
    update(); [100, 350, 700].forEach(function (ms) { setTimeout(update, ms); });
  });
  window.addEventListener('pageshow', update);
  update();
})();
