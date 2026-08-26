const editor = document.getElementById('editor');
const exportNode = document.getElementById('export-node');
const stageArea = document.getElementById('stageArea');
const zoomWrapper = document.getElementById('zoom-wrapper');
const baseFontSlider = document.getElementById('baseFontSlider');
const lineHeightSlider = document.getElementById('lineHeightSlider');
const fontFamilySelector = document.getElementById('fontFamilySelector');
let savedSelectionForFont = null;
let savedSelection = null;
let currentImgBox = null;
let historyStack = [];
let historyIndex = -1;

function isMobile() { return window.innerWidth <= 820; }
function focusEditor() { if (!isMobile()) editor.focus(); }

function setRealVH() {
const vh = window.innerHeight * 0.01;
document.documentElement.style.setProperty('--vh', vh + 'px');
autoScreenFit();
}
window.addEventListener('resize', setRealVH);
window.addEventListener('orientationchange', function(){ setTimeout(setRealVH, 200); });

// Undo/Redo должны быть закреплены относительно окна, а не находиться внутри сцены.
// Это особенно важно для iOS Safari: fixed-элемент внутри перемещаемого контейнера
// иногда начинает двигаться вместе с этим контейнером.
function mountFixedUndoRedo() {
const controls = document.getElementById('floatUndoRedo');
if (controls && controls.parentNode !== document.body) document.body.appendChild(controls);
}
mountFixedUndoRedo();

// На iPhone position:fixed отмеряется от разметочной области страницы, а не от
// того, что видно на экране. Поэтому стоит увести страницу щипком, открыть
// клавиатуру или потянуть страницу за край — и кнопки визуально уползают из
// угла, хотя в разметке стоят на месте. Android и компьютер такого не делают.
//
// Поэтому на iOS доводим кнопки вручную: смещаем ровно на сдвиг видимой
// области и делим на её масштаб, чтобы при увеличении страницы кнопки
// оставались того же размера и в том же углу.
(function keepUndoRedoInCorner() {
  var vv = window.visualViewport;
  if (!vv) return;

  // Доводка нужна на телефонах вообще, а не на каком-то одном.
  // На компьютере она не включается: там браузер держит fixed сам.
  function phone() {
    return typeof isMobile === 'function' ? isMobile() : window.innerWidth <= 820;
  }

  function place() {
    var el = document.getElementById('floatUndoRedo');
    if (!el) return;
    if (!phone()) { el.style.transform = ''; return; }
    var scale = vv.scale || 1;
    el.style.transform =
      'translate(' + Math.round(vv.offsetLeft) + 'px, ' + Math.round(vv.offsetTop) + 'px)' +
      (scale !== 1 ? ' scale(' + (1 / scale) + ')' : '');
    el.style.transformOrigin = 'top left';
  }

  // Сдвиг и масштаб меняются с анимацией, поэтому доводим несколько раз.
  function schedule() {
    place();
    [80, 200, 400, 700].forEach(function (ms) { setTimeout(place, ms); });
  }

  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', place);
  window.addEventListener('orientationchange', function () { setTimeout(schedule, 250); });
  window.addEventListener('focus', schedule);
  document.addEventListener('scroll', place, true);
  schedule();
})();

