/* ================= ЭТАП 1: РАСШИРЕННЫЕ КАРТИНКИ ================= */

function ensureRotor(box) {
  if (!box) return;
  let rotor = box.querySelector('.img-rotor');
  if (!rotor) {
    rotor = document.createElement('span');
    rotor.className = 'img-rotor';
    rotor.contentEditable = 'false';
    const img = box.querySelector('img');
    if (img) rotor.appendChild(img);
    const resizer = box.querySelector('.img-resizer');
    box.insertBefore(rotor, box.firstChild);
    if (resizer) box.appendChild(resizer);
  }
}

function positionMiniBar() {
  const bar = document.getElementById('imgMiniBar');
  if (!currentImgBox) { bar.classList.remove('visible'); return; }
  const r = currentImgBox.getBoundingClientRect();
  bar.classList.add('visible');
  const barW = bar.offsetWidth || 320;
  let left = r.left + r.width / 2 - barW / 2;
  let top = r.top - bar.offsetHeight - 8;
  if (top < 8) top = r.bottom + 8;
  if (left < 8) left = 8;
  if (left + barW > window.innerWidth - 8) left = window.innerWidth - barW - 8;
  bar.style.left = left + 'px';
  bar.style.top = top + 'px';
}

function hideMiniBar() {
  const bar = document.getElementById('imgMiniBar');
  if (bar) bar.classList.remove('visible');
}

function syncImgSettings() {
  const box = document.getElementById('imgSettings');
  if (!currentImgBox) { box.classList.remove('visible'); return; }
  box.classList.add('visible');
  const gap = parseInt(currentImgBox.dataset.gap || '20', 10);
  const rad = parseInt(currentImgBox.dataset.radius || '12', 10);
  const brd = parseInt(currentImgBox.dataset.border || '0', 10);
  const col = currentImgBox.dataset.borderColor || '#000000';
  const rot = parseInt(currentImgBox.dataset.rot || '0', 10);
  
  document.getElementById('imgGapRange').value = gap;
  document.getElementById('imgGapLabel').textContent = gap;
  document.getElementById('imgRadiusRange').value = rad;
  document.getElementById('imgRadiusLabel').textContent = rad;
  document.getElementById('imgBorderRange').value = brd;
  document.getElementById('imgBorderLabel').textContent = brd;
  document.getElementById('imgBorderColor').value = col;
  
  const rotRange = document.getElementById('imgRotRange');
  const rotLabel = document.getElementById('imgRotLabel');
  if (rotRange) rotRange.value = rot;
  if (rotLabel) rotLabel.textContent = rot;

  const miniSlider = document.getElementById('miniRotSlider');
  if (miniSlider) miniSlider.value = rot;

  syncImgMobilePanel();
}

function applyImgStyles(box) {
  if (!box) return;
  ensureRotor(box);
  const gap = parseInt(box.dataset.gap || '20', 10);
  const rad = parseInt(box.dataset.radius || '12', 10);
  const brd = parseInt(box.dataset.border || '0', 10);
  const col = box.dataset.borderColor || '#000000';
  const rot = parseInt(box.dataset.rot || '0', 10);

  box.style.setProperty('--img-radius', rad + 'px');
  box.style.setProperty('--img-border', brd + 'px');
  box.style.setProperty('--img-border-color', col);
  box.style.setProperty('--img-rot', rot + 'deg');

  const rotor = box.querySelector('.img-rotor');
  const img = box.querySelector('img');
  if (rotor) rotor.style.transform = 'rotate(' + rot + 'deg)';
  if (img) {
    img.style.borderRadius = rad + 'px';
    img.style.boxShadow = brd > 0 ? '0 0 0 ' + brd + 'px ' + col : 'none';
  }

  const isRight = box.classList.contains('align-right');
  const isCenter = box.classList.contains('align-center');

  if (isCenter) {
    box.style.margin = '10px auto';
    updateCenterSpacers(box, gap);
  } else {
    removeCenterSpacers(box);
    if (isRight) box.style.margin = '8px 0 8px ' + gap + 'px';
    else box.style.margin = '8px ' + gap + 'px 8px 0';
    box.style.removeProperty('--side-space');
  }
}

function updateCenterSpacers(box, gap) {
  const editorW = editor.clientWidth - (isMobile() ? 30 : 80);
  const imgW = box.offsetWidth || (editorW * 0.5);
  let side = (editorW - imgW) / 2 - gap;
  if (side < 0) side = 0;
  box.style.setProperty('--side-space', side + 'px');

  let sp = box.previousElementSibling;
  if (!sp || !sp.classList || !sp.classList.contains('img-spacer-left')) {
    sp = document.createElement('span');
    sp.className = 'img-spacer-left';
    sp.contentEditable = 'false';
    box.parentNode.insertBefore(sp, box);
  }
  let spR = box.nextElementSibling;
  if (!spR || !spR.classList || !spR.classList.contains('img-spacer-right')) {
    spR = document.createElement('span');
    spR.className = 'img-spacer-right';
    spR.contentEditable = 'false';
    box.parentNode.insertBefore(spR, box.nextSibling);
  }
}

function removeCenterSpacers(box) {
  const prev = box.previousElementSibling;
  if (prev && prev.classList && prev.classList.contains('img-spacer-left')) prev.remove();
  const next = box.nextElementSibling;
  if (next && next.classList && next.classList.contains('img-spacer-right')) next.remove();
}

function setImgGap(v) { 
  if(!currentImgBox) return; 
  currentImgBox.dataset.gap = v; 
  document.getElementById('imgGapLabel').textContent = v; 
  document.getElementById('imgGapRange').value = v; 
  const igl = document.getElementById('impGapLabel'); if (igl) igl.textContent = v;
  const igr = document.getElementById('impGapRange'); if (igr) igr.value = v;
  applyImgStyles(currentImgBox); updateRatio(); clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); 
}

function setImgRadius(v) { 
  if(!currentImgBox) return; 
  currentImgBox.dataset.radius = v; 
  document.getElementById('imgRadiusLabel').textContent = v; 
  document.getElementById('imgRadiusRange').value = v; 
  const irl = document.getElementById('impRadiusLabel'); if (irl) irl.textContent = v;
  const irr = document.getElementById('impRadiusRange'); if (irr) irr.value = v;
  applyImgStyles(currentImgBox); clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); 
}

function setImgBorder(v) { 
  if(!currentImgBox) return; 
  currentImgBox.dataset.border = v; 
  document.getElementById('imgBorderLabel').textContent = v; 
  document.getElementById('imgBorderRange').value = v; 
  const ibl = document.getElementById('impBorderLabel'); if (ibl) ibl.textContent = v;
  const ibr = document.getElementById('impBorderRange'); if (ibr) ibr.value = v;
  applyImgStyles(currentImgBox); clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); 
}

function setImgBorderColor(v) { 
  if(!currentImgBox) return; 
  currentImgBox.dataset.borderColor = v; 
  document.getElementById('imgBorderColor').value = v; 
  const ibc = document.getElementById('impBorderColor'); if (ibc) ibc.value = v;
  applyImgStyles(currentImgBox); clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); 
}

function setImgRot(v) {
  if(!currentImgBox) return;
  currentImgBox.dataset.rot = v;
  const lbl = document.getElementById('imgRotLabel'); if (lbl) lbl.textContent = v;
  const rng = document.getElementById('imgRotRange'); if (rng) rng.value = v;
  const mrng = document.getElementById('miniRotSlider'); if (mrng) mrng.value = v;
  const irng = document.getElementById('impRotRange'); if (irng) irng.value = v;
  const ilbl = document.getElementById('impRotLabel'); if (ilbl) ilbl.textContent = v;
  applyImgStyles(currentImgBox);
  updateRatio(); positionMiniBar();
  clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400);
}

function miniAlign(dir) {
  if (!currentImgBox) return;
  currentImgBox.classList.remove('align-right', 'align-center');
  if (dir === 'right') currentImgBox.classList.add('align-right');
  else if (dir === 'center') currentImgBox.classList.add('align-center');
  applyImgStyles(currentImgBox);
  updateRatio(); positionMiniBar(); saveHistory(); focusEditor();
}

function miniRotate(deg) {
  if (!currentImgBox) return;
  let rot = parseInt(currentImgBox.dataset.rot || '0', 10) + deg;
  while (rot > 180) rot -= 360;
  while (rot < -180) rot += 360;
  setImgRot(rot);
}

function miniToTop() {
  if (!currentImgBox) return;
  const box = currentImgBox;
  removeCenterSpacers(box);
  editor.insertBefore(box, editor.firstChild);
  if (!box.nextSibling || (box.nextSibling.nodeType === Node.TEXT_NODE && box.nextSibling.textContent === '')) {
    const zwsp = document.createTextNode('\u200B');
    editor.insertBefore(zwsp, box.nextSibling);
  }
  ensureAnchorBeforeImages();
  applyImgStyles(box);
  updateRatio(); positionMiniBar(); saveHistory(); focusEditor();
}

function miniToBottom() {
  if (!currentImgBox) return;
  const box = currentImgBox;
  removeCenterSpacers(box);
  editor.appendChild(box);
  const zwsp = document.createTextNode('\u200B');
  editor.appendChild(zwsp);
  ensureAnchorBeforeImages();
  applyImgStyles(box);
  updateRatio(); positionMiniBar(); saveHistory(); focusEditor();
}

function miniDelete() {
  if (!currentImgBox) return;
  try { removeCenterSpacers(currentImgBox); } catch(e) {}
  currentImgBox.remove();
  currentImgBox = null;
  hideMiniBar();
  closeImgMobilePanel();
  updateImgCounter();
  document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
  updateRatio(); saveHistory(); focusEditor();
}

function miniDuplicate() {
  if (!currentImgBox) return;
  if (updateImgCounter() >= 10) { alert('Максимум 10 картинок'); return; }
  const clone = currentImgBox.cloneNode(true);
  clone.classList.remove('selected');
  currentImgBox.parentNode.insertBefore(clone, currentImgBox.nextSibling);
  const zwsp = document.createTextNode('\u200B');
  clone.parentNode.insertBefore(zwsp, clone.nextSibling);
  ensureAnchorBeforeImages();
  rebindImages();
  applyImgStyles(clone);
  selectImgBox(clone);
  updateImgCounter(); updateRatio(); saveHistory(); focusEditor();
}

/* ===== ТЕЛЕФОННАЯ ПЛАВАЮЩАЯ МЕНЮ КАРТИНКИ ===== */
let impPos = null;
let rotUnlocked = false;

function setRotLock(unlocked) {
  rotUnlocked = unlocked;
  const btn = document.getElementById('impRotLock');
  const slider = document.getElementById('impRotRange');
  if (!btn || !slider) return;
  if (unlocked) {
    btn.textContent = '🔓';
    slider.style.opacity = '1';
    slider.style.pointerEvents = 'auto';
  } else {
    btn.textContent = '🔒';
    slider.style.opacity = '0.4';
    slider.style.pointerEvents = 'none';
  }
}

function toggleRotLock() {
  setRotLock(!rotUnlocked);
}

function openImgMobilePanel() {
  const p = document.getElementById('imgMobilePanel');
  if (!p || !currentImgBox) return;
  syncImgMobilePanel();
  setRotLock(false);
  p.classList.add('visible');
  requestAnimationFrame(function(){
    const pw = p.offsetWidth || 270;
    const ph = p.offsetHeight || 300;
    const peek = 40;
    const minL = peek - pw, maxL = window.innerWidth - peek;
    const minT = peek - ph, maxT = window.innerHeight - peek;
    let left, top;
    if (impPos) {
      left = Math.max(minL, Math.min(impPos.left, maxL));
      top  = Math.max(minT, Math.min(impPos.top, maxT));
    } else {
      left = Math.max(0, (window.innerWidth - pw) / 2);
      top  = 80;
    }
    p.style.left = left + 'px';
    p.style.top = top + 'px';
    impPos = { left: left, top: top };
  });
}

function closeImgMobilePanel() {
  const p = document.getElementById('imgMobilePanel');
  if (p) p.classList.remove('visible');
}

function syncImgMobilePanel() {
  if (!currentImgBox) return;
  const gap = parseInt(currentImgBox.dataset.gap || '20', 10);
  const rad = parseInt(currentImgBox.dataset.radius || '12', 10);
  const brd = parseInt(currentImgBox.dataset.border || '0', 10);
  const col = currentImgBox.dataset.borderColor || '#000000';
  const rot = parseInt(currentImgBox.dataset.rot || '0', 10);
  
  const igr = document.getElementById('impGapRange'); if (igr) igr.value = gap;
  const igl = document.getElementById('impGapLabel'); if (igl) igl.textContent = gap;
  const irr = document.getElementById('impRadiusRange'); if (irr) irr.value = rad;
  const irl = document.getElementById('impRadiusLabel'); if (irl) irl.textContent = rad;
  const ibr = document.getElementById('impBorderRange'); if (ibr) ibr.value = brd;
  const ibl = document.getElementById('impBorderLabel'); if (ibl) ibl.textContent = brd;
  const ibc = document.getElementById('impBorderColor'); if (ibc) ibc.value = col;
  const irrRot = document.getElementById('impRotRange'); if (irrRot) irrRot.value = rot;
  const irlRot = document.getElementById('impRotLabel'); if (irlRot) irlRot.textContent = rot;
}

(function(){
  const head = document.getElementById('impHead');
  const panel = document.getElementById('imgMobilePanel');
  if (!head || !panel) return;
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  
  function start(x, y) {
    dragging = true; head.classList.add('grabbing');
    sx = x; sy = y;
    ox = panel.offsetLeft; oy = panel.offsetTop;
  }
  function move(x, y) {
    if (!dragging) return;
    let nl = ox + (x - sx), nt = oy + (y - sy);
    const peek = 40;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const minL = peek - pw;
    const maxL = window.innerWidth - peek;
    const minT = peek - ph;
    const maxT = window.innerHeight - peek;
    nl = Math.max(minL, Math.min(nl, maxL));
    nt = Math.max(minT, Math.min(nt, maxT));
    panel.style.left = nl + 'px';
    panel.style.top = nt + 'px';
    impPos = { left: nl, top: nt };
  }
  function end() { dragging = false; head.classList.remove('grabbing'); }
  
  head.addEventListener('touchstart', e => { const t = e.touches[0]; start(t.clientX, t.clientY); }, {passive:true});
  head.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY); }, {passive:false});
  head.addEventListener('touchend', end);
  head.addEventListener('mousedown', e => start(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  document.addEventListener('mouseup', end);
})();

stageArea.addEventListener('scroll', () => currentImgBox && positionMiniBar());
window.addEventListener('scroll', () => currentImgBox && positionMiniBar());

/* ЭТАП 2: тост-подсказка "плашки только с компьютера" */
let _tbToastTimer = null;
function showTbToast() {
  let t = document.getElementById('tbToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'tbToast';
    t.textContent = '📝 Надписи управляются только с компьютера';
    document.body.appendChild(t);
  }
  t.classList.add('show');
  clearTimeout(_tbToastTimer);
  _tbToastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2200);
}
