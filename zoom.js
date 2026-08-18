const SAFE_RATIO = 1.25;
const WARN_RATIO = 1.60;

let currentZoom = 1;
let userZoomed = false;
let panX = 0;
let panY = 0;
let handMode = false;

function toggleMode() {
handMode = !handMode;
const btn = document.getElementById('modeBtn');
if (handMode) {
stageArea.classList.add('hand-mode');
btn.textContent = '✋';
btn.classList.add('active');
editor.setAttribute('contenteditable', 'false');
editor.blur();
if (document.activeElement) document.activeElement.blur();
} else {
stageArea.classList.remove('hand-mode');
btn.textContent = '✍️';
btn.classList.remove('active');
editor.setAttribute('contenteditable', 'true');
editor.focus();
}
}

function applyZoom() {
if (currentZoom < 0.1) currentZoom = 0.1;
if (currentZoom > 3) currentZoom = 3;
zoomWrapper.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentZoom + ')';
const label = document.getElementById('zoomLabel');
if (label) label.textContent = Math.round(currentZoom * 100) + '%';
}

function autoScreenFit() {
if (userZoomed) { applyZoom(); return; }
const availW = stageArea.clientWidth - 40;
const availH = stageArea.clientHeight - 40;
const nodeW = exportNode.offsetWidth;
const nodeH = exportNode.offsetHeight;
let scale = Math.min(availW / nodeW, availH / nodeH, 1);
if (scale < 0.1) scale = 0.1;
currentZoom = scale;
panX = 0; panY = 0;
applyZoom();
}

function zoomStep(delta) {
userZoomed = true;
currentZoom = Math.round((currentZoom + delta) * 100) / 100;
applyZoom();
}

function zoomFit() {
userZoomed = false;
panX = 0; panY = 0;
if (handMode) toggleMode();
autoScreenFit();
}

function canPan(target) {
if (target.closest('#zoomControls')) return false;
if (target.closest('.text-box')) return false;
if (target.closest('.img-box')) return false;
if (handMode) return true;
if (target.closest('#editor')) return false;
return true;
}

stageArea.addEventListener('wheel', function(e) {
e.preventDefault();
userZoomed = true;
if (e.ctrlKey || e.metaKey) {
currentZoom += (e.deltaY < 0 ? 0.1 : -0.1);
} else {
if (e.shiftKey) {
panX -= e.deltaY;
} else {
panX -= e.deltaX;
panY -= e.deltaY;
}
}
applyZoom();
}, { passive: false });

let isPanning = false, panStartX = 0, panStartY = 0, panOrigX = 0, panOrigY = 0;
stageArea.addEventListener('mousedown', function(e) {
if (!canPan(e.target)) return;
isPanning = true;
userZoomed = true;
stageArea.classList.add('panning');
zoomWrapper.classList.add('dragging');
panStartX = e.clientX; panStartY = e.clientY;
panOrigX = panX; panOrigY = panY;
});
document.addEventListener('mousemove', function(e) {
if (!isPanning) return;
panX = panOrigX + (e.clientX - panStartX);
panY = panOrigY + (e.clientY - panStartY);
applyZoom();
});
document.addEventListener('mouseup', function() {
if (!isPanning) return;
isPanning = false;
stageArea.classList.remove('panning');
zoomWrapper.classList.remove('dragging');
});

let pinchStartDist = 0, pinchStartZoom = 1;
let touchPanStartX = 0, touchPanStartY = 0, touchPanOrigX = 0, touchPanOrigY = 0;
let touchMode = null;

stageArea.addEventListener('touchstart', function(e) {
if (e.touches.length === 1) {
if (!canPan(e.target)) { touchMode = null; return; }
touchMode = 'pan';
userZoomed = true;
stageArea.classList.add('panning');
zoomWrapper.classList.add('dragging');
touchPanStartX = e.touches[0].clientX;
touchPanStartY = e.touches[0].clientY;
touchPanOrigX = panX;
touchPanOrigY = panY;
} else if (e.touches.length === 2) {
touchMode = 'pinch';
zoomWrapper.classList.add('dragging');
pinchStartDist = Math.hypot(
e.touches[0].clientX - e.touches[1].clientX,
e.touches[0].clientY - e.touches[1].clientY
);
pinchStartZoom = currentZoom;
}
}, { passive: false });

stageArea.addEventListener('touchmove', function(e) {
if (touchMode === 'pan' && e.touches.length === 1) {
e.preventDefault();
panX = touchPanOrigX + (e.touches[0].clientX - touchPanStartX);
panY = touchPanOrigY + (e.touches[0].clientY - touchPanStartY);
applyZoom();
} else if (touchMode === 'pinch' && e.touches.length === 2) {
e.preventDefault();
userZoomed = true;
const dist = Math.hypot(
e.touches[0].clientX - e.touches[1].clientX,
e.touches[0].clientY - e.touches[1].clientY
);
currentZoom = pinchStartZoom * (dist / pinchStartDist);
applyZoom();
}
}, { passive: false });

stageArea.addEventListener('touchend', function(e) {
if (e.touches.length === 0) {
touchMode = null;
stageArea.classList.remove('panning');
zoomWrapper.classList.remove('dragging');
}
}, { passive: false });

window.onload = () => { saveHistory(); focusEditor(); setRealVH(); updateRatio(); autoScreenFit(); };

function updateBgColor(color) { exportNode.style.setProperty('--bg-color', color); }
function updateMainTextColor(color) { exportNode.style.setProperty('--text-color', color); }
function updateFontFamily(font) { editor.style.fontFamily = font; updateRatio(); saveHistory(); }

  let _fitTimer = null;
function scheduleScreenFit() {
  clearTimeout(_fitTimer);
  _fitTimer = setTimeout(autoScreenFit, 250);
}
function updateRatio() {
const w = exportNode.offsetWidth;
const h = exportNode.offsetHeight;
const ratio = h / w;
const box = document.getElementById('ratioBox');
const title = document.getElementById('ratioTitle');
const fill = document.getElementById('ratioFill');
document.getElementById('ratioSize').textContent = w + ' × ' + h;
document.getElementById('ratioValue').textContent = ratio.toFixed(2);
let percent = Math.min((ratio / WARN_RATIO) * 100, 100);
fill.style.width = percent + '%';
box.classList.remove('warn', 'danger');
if (ratio <= SAFE_RATIO) {
title.className = 'ratio-title ok';
title.textContent = '🟢 Идеальные пропорции для ленты (PNG)';
fill.style.background = '#4ade80';
} else if (ratio <= WARN_RATIO) {
box.classList.add('warn');
title.className = 'ratio-title warn';
title.textContent = '🟡 PNG вытягивается (в чате будет казаться уже)';
fill.style.background = '#fbbf24';
} else {
box.classList.add('danger');
title.className = 'ratio-title danger';
title.textContent = '🔴 Очень высокий PNG! В чате он станет совсем узким';
fill.style.background = '#ff4d4d';
}
scheduleScreenFit();
}

