const panelEl = document.querySelector('.panel');
panelEl.addEventListener('mousedown', function(e) {
if (e.target.closest('button') || e.target.closest('.emoji-bar span') || e.target.closest('input[type=color]')) {
// Сохраняем выделение ПРЯМО СЕЙЧАС, до потери фокуса
saveSelectionBeforeAction();
// Не даём фокусу уйти с текста на кнопку/палитру
if (!e.target.closest('input[type=color]')) e.preventDefault();
}
});

const quickBar = document.getElementById('quickBar');
const qbWordColor = document.getElementById('qbWordColor');

editor.addEventListener('focus', function() {
if (isMobile()) quickBar.classList.add('visible');
});

document.addEventListener('focusin', function(e){
  if (isMobile() && e.target.classList && e.target.classList.contains('text-box')) {
    quickBar.classList.add('visible');
  }
});

document.addEventListener('touchstart', function(e){
  if (isMobile() && e.target.closest && e.target.closest('.text-box')) {
    quickBar.classList.add('visible');
  }
}, {passive: true});

editor.addEventListener('blur', function() {
setTimeout(function() {
const active = document.activeElement;
const inTextBox = active && active.classList && active.classList.contains('text-box');
if (!editor.matches(':focus')
&& !inTextBox
&& active !== qbWordColor
&& active !== document.getElementById('qbFontSelect')
&& active !== document.getElementById('qbImageInput')) {
quickBar.classList.remove('visible');
}
}, 300);
});

qbWordColor.addEventListener('focus', function() {
if (isMobile()) quickBar.classList.add('visible');
});

if (window.visualViewport) {
window.visualViewport.addEventListener('resize', positionQuickBar);
window.visualViewport.addEventListener('scroll', positionQuickBar);
}
function positionQuickBar() {
if (!quickBar.classList.contains('visible')) return;
const vv = window.visualViewport;
const bottomGap = window.innerHeight - (vv.height + vv.offsetTop);
quickBar.style.bottom = bottomGap + 'px';
}

function qb(e, command) {
if(e && e.preventDefault) e.preventDefault();
format(command);
}

function qbSize(e, factor) {
if(e && e.preventDefault) e.preventDefault();
changeWordSize(factor);
}
function qbLink(e) {
if(e && e.preventDefault) e.preventDefault();
insertLink();
}

function qbClean(e) {
if(e && e.preventDefault) e.preventDefault();
cleanFormat();
}

function qbFont(font) {
  if (!font) return;

  const hasFrozen =
    savedSelectionForFont &&
    !savedSelectionForFont.collapsed &&
    savedSelectionForFont.toString().trim().length > 0;

  if (hasFrozen) {
    const scope = currentTextBox || editor;
    if (scope) scope.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelectionForFont);
    savedSelection = savedSelectionForFont.cloneRange();
    applyWordFont(font);
  } else {
    editor.style.fontFamily = font;
    if (fontFamilySelector) {
      const hasOption = Array.from(fontFamilySelector.options).some(o => o.value === font);
      if (hasOption) fontFamilySelector.value = font;
    }
    updateRatio();
    saveHistory();
  }

  savedSelectionForFont = null;
}

function qbImage(e) {
if(e && e.preventDefault) e.preventDefault();
saveSelectionBeforeAction();
document.getElementById('qbImageInput').click();
}

function togglePanel() {
const panel = document.querySelector('.panel');
const handle = document.getElementById('panelHandle');
panel.classList.toggle('open');
handle.classList.toggle('open');
handle.textContent = panel.classList.contains('open') ? '‹' : '›';
// Как только панель открыта любым способом — прячем кнопку "Инструменты"
if (panel.classList.contains('open')) {
  const btn = document.getElementById('mobileToolsBtn');
  if (btn) btn.style.display = 'none';
}
}

function onMobileToolsClick() {
  togglePanel();
  const btn = document.getElementById('mobileToolsBtn');
  if (btn) btn.style.display = 'none';
}

