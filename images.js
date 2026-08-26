function updateImgCounter() {
const count = editor.querySelectorAll('.img-box').length;
document.getElementById('imgCount').textContent = count;
return count;
}

async function insertMultipleImages(event) {
const files = event.target.files;
if (!files || files.length === 0) return;

let currentCount = updateImgCounter();
const maxImages = 20;

if (currentCount >= maxImages) {
event.target.value = '';
return;
}

restoreSelection();
const sel = window.getSelection();
let range = null;
if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
range = sel.getRangeAt(0);
}

let added = 0;

for (let i = 0; i < files.length; i++) {
if (currentCount + added >= maxImages) break;

const file = files[i];
const dataUrl = await new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.readAsDataURL(file);
});

const box = createImageBox(dataUrl);
box.querySelector('img').onload = updateRatio;

if (range) {
  range.insertNode(box);
  snapImageToLineStart(box);
  const zwspAfter = document.createTextNode('\u200B');
  box.parentNode.insertBefore(zwspAfter, box.nextSibling);
  ensureAnchorBeforeImages();
  
  range.setStartAfter(zwspAfter);
  range.collapse(true);
} else {
  editor.appendChild(box);
  snapImageToLineStart(box);
  const zwspAfter = document.createTextNode('\u200B');
  editor.appendChild(zwspAfter);
  ensureAnchorBeforeImages();
}
added++;

}

if (range && sel) {
sel.removeAllRanges();
sel.addRange(range);
}

updateImgCounter();
updateRatio();
saveHistory();

event.target.value = '';
setTimeout(() => focusEditor(), 50);
}

function safeInsertBox(range, box) {
  let container = range.commonAncestorContainer;
  let imgBox = null;
  if (container.nodeType === Node.TEXT_NODE) {
    imgBox = container.parentNode.closest('.img-box');
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    imgBox = container.closest('.img-box');
  }
  if (imgBox && imgBox !== box) {
    const nextNode = imgBox.nextSibling;
    if (nextNode) {
      imgBox.parentNode.insertBefore(box, nextNode);
    } else {
      imgBox.parentNode.appendChild(box);
    }
  } else {
    range.insertNode(box);
  }
}

function createImageBox(url) {
const box = document.createElement('span');
box.className = 'img-box';
box.contentEditable = 'false';
box.setAttribute('draggable', 'true');
const img = document.createElement('img');
img.src = url;
const resizer = document.createElement('span');
resizer.className = 'img-resizer';
resizer.contentEditable = 'false';
box.appendChild(img);
box.appendChild(resizer);
ensureRotor(box);
box.addEventListener('click', function(e) { e.stopPropagation(); selectImgBox(box); });
bindResizer(box);
return box;
}

function bindResizer(box) {
const resizer = box.querySelector('.img-resizer');
if (!resizer) return;
const newResizer = resizer.cloneNode(true);
resizer.parentNode.replaceChild(newResizer, resizer);

function startResize(e) {
e.preventDefault();
e.stopPropagation();
box.setAttribute('draggable', 'false');
let startX = e.clientX || e.touches[0].clientX;
let startW = box.offsetWidth;
let parentW = editor.offsetWidth - (isMobile() ? 30 : 80);

function doDrag(ev) {
let currentX = ev.clientX || (ev.touches && ev.touches[0].clientX);
let newW = startW + (currentX - startX);
let percent = (newW / parentW) * 100;
if (percent < 15) percent = 15;
if (percent > 100) percent = 100;
box.style.width = percent + '%';
applyImgStyles(box);
}

function stopDrag() {
document.removeEventListener('mousemove', doDrag);
document.removeEventListener('mouseup', stopDrag);
document.removeEventListener('touchmove', doDrag);
document.removeEventListener('touchend', stopDrag);
box.setAttribute('draggable', 'true');
saveHistory();
}
document.addEventListener('mousemove', doDrag);
document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchmove', doDrag, {passive: false});
document.addEventListener('touchend', stopDrag);
}

newResizer.addEventListener('mousedown', startResize);
newResizer.addEventListener('touchstart', startResize, {passive: false});
}

let mobileImgPanelSessionFirst = true;
let lastImgTapTime = 0;
let lastImgTapBox = null;

function selectImgBox(box) {
if (isMobile()) { editor.blur(); if (document.activeElement) document.activeElement.blur(); }
editor.querySelectorAll('.img-box').forEach(function(b) { b.classList.remove('selected'); });
box.classList.add('selected');
currentImgBox = box;
ensureRotor(box);
applyImgStyles(box);
positionMiniBar(); syncImgSettings();

if (isMobile()) {
  const now = Date.now();
  if (mobileImgPanelSessionFirst) {
    mobileImgPanelSessionFirst = false;
    openImgMobilePanel();
  } else {
    if (lastImgTapBox === box && (now - lastImgTapTime) < 400) {
      openImgMobilePanel();
    }
  }
  lastImgTapTime = now;
  lastImgTapBox = box;
}
}

function deleteSelectedImage() {
if (!currentImgBox) return;
removeCenterSpacers(currentImgBox);
currentImgBox.remove();
currentImgBox = null;
closeImgMobilePanel();
updateImgCounter();
document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
updateRatio();
saveHistory();
focusEditor();
}

document.addEventListener('click', function(e) {
if (e.target.closest('#btnDeleteImg')) return;
if (e.target.closest('#imgSettings')) return;
if (e.target.closest('#imgMobilePanel')) return;
if (!e.target.closest('.img-box') && !e.target.closest('#imgMiniBar')) {
editor.querySelectorAll('.img-box').forEach(function(b) { b.classList.remove('selected'); });
currentImgBox = null;
hideMiniBar();
closeImgMobilePanel();
}
if (!e.target.closest('.text-box') && !e.target.closest('.toolbar') && !e.target.closest('#quickBar') && !e.target.closest('#imgMiniBar') && !e.target.closest('#tbSettings')) {
document.querySelectorAll('.text-box').forEach(function(b) { b.classList.remove('selected'); });
currentTextBox = null;
const tbPanel = document.getElementById('tbSettings');
if (tbPanel) tbPanel.style.display = 'none';
}
});

let dragBox = null;
let isTouchDraggingImg = false;
let imgGhost = null;

editor.addEventListener('dragstart', function(e) { const box = e.target.closest('.img-box'); if (box) dragBox = box; });
editor.addEventListener('dragover', function(e) { if (dragBox) e.preventDefault(); });
editor.addEventListener('drop', function(e) {
if (!dragBox) return;
e.preventDefault();
let range;
if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(e.clientX, e.clientY);
else if (document.caretPositionFromPoint) {
const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
range = document.createRange();
range.setStart(pos.offsetNode, pos.offset);
}
if (range && editor.contains(range.startContainer)) {
removeCenterSpacers(dragBox);
dragBox.remove();
const editorRect = editor.getBoundingClientRect();
const dropX = e.clientX - editorRect.left;
dragBox.classList.remove('align-right', 'align-center');
if (dropX > editorRect.width / 2) dragBox.classList.add('align-right');
safeInsertBox(range, dragBox);
snapImageToLineStart(dragBox);
const zwsp = document.createTextNode('\u200B');
dragBox.parentNode.insertBefore(zwsp, dragBox.nextSibling);
ensureAnchorBeforeImages();
applyImgStyles(dragBox);
}
dragBox = null;
updateRatio();
saveHistory();
});
editor.addEventListener('dragend', function() { dragBox = null; });

editor.addEventListener('touchstart', function(e) {
const box = e.target.closest('.img-box');
if (box && !e.target.closest('.img-resizer')) {
dragBox = box;
}
}, {passive: true});

editor.addEventListener('touchmove', function(e) {
if (dragBox && !isTouchDraggingImg) {
isTouchDraggingImg = true;
imgGhost = dragBox.cloneNode(true);
imgGhost.style.position = 'fixed';
imgGhost.style.opacity = '0.75';
imgGhost.style.pointerEvents = 'none';
imgGhost.style.zIndex = '99999';
imgGhost.style.width = '90px';
imgGhost.style.maxWidth = '90px';
imgGhost.style.margin = '0';
imgGhost.style.borderRadius = '10px';
imgGhost.style.boxShadow = '0 4px 14px rgba(0,0,0,.5)';
const gImg = imgGhost.querySelector('img');
if (gImg) { gImg.style.width = '90px'; gImg.style.height = 'auto'; }
const gRes = imgGhost.querySelector('.img-resizer'); if (gRes) gRes.remove();
document.body.appendChild(imgGhost);
}
if (isTouchDraggingImg) {
e.preventDefault();
const touch = e.touches[0];
imgGhost.style.left = (touch.clientX - 45) + 'px';
imgGhost.style.top = (touch.clientY - 45) + 'px';
}
}, {passive: false});

editor.addEventListener('touchend', function(e) {
if (isTouchDraggingImg && dragBox && imgGhost) {
e.preventDefault();
const touch = e.changedTouches[0];
let range = null;
if (document.caretRangeFromPoint) {
range = document.caretRangeFromPoint(touch.clientX, touch.clientY);
} else if (document.caretPositionFromPoint) {
const pos = document.caretPositionFromPoint(touch.clientX, touch.clientY);
if (pos) {
range = document.createRange();
range.setStart(pos.offsetNode, pos.offset);
}
}
if (range && editor.contains(range.startContainer)) {
removeCenterSpacers(dragBox);
dragBox.remove();
const editorRect = editor.getBoundingClientRect();
const dropX = touch.clientX - editorRect.left;
dragBox.classList.remove('align-right', 'align-center');
if (dropX > editorRect.width / 2) dragBox.classList.add('align-right');
safeInsertBox(range, dragBox);
snapImageToLineStart(dragBox);
const zwsp = document.createTextNode('\u200B');
dragBox.parentNode.insertBefore(zwsp, dragBox.nextSibling);
ensureAnchorBeforeImages();
applyImgStyles(dragBox);
}
imgGhost.remove();
imgGhost = null;
isTouchDraggingImg = false;
dragBox = null;
updateRatio();
saveHistory();
} else {
dragBox = null;
}
});

