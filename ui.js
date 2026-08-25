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
if (isMobile()) showQuickBar();
});

document.addEventListener('focusin', function(e){
  if (isMobile() && e.target.classList && e.target.classList.contains('text-box')) {
    showQuickBar();
  }
});

document.addEventListener('touchstart', function(e){
  if (isMobile() && e.target.closest && e.target.closest('.text-box')) {
    showQuickBar();
  }
}, {passive: true});

// Нажатие на картинку тоже держит панель на экране.
document.addEventListener('touchstart', function(e){
  if (isMobile() && e.target.closest && e.target.closest('.img-box')) {
    showQuickBar();
  }
}, {passive: true});
document.addEventListener('click', function(e){
  if (isMobile() && e.target.closest && e.target.closest('.img-box')) {
    showQuickBar();
  }
});

editor.addEventListener('blur', function() {
setTimeout(function() {
const active = document.activeElement;
const inTextBox = active && active.classList && active.classList.contains('text-box');
// Выбранная картинка — тоже работа в редакторе. Раньше она не попадала ни
// в одно из условий, поэтому после нажатия на фото панель пропадала и
// добраться до кнопок было нельзя.
const imgPicked = !!(typeof currentImgBox !== 'undefined' && currentImgBox);
if (!editor.matches(':focus')
&& !inTextBox
&& !imgPicked
&& active !== qbWordColor
&& active !== document.getElementById('qbFontSelect')
&& active !== document.getElementById('qbImageInput')) {
quickBar.classList.remove('visible');
}
}, 300);
});

qbWordColor.addEventListener('focus', function() {
if (isMobile()) showQuickBar();
});

if (window.visualViewport) {
window.visualViewport.addEventListener('resize', positionQuickBar);
window.visualViewport.addEventListener('scroll', positionQuickBar);
}

// Вставка картинки — самый сложный случай. Пока открыт выбор файла,
// клавиатура уезжает, потом возвращается вместе с фокусом в редакторе,
// и к этому моменту старое значение отступа уже не подходит. Поэтому
// пересчитываем положение и после выбора файла, и после возврата фокуса.
document.addEventListener('change', function(e) {
  if (!isMobile()) return;
  const t = e.target;
  if (t && t.type === 'file') scheduleQuickBarPosition();
}, true);

editor.addEventListener('focus', function() {
  if (isMobile()) scheduleQuickBarPosition();
});

// Возврат в приложение после системного диалога выбора фото.
window.addEventListener('focus', function() {
  if (isMobile() && quickBar.classList.contains('visible')) {
    scheduleQuickBarPosition();
  }
});
// Клавиатура на телефоне появляется и прячется с анимацией, и браузер
// сообщает о новом размере видимой области не сразу. Когда вставляешь
// картинку, происходит так: редактор теряет фокус, клавиатура уезжает,
// отступ пересчитывается в ноль, затем клавиатура возвращается — а
// пересчёта уже никто не делает. Панель остаётся у самого низа и уходит
// под клавиатуру. Поэтому после каждого показа панели пересчитываем
// положение несколько раз, пока анимация не закончится.
function scheduleQuickBarPosition() {
  positionQuickBar();
  [60, 160, 320, 550, 850].forEach(function(ms) {
    setTimeout(positionQuickBar, ms);
  });
}

// Показать панель и сразу поставить её на правильную высоту.
function showQuickBar() {
  quickBar.classList.add('visible');
  scheduleQuickBarPosition();
}

function positionQuickBar() {
  if (!quickBar.classList.contains('visible')) return;

  const vv = window.visualViewport;
  if (!vv) { quickBar.style.bottom = ''; return; }

  // Высота клавиатуры = насколько видимая область меньше окна.
  let gap = window.innerHeight - (vv.height + vv.offsetTop);

  // Отрицательное значение появляется при прокрутке страницы: панель
  // уезжала бы вниз за край экрана. Ниже нуля не опускаем.
  if (!isFinite(gap) || gap < 0) gap = 0;

  quickBar.style.bottom = Math.round(gap) + 'px';
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

function qbAlign(e, cmd) {
if(e && e.preventDefault) e.preventDefault();
format(cmd);
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

