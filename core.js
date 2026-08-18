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

