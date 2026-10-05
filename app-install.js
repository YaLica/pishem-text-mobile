/* Установка без автоматических всплывающих окон и обновление только по кнопке. */
(function () {
  'use strict';
  var installPrompt = null, registration = null, applyingUpdate = false;
  var controls, installButton, updateButton, errorLine, help, previousFocus;
  var mode = window.matchMedia('(display-mode: standalone)');
  function mobileInstallation() {
    return /Android|iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function installed() { return mode.matches || window.navigator.standalone === true; }
  function showError(message) {
    if (!errorLine) return;
    errorLine.textContent = message;
    errorLine.hidden = !message;
    refresh();
  }
  function refresh() {
    if (!controls) return;
    installButton.hidden = !mobileInstallation() || installed();
    updateButton.hidden = !(registration && registration.waiting && navigator.serviceWorker.controller);
    controls.hidden = installButton.hidden && updateButton.hidden && errorLine.hidden;
  }
  function closeHelp() {
    help.hidden = true;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  function helpInstall() {
    if (!mobileInstallation()) return;
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var android = /Android/.test(navigator.userAgent);
    var steps = ios
      ? ['Если страница открыта внутри мессенджера (с крестиком сверху), нажмите значок компаса или выберите «Открыть в Safari» в меню. Если такого пункта нет, скопируйте адрес ниже и откройте его в Safari.', 'В Safari нажмите «Поделиться» → «На экран „Домой“». Если пункта нет, посмотрите «Изменить действия».', 'Нажмите «Добавить». Если есть переключатель «Открывать как веб-приложение», включите его. Затем запускайте Тексttуру с нового значка.']
      : android
      ? ['Откройте меню браузера.', 'Выберите «Установить приложение» или «Добавить на главный экран» и подтвердите установку.', 'Если этого пункта нет, попробуйте открыть сайт в Chrome.']
      : [];
    var text = document.getElementById('installHelpSteps');
    text.textContent = '';
    steps.forEach(function(step, index) { var p = document.createElement('p'); p.textContent = (index + 1) + '. ' + step; text.appendChild(p); });
    if (ios) {
      const address = document.createElement('input');
      address.className = 'install-address'; address.type = 'text'; address.readOnly = true;
      address.setAttribute('aria-label', 'Адрес редактора для Safari');
      address.value = new URL('./', location.href).href;
      address.addEventListener('click', function () { address.select(); });
      text.appendChild(address);
    }
    previousFocus = document.activeElement;
    if (previousFocus && previousFocus.blur) previousFocus.blur();
    if (window.TextturaViewport) window.TextturaViewport.update();
    help.hidden = false;
    document.getElementById('closeInstallHelp').focus();
  }
  async function install() {
    if (!mobileInstallation()) return;
    if (!installPrompt) { helpInstall(); return; }
    var prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      var choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installButton.hidden = true;
    } catch (_) { helpInstall(); }
  }
  async function update() {
    if (!registration || !registration.waiting || applyingUpdate) return;
    if (TextturaDocument.isBusy()) { showError('Дождитесь завершения загрузки или сохранения поста.'); return; }
    if (!TextturaDraft.isReady()) { showError('Черновик ещё загружается. Попробуйте обновить чуть позже.'); return; }
    updateButton.disabled = true;
    applyingUpdate = true;
    document.documentElement.classList.add('app-updating');
    try {
      await TextturaDraft.flush();
      applyingUpdate = true;
      // Reload only this tab. Other tabs keep their unsaved editor state.
      registration.waiting.postMessage({type:'TEXTTURA_APPLY_UPDATE'});
    } catch (_) {
      showError('Не удалось сохранить черновик. Сохраните пост в «Мои посты» перед обновлением.');
      applyingUpdate = false;
      document.documentElement.classList.remove('app-updating');
      updateButton.disabled = false;
    }
  }
  function buildUI() {
    controls = document.createElement('div'); controls.id = 'appControls';
    installButton = document.createElement('button'); installButton.id = 'installAppBtn';
    installButton.type = 'button'; installButton.textContent = 'Установить «Тексttура»';
    installButton.addEventListener('click', install); controls.appendChild(installButton);
    updateButton = document.createElement('button'); updateButton.id = 'updateAppBtn';
    updateButton.type = 'button'; updateButton.textContent = 'Обновить приложение'; updateButton.hidden = true;
    updateButton.addEventListener('click', update); controls.appendChild(updateButton);
    errorLine = document.createElement('div'); errorLine.id = 'appError'; errorLine.className = 'app-error';
    errorLine.setAttribute('role','status'); errorLine.hidden = true; controls.appendChild(errorLine);
    document.querySelector('.panel').appendChild(controls);
    help = document.createElement('div'); help.id = 'installHelp'; help.hidden = true;
    help.innerHTML = '<section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="installHelpTitle"><img src="icon-192.png" alt="" width="80" height="80"><h2 id="installHelpTitle">Тексttура</h2><div id="installHelpSteps"></div><button id="closeInstallHelp" type="button">Понятно</button></section>';
    document.body.appendChild(help);
    document.getElementById('closeInstallHelp').addEventListener('click', closeHelp);
    help.addEventListener('click', function(e) { if (e.target === help) closeHelp(); });
    help.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeHelp(); }
      if (e.key === 'Tab') {
        var focusable = help.querySelectorAll('input, button');
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    refresh();
  }
  // While the user-requested update saves its snapshot, prevent a last keystroke
  // or undo from slipping in between the save and reload.
  ['pointerdown','keydown','beforeinput'].forEach(function(type) {
    document.addEventListener(type, function(e) {
      if (applyingUpdate) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  });
  window.addEventListener('beforeinstallprompt', function(e) { e.preventDefault(); installPrompt = mobileInstallation() ? e : null; refresh(); });
  window.addEventListener('appinstalled', function() { installPrompt = null; if (installButton) installButton.hidden = true; });
  if (mode.addEventListener) mode.addEventListener('change', refresh);
  document.addEventListener('texttura:app-error', function(e) { showError(e.detail); });
  async function init() {
    buildUI();
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (applyingUpdate) location.reload();
    });
    try {
      registration = await navigator.serviceWorker.register('./sw.js', {scope:'./', updateViaCache:'none'});
      refresh();
      registration.addEventListener('updatefound', function() {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function() { refresh(); });
      });
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden && navigator.onLine) registration.update().catch(function() {});
      });
    } catch (_) {
      // The online editor remains usable if installation/cache is unavailable.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
