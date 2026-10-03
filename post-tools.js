/* Фон — свойство холста, а не перемещаемая картинка поверх текста. */
(function () {
  'use strict';
  var background = '';
  var button = document.getElementById('myBackgroundBtn');
  var menu = document.getElementById('myBackgroundMenu');
  var input = document.getElementById('myBackgroundFile');

  window.getPostBackground = function () { return background; };
  window.setPostBackground = function (data) {
    // Сохранённый пост не может подставить произвольный внешний URL/CSS.
    background = typeof data === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(data) ? data : '';
    exportNode.style.backgroundImage = background ? 'url("' + background.replace(/\s/g, '') + '")' : '';
    exportNode.style.backgroundSize = background ? 'cover' : '';
    exportNode.style.backgroundPosition = background ? 'center' : '';
    exportNode.style.backgroundRepeat = background ? 'no-repeat' : '';
    button.textContent = background ? 'Мой фон · изменить / удалить' : 'Мой фон';
    button.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  };
  button.addEventListener('click', function () {
    if (!background) { input.click(); return; }
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.getElementById('replaceBackgroundBtn').addEventListener('click', function () { input.click(); });
  document.getElementById('removeBackgroundBtn').addEventListener('click', function () {
    saveHistory();
    setPostBackground('');
    saveHistory();
  });
  input.addEventListener('change', async function () {
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (imageImportBusy) { imageImportNotice('Дождитесь добавления картинок.'); return; }
    imageImportBusy = true;
    button.disabled = true;
    imageImportNotice('Обрабатываю картинку для фона…');
    try {
      var data = await preparePostImage(file);
      saveHistory();
      setPostBackground(data);
      saveHistory();
      clearImageImportProgress();
    } catch (error) {
      imageImportNotice('Не удалось загрузить фон. ' + error.message);
    } finally {
      imageImportBusy = false;
      button.disabled = false;
    }
  });
  // Цвета входят в историю вместе с фоном; размер поста наблюдает style холста.
  ['bgColorPicker', 'mainTextColorPicker'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', scheduleHistorySave);
  });
  ['quoteBtn', 'exitQuoteBtn'].forEach(function(id) {
  document.getElementById(id).addEventListener('pointerdown', function(e) {
    saveSelectionBeforeAction();
    // На телефоне и компьютере кнопка не забирает курсор из абзаца.
    e.preventDefault();
  });
  });
})();
