function updateLineHeight(val) {
document.getElementById('lineHeightLabel').textContent = val;
editor.style.lineHeight = val;
updateRatio();
clearTimeout(typeTimer);
typeTimer = setTimeout(saveHistory, 400);
}

function applyBase(base) {
baseFontSlider.value = base;
document.getElementById('baseFontSizeLabel').textContent = base;
editor.style.fontSize = base + 'px';
editor.querySelectorAll('*').forEach(el => {
if (!el.getAttribute('data-custom-size') && el.tagName !== 'CODE' && !el.classList.contains('img-box') && !el.classList.contains('img-resizer')) {
el.style.fontSize = '';
}
});
}

function updateBaseFontSize(size) { applyBase(size); updateRatio(); clearTimeout(typeTimer); typeTimer = setTimeout(saveHistory, 400); }

let typeTimer = null;
editor.addEventListener('input', function() {
document.getElementById('charCount').textContent = editor.innerText.replace(/\u200B/g, '').trim().length;
updateImgCounter();
updateRatio();
clearTimeout(typeTimer);
typeTimer = setTimeout(saveHistory, 400);
});

editor.addEventListener('paste', function(e) {
e.preventDefault();
const text = (e.clipboardData || window.clipboardData).getData('text/plain');
document.execCommand('insertText', false, text);
updateRatio();
saveHistory();
});

function clearEditor() {
editor.innerHTML = '';
exportNode.querySelectorAll('.text-box').forEach(b => b.remove());
updateImgCounter();
document.getElementById('charCount').textContent = '0';
updateRatio();
currentImgBox = null;
currentTextBox = null;
saveHistory();
focusEditor();
}

function setPreset(mode, btn) {
document.querySelectorAll('.preset').forEach(function(b) { b.classList.remove('active'); });
btn.classList.add('active');
const widthControl = document.getElementById('widthControl');
exportNode.classList.remove('no-tail');
widthControl.style.display = 'none';
if (mode === 'telegram') {
exportNode.style.width = '800px';
exportNode.classList.add('no-tail');
exportNode.style.borderRadius = '16px';
stageArea.style.backgroundColor = '#748eaa';
} else if (mode === 'custom') {
widthControl.style.display = 'block';
exportNode.classList.add('no-tail');
exportNode.style.borderRadius = '16px';
stageArea.style.backgroundColor = '#2a2f3a';
updateCustomWidth();
}
setTimeout(updateRatio, 100);
}

function updateCustomWidth() {
const w = document.getElementById('width').value;
document.getElementById('wLabel').textContent = w;
exportNode.style.width = w + 'px';
updateRatio();
}

