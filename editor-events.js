function handleSpaceFormattingReset() {
const sel = window.getSelection();
if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
const range = sel.getRangeAt(0);
let node = range.startContainer;
let offset = range.startOffset;
let styledParent = getStyledInlineParent(node);

if (styledParent) {
  let isAtEnd = false;
  if (node.nodeType === Node.TEXT_NODE && offset === node.textContent.length) {
    let p = node;
    while (p && p !== styledParent && !p.nextSibling) {
      p = p.parentNode;
    }
    if (p === styledParent || !p.nextSibling) isAtEnd = true;
  }
  
  if (isAtEnd) {
    const spaceNode = document.createTextNode(' ');
    if (styledParent.nextSibling) {
      styledParent.parentNode.insertBefore(spaceNode, styledParent.nextSibling);
    } else {
      styledParent.parentNode.appendChild(spaceNode);
    }
    const newRange = document.createRange();
    newRange.setStartAfter(spaceNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    updateRatio();
    saveHistory();
    return true;
  }
}

}
return false;
}

editor.addEventListener('beforeinput', function(e) {
if (e.data === ' ' || e.inputType === 'insertText' && e.data === ' ') {
if (handleSpaceFormattingReset()) {
e.preventDefault();
}
}
});

editor.addEventListener('keydown', function(e) {
const sel = window.getSelection();

if (e.key === 'Enter') {
e.preventDefault();
document.execCommand('insertLineBreak');
updateRatio();
saveHistory();
return;
}

if (e.key === ' ' || e.code === 'Space') {
if (handleSpaceFormattingReset()) {
e.preventDefault();
return;
}
}

function imgNextTo(direction) {
if (!sel || !sel.rangeCount) return null;
const r = sel.getRangeAt(0);
if (!r.collapsed) return null;
let node = r.startContainer;
let offset = r.startOffset;

if (direction === 'back') {
if (node.nodeType === Node.TEXT_NODE) {
if (offset > 0) return null;
let prev = node.previousSibling;
while (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent === '\u200B') prev = prev.previousSibling;
if (prev && prev.classList && prev.classList.contains('img-box')) return prev;
} else {
let child = node.childNodes[offset - 1];
while (child && child.nodeType === Node.TEXT_NODE && child.textContent === '\u200B') child = child.previousSibling;
if (child && child.classList && child.classList.contains('img-box')) return child;
}
} else {
if (node.nodeType === Node.TEXT_NODE) {
if (offset < node.textContent.length) return null;
let next = node.nextSibling;
while (next && next.nodeType === Node.TEXT_NODE && next.textContent === '\u200B') next = next.nextSibling;
if (next && next.classList && next.classList.contains('img-box')) return next;
} else {
let child = node.childNodes[offset];
while (child && child.nodeType === Node.TEXT_NODE && child.textContent === '\u200B') child = child.nextSibling;
if (child && child.classList && child.classList.contains('img-box')) return child;
}
}
return null;

}

if (e.key === 'Backspace') {
const box = imgNextTo('back');
if (box) { e.preventDefault(); selectImgBox(box); return; }
}
if (e.key === 'Delete') {
const box = imgNextTo('forward');
if (box) { e.preventDefault(); selectImgBox(box); return; }
}

if (currentImgBox && (e.key === 'Delete' || e.key === 'Backspace')) {
e.preventDefault();
deleteSelectedImage();
return;
}

if (currentImgBox && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
const box = currentImgBox;
box.classList.remove('selected');
currentImgBox = null;
const range = document.createRange();
range.setStartAfter(box);
range.collapse(true);
sel.removeAllRanges();
sel.addRange(range);
}

if (e.ctrlKey || e.metaKey) {
if (currentImgBox && e.key === 'c') { e.preventDefault(); window._imgClip = currentImgBox; return; }
if (window._imgClip && e.key === 'v') { e.preventDefault(); const save=currentImgBox; currentImgBox=window._imgClip; miniDuplicate(); currentImgBox=save; return; }
if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoAction(e); }
else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redoAction(e); }
else if (e.key === 'b') { e.preventDefault(); format('bold'); }
else if (e.key === 'i') { e.preventDefault(); format('italic'); }
else if (e.key === 'u') { e.preventDefault(); format('underline'); }
}
});

