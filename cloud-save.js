/* ==========================================================================
   cloud-save.js — аккаунт и облачное сохранение постов.

   Отдельный изолированный блок, как ratio-fix.js: ничего из существующих
   файлов не переписывает, добавляет окно входа и действия в «Готовый результат»
   и общается с backend API (pishem-text-backend на Timeweb) через fetch.

   Что делает:
     • регистрация / вход / выход, отображение текущего пользователя;
     • «Сохранить как новый пост» и «Обновить» (если пост уже загружен);
     • список сохранённых постов с открытием и удалением.

   ВАЖНО про восстановление поста: простая замена innerHTML сбрасывает все
   навешенные обработчики (перетаскивание картинок, ресайз, поворот и т.д.),
   поэтому после вставки сохранённого HTML код заново вызывает те же функции
   инициализации, что использует остальной редактор (ensureRotor, bindResizer,
   bindTextBox, applyImgStyles, applyTbBg). Все вызовы защищены проверкой
   typeof — если какой-то функции не окажется под этим именем, блок молча
   пропустит этот шаг, а не сломает всё остальное.
   ========================================================================== */

(function () {
  'use strict';

  // Домен backend-а. Если переедет (например, на api.silver-x.ru) — поменять
  // только эту строку.
  var API_BASE = 'https://api.silver-x.ru';

  var currentUser = null;
  var currentWorkId = null;
  var currentWorkTitle = null;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  /* ------------------------- обёртка над fetch ------------------------- */

  function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(API_BASE + path, Object.assign({ credentials: 'include' }, options, { headers: headers }))
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error(data.error || ('Ошибка сервера (' + r.status + ')'));
          return data;
        });
      });
  }

  /* --------------------------- захват состояния ---------------------------
     Формат снимка сделан НАМЕРЕННО таким же, как снимок в history.js
     (saveHistory/applySnapshot): { html, textBoxes, fontSize, lineHeight,
     fontFamily }. Это не совпадение — так можно переиспользовать готовую,
     уже проверенную функцию applySnapshot() для восстановления вместо
     собственной реализации через exportNode.innerHTML, которая ломала
     ссылку на #editor (см. пояснение у restoreSnapshot).
     Сверх этого формата добавлены только 3 поля, которых сама история не
     помнит: платформа/ширина холста и цвет фона — Undo/Redo их тоже не
     восстанавливает, это не только наше ограничение. */

  function captureSnapshot() {
    var textBoxesData = Array.prototype.map.call(exportNode.querySelectorAll('.text-box'), function (b) {
      var contentEl = b.querySelector('.tb-content');
      return {
        html: contentEl ? contentEl.innerHTML : '',
        left: b.style.left,
        top: b.style.top,
        width: b.style.width || '',
        height: (contentEl && contentEl.style.height) ? contentEl.style.height : '',
        bgColor: b.dataset.bgColor || '#000000',
        bgOpacity: (b.dataset.bgOpacity !== undefined) ? b.dataset.bgOpacity : '55',
        lineHeight: b.dataset.lineHeight || '1.25',
        fontSize: b.dataset.fontSize || '',
        fontFamily: b.dataset.fontFamily || '',
        mode: b.dataset.mode || 'plate',
        ribbonColor: b.dataset.ribbonColor || '#000000',
        ribbonOpacity: (b.dataset.ribbonOpacity !== undefined) ? b.dataset.ribbonOpacity : '85',
        ribbonRadius: b.dataset.ribbonRadius || '6',
        ribbonPadH: b.dataset.ribbonPadH || '0.3',
        ribbonPadV: b.dataset.ribbonPadV || '0.25',
        rot: b.dataset.rot || '0'
      };
    });

    var activeBtn = document.querySelector('.preset.active');
    var presetKey = 'telegram';
    if (activeBtn) {
      var m = (activeBtn.getAttribute('onclick') || '').match(/setPreset\('([^']+)'/);
      if (m) presetKey = m[1];
    }

    var snap = {
      html: editor.innerHTML,
      textBoxes: textBoxesData,
      fontSize: baseFontSlider.value,
      lineHeight: lineHeightSlider.value,
      fontFamily: fontFamilySelector.value,
      presetKey: presetKey,
      customWidth: document.getElementById('width') ? document.getElementById('width').value : '',
      bgColor: document.getElementById('bgColorPicker') ? document.getElementById('bgColorPicker').value : ''
    };
    return JSON.stringify(snap);
  }

  /* ------------------------- восстановление состояния -------------------------
     ПОЧЕМУ ЗДЕСЬ БЫЛ БАГ (для памяти, если решишь что-то менять дальше):
     раньше здесь стояло `exportNode.innerHTML = ...`. Это уничтожало и
     пересоздавало сам узел #editor из HTML-строки, а глобальная переменная
     `const editor = document.getElementById('editor')` из core.js
     продолжала указывать на старый, уже удалённый узел. Пост появлялся на
     экране, но был полностью «мёртвым» — ни один обработчик событий на
     новый узел не смотрел.

     Теперь используется applySnapshot() из history.js — та же функция,
     что стоит за Undo/Redo. Она меняет editor.innerHTML (содержимое
     существующего узла, не сам узел) и пересоздаёт .text-box через
     createElement + bindTextBox(), а не через сырой HTML. Это гарантированно
     рабочий путь, потому что именно так работает Undo/Redo прямо сейчас. */

  function restoreSnapshot(json) {
    var snap;
    try { snap = JSON.parse(json); } catch (e) {
      alert('Не удалось прочитать сохранённый пост — файл повреждён.');
      return;
    }

    if (typeof applySnapshot !== 'function') {
      alert('Не найдена функция applySnapshot (обычно живёт в history.js). Обнови страницу и попробуй снова.');
      return;
    }

    // То, что Undo/Redo не помнит: платформа/ширина холста, цвет фона.
    if (snap.presetKey && typeof setPreset === 'function') {
      var btn = document.querySelector('.preset[onclick*="' + snap.presetKey + '"]');
      setPreset(snap.presetKey, btn || undefined);
    }
    if (snap.presetKey === 'custom' && snap.customWidth) {
      var wEl = document.getElementById('width');
      if (wEl) { wEl.value = snap.customWidth; if (typeof updateCustomWidth === 'function') updateCustomWidth(); }
    }
    if (snap.bgColor) {
      var cEl = document.getElementById('bgColorPicker');
      if (cEl) { cEl.value = snap.bgColor; if (typeof updateBgColor === 'function') updateBgColor(snap.bgColor); }
    }

    // Дальше — тем же путём, что обычный Undo/Redo.
    applySnapshot(snap);
    if (typeof restoreAfterHistoryChange === 'function') restoreAfterHistoryChange();
    if (typeof updateRatio === 'function') updateRatio();
    if (typeof saveHistory === 'function') saveHistory();
  }

  /* ------------------------------- UI ------------------------------- */

  var userLabel, worksList, statusLine, authStatus, accountToggle, authDialog;
  var btnSaveNew, btnUpdate, btnList, authSubmit, loginTab, registerTab;
  var authMode = 'login', authBusy = false, authChecking = true, pendingAction = null;

  function openAuth(action) {
    pendingAction = action || null;
    authStatus.textContent = '';
    if (!authDialog.open) authDialog.showModal();
    document.getElementById('cloudEmail').focus();
  }

  function requireAuth(action) {
    if (authChecking) { showStatus('Проверяем вход…'); return; }
    if (!currentUser) { openAuth(action); return; }
    action();
  }

  function setAuthMode(mode) {
    authMode = mode;
    var register = mode === 'register';
    document.getElementById('accountTitle').textContent = register ? 'Регистрация' : 'Вход в Тексttуру';
    authSubmit.textContent = register ? 'Зарегистрироваться' : 'Войти';
    loginTab.setAttribute('aria-pressed', String(!register));
    registerTab.setAttribute('aria-pressed', String(register));
    var password = document.getElementById('cloudPassword');
    password.autocomplete = register ? 'new-password' : 'current-password';
    password.minLength = register ? 8 : 1;
    password.placeholder = register ? 'Минимум 8 символов' : 'Пароль';
    authStatus.textContent = '';
  }

  function buildUI() {
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('account-ui.css?v=20261001-1', document.baseURI).href;
    document.head.appendChild(style);

    accountToggle = document.createElement('button');
    accountToggle.id = 'accountToggle';
    accountToggle.type = 'button';
    accountToggle.textContent = 'Войти';
    accountToggle.disabled = true;
    accountToggle.addEventListener('click', function () {
      if (currentUser) logout(); else openAuth();
    });
    document.body.appendChild(accountToggle);

    authDialog = document.createElement('dialog');
    authDialog.id = 'accountDialog';
    authDialog.setAttribute('aria-labelledby', 'accountTitle');
    authDialog.innerHTML = '<button type="button" class="account-close" aria-label="Закрыть">×</button>' +
      '<h2 id="accountTitle">Вход в Тексttуру</h2>' +
      '<div class="account-tabs"><button type="button" id="accountLoginTab" aria-pressed="true">Вход</button><button type="button" id="accountRegisterTab" aria-pressed="false">Регистрация</button></div>' +
      '<form id="accountForm"><label for="cloudEmail">Email</label><input id="cloudEmail" type="email" autocomplete="username" required>' +
      '<label for="cloudPassword">Пароль</label><input id="cloudPassword" type="password" autocomplete="current-password" required minlength="1" placeholder="Пароль">' +
      '<button type="submit" class="account-submit">Войти</button></form>' +
      '<p class="account-status" role="status" aria-live="polite"></p>';
    document.body.appendChild(authDialog);
    authStatus = authDialog.querySelector('.account-status');
    authSubmit = authDialog.querySelector('.account-submit');
    loginTab = document.getElementById('accountLoginTab');
    registerTab = document.getElementById('accountRegisterTab');
    loginTab.addEventListener('click', function () { setAuthMode('login'); });
    registerTab.addEventListener('click', function () { setAuthMode('register'); });
    authDialog.querySelector('.account-close').addEventListener('click', function () { authDialog.close(); });
    authDialog.addEventListener('click', function (e) {
      var r = authDialog.getBoundingClientRect();
      if (e.target === authDialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) authDialog.close();
    });
    authDialog.addEventListener('close', function () {
      pendingAction = null;
      document.getElementById('cloudPassword').value = '';
    });
    document.getElementById('accountForm').addEventListener('submit', function (e) {
      e.preventDefault();
      doAuth(authMode === 'register' ? '/api/auth/register' : '/api/auth/login');
    });

    var result = document.getElementById('readyResult');
    if (!result) return;
    userLabel = document.createElement('div');
    userLabel.className = 'account-user';
    userLabel.hidden = true;
    statusLine = document.createElement('div');
    statusLine.className = 'account-status';
    statusLine.setAttribute('role', 'status');
    statusLine.setAttribute('aria-live', 'polite');

    var rowSave = document.createElement('div');
    rowSave.className = 'account-save-row';
    btnSaveNew = document.createElement('button');
    btnSaveNew.id = 'cloudSaveNewBtn';
    btnSaveNew.type = 'button';
    btnSaveNew.className = 'primary';
    btnSaveNew.textContent = '💾 Сохранить как новый';
    btnSaveNew.addEventListener('click', function () { requireAuth(function () { saveWork(false); }); });
    btnUpdate = document.createElement('button');
    btnUpdate.id = 'cloudUpdateBtn';
    btnUpdate.type = 'button';
    btnUpdate.textContent = '🔄 Обновить открытый';
    btnUpdate.disabled = true;
    btnUpdate.addEventListener('click', function () { requireAuth(function () { saveWork(true); }); });
    rowSave.appendChild(btnSaveNew);
    rowSave.appendChild(btnUpdate);
    var exportBtn = document.getElementById('exportBtn');
    result.insertBefore(userLabel, exportBtn);
    result.insertBefore(rowSave, exportBtn);
    result.insertBefore(statusLine, exportBtn);

    btnList = document.createElement('button');
    btnList.type = 'button';
    btnList.id = 'cloudListBtn';
    btnList.textContent = '📂 Мои посты';
    btnList.setAttribute('aria-expanded', 'false');
    btnList.setAttribute('aria-controls', 'cloudWorksList');
    btnList.addEventListener('click', function () {
      requireAuth(function () {
        var visible = worksList.style.display !== 'none';
        worksList.style.display = visible ? 'none' : 'block';
        btnList.setAttribute('aria-expanded', String(!visible));
        if (!visible) loadWorksList();
      });
    });
    result.appendChild(btnList);
    worksList = document.createElement('div');
    worksList.id = 'cloudWorksList';
    worksList.style.display = 'none';
    result.appendChild(worksList);
  }

  function showStatus(text, isError) {
    var target = authDialog && authDialog.open ? authStatus : statusLine;
    if (!target) return;
    target.textContent = text || '';
    target.style.color = isError ? '#f87171' : '#90b48f';
  }

  function renderAuthState() {
    accountToggle.textContent = currentUser ? 'Выйти' : 'Войти';
    accountToggle.disabled = authChecking;
    accountToggle.title = currentUser ? currentUser.email : 'Вход или регистрация';
    if (!userLabel) return;
    userLabel.hidden = !currentUser;
    userLabel.textContent = currentUser ? currentUser.email : '';
    btnSaveNew.disabled = authChecking;
    btnList.disabled = authChecking;
    btnUpdate.disabled = !currentUser || !currentWorkId;
    btnUpdate.title = currentWorkId ? 'Сохранить изменения в открытом посте' : 'Сначала откройте или сохраните пост';
    if (!currentUser) {
      worksList.style.display = 'none';
      worksList.textContent = '';
      btnList.setAttribute('aria-expanded', 'false');
    }
  }

  function refreshAuthUI() {
    api('/api/auth/me').then(function (data) {
      currentUser = data.user || null;
    }).catch(function () {
      currentUser = null;
    }).finally(function () {
      authChecking = false;
      renderAuthState();
    });
  }

  function doAuth(path) {
    if (authBusy) return;
    var email = document.getElementById('cloudEmail').value.trim();
    var password = document.getElementById('cloudPassword').value;
    if (!email || !password) { showStatus('Заполните email и пароль', true); return; }
    authBusy = true;
    authSubmit.disabled = loginTab.disabled = registerTab.disabled = true;
    showStatus('Подождите…');
    api(path, { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
      .then(function (data) {
        currentUser = data.user;
        var action = authDialog.open ? pendingAction : null;
        pendingAction = null;
        authDialog.close();
        document.getElementById('cloudPassword').value = '';
        renderAuthState();
        showStatus('Вход выполнен');
        if (action) action();
      })
      .catch(function (err) { showStatus(err.message, true); })
      .finally(function () {
        authBusy = false;
        authSubmit.disabled = loginTab.disabled = registerTab.disabled = false;
      });
  }

  function logout() {
    accountToggle.disabled = true;
    api('/api/auth/logout', { method: 'POST' }).then(function () {
      currentUser = null;
      currentWorkId = null;
      currentWorkTitle = null;
      renderAuthState();
      showStatus('Вы вышли из аккаунта');
    }).catch(function (err) {
      showStatus('Не удалось выйти: ' + err.message, true);
    }).finally(function () { accountToggle.disabled = false; });
  }


  /* Автонумерация: "14.09.2026-1", "14.09.2026-2" и т.д. — считаем, сколько
     постов с сегодняшней датой в названии уже есть, и предлагаем следующий
     номер. Если пользователь ничего не поменяет в окошке — так и сохранится
     с этим именем; если впишет своё — сохранится своё. */
  function nextAutoTitle() {
    var dateStr = new Date().toLocaleDateString('ru-RU');
    return api('/api/works').then(function (data) {
      var works = data.works || [];
      var count = works.filter(function (w) {
        return (w.title || '').indexOf(dateStr) === 0;
      }).length;
      return dateStr + '-' + (count + 1);
    }).catch(function () {
      return dateStr + '-1';
    });
  }

  function saveWork(update) {
    var data = captureSnapshot();

    function proceed(defaultTitle) {
      var title = prompt('Название поста:', defaultTitle);
      if (title === null) return;

      var path = update && currentWorkId ? ('/api/works/' + currentWorkId) : '/api/works';
      var method = update && currentWorkId ? 'PUT' : 'POST';

      api(path, { method: method, body: JSON.stringify({ title: title, data: data }) })
        .then(function (res) {
          currentWorkId = res.id;
          currentWorkTitle = res.title;
          renderAuthState();
          showStatus('Сохранено: ' + res.title);
        })
        .catch(function (err) { showStatus(err.message, true); });
    }

    if (update && currentWorkId) {
      // Обновление существующего поста — по умолчанию оставляем его же имя.
      proceed(currentWorkTitle || ('Пост №' + currentWorkId));
    } else {
      // Новый пост — предлагаем автоматическое "Дата-номер".
      nextAutoTitle().then(proceed);
    }
  }

  function loadWorksList() {
    worksList.innerHTML = '<div style="font-size:11px;color:#9aa4b2;">Загрузка…</div>';
    api('/api/works').then(function (data) {
      var works = data.works || [];
      if (!works.length) {
        worksList.innerHTML = '<div style="font-size:11px;color:#9aa4b2;">Пока пусто</div>';
        return;
      }
      worksList.innerHTML = '';
      works.forEach(function (w) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px;border-bottom:1px solid #3a415050;';

        var name = document.createElement('div');
        name.style.cssText = 'flex:1;font-size:12px;color:#e8e8e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        name.textContent = w.title;
        name.title = w.title;

        var openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.textContent = '📂';
        openBtn.title = 'Открыть';
        openBtn.style.cssText = 'padding:4px 8px;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;border-radius:6px;cursor:pointer;';
        openBtn.addEventListener('click', function () { openWork(w.id); });

        var delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = '🗑';
        delBtn.title = 'Удалить';
        delBtn.style.cssText = openBtn.style.cssText;
        delBtn.addEventListener('click', function () { deleteWork(w.id); });

        row.appendChild(name);
        row.appendChild(openBtn);
        row.appendChild(delBtn);
        worksList.appendChild(row);
      });
    }).catch(function (err) { showStatus(err.message, true); });
  }

  function openWork(id) {
    if (!confirm('Открыть этот пост? Текущий несохранённый холст будет заменён.')) return;
    showStatus('Загружаю…');
    api('/api/works/' + id).then(function (data) {
      restoreSnapshot(data.work.data);
      currentWorkId = id;
      currentWorkTitle = data.work.title;
      renderAuthState();
      showStatus('Пост загружен');
    }).catch(function (err) { showStatus(err.message, true); });
  }

  function deleteWork(id) {
    if (!confirm('Удалить этот пост без возможности восстановить?')) return;
    api('/api/works/' + id, { method: 'DELETE' }).then(function () {
      if (currentWorkId === id) currentWorkId = null;
      renderAuthState();
      loadWorksList();
    }).catch(function (err) { showStatus(err.message, true); });
  }

  ready(function () {
    if (typeof exportNode === 'undefined') return;
    buildUI();
    refreshAuthUI();
  });
})();
