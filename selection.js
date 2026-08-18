function saveSelectionBeforeAction() {
const sel = window.getSelection();
if (sel && sel.rangeCount > 0) {
  const anchor = sel.anchorNode;
  const inEditor = editor.contains(anchor);
  const inBox = currentTextBox && currentTextBox.contains(anchor);
  if (inEditor || inBox) {
    const range = sel.getRangeAt(0);
    savedSelection = range.cloneRange();
  }
}
}

document.addEventListener('selectionchange', saveSelectionBeforeAction);

function freezeSelectionForFont() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const anchor = sel.anchorNode;
    const inEditor = editor.contains(anchor);
    const inBox = currentTextBox && currentTextBox.contains(anchor);
    if ((inEditor || inBox) && !sel.isCollapsed && sel.toString().trim().length > 0) {
      savedSelectionForFont = sel.getRangeAt(0).cloneRange();
    } else {
      savedSelectionForFont = null;
    }
  } else {
    savedSelectionForFont = null;
  }
}

editor.addEventListener('keyup', saveSelectionBeforeAction);
editor.addEventListener('mouseup', saveSelectionBeforeAction);
editor.addEventListener('touchend', saveSelectionBeforeAction);

function restoreSelection() {
if (currentTextBox && exportNode.contains(currentTextBox)) {
  currentTextBox.focus();
  if (savedSelection && currentTextBox.contains(savedSelection.commonAncestorContainer)) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }
} else {
  editor.focus();
  if (savedSelection && editor.contains(savedSelection.commonAncestorContainer)) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelection);
  }
}
}

function getStyledInlineParent(node) {
let curr = (node.nodeType === Node.TEXT_NODE) ? node.parentNode : node;
while (curr && curr !== editor && (!currentTextBox || curr !== currentTextBox)) {
const tag = curr.tagName;
if (tag === 'SPAN' || tag === 'FONT' || tag === 'B' || tag === 'STRONG' ||
tag === 'I' || tag === 'EM' || tag === 'U' || tag === 'S' || tag === 'STRIKE' || tag === 'CODE') {
return curr;
}
curr = curr.parentNode;
}
return null;
}

function exitSelectionFromFormatting() {
const sel = window.getSelection();
if (!sel || !sel.rangeCount) return;
const range = sel.getRangeAt(0);
let endNode = range.endContainer;
let styledParent = getStyledInlineParent(endNode);

if (styledParent) {
let next = styledParent.nextSibling;
if (!next || next.nodeType !== Node.TEXT_NODE) {
const zwsp = document.createTextNode('\u200B');
styledParent.parentNode.insertBefore(zwsp, styledParent.nextSibling);
next = zwsp;
}
const newRange = document.createRange();
newRange.setStartAfter(next);
newRange.collapse(true);
sel.removeAllRanges();
sel.addRange(newRange);
}
}

