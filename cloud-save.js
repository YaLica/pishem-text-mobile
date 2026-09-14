/* ==========================================================================
   cloud-save.js — аккаунт и облачное сохранение постов.

   Отдельный изолированный блок, как ratio-fix.js: ничего из существующих
   файлов не переписывает, только добавляет новый UI-блок в начало панели
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
  var API_BASE = 'https://yalica-pishem-text-backend-3459.twc1.net';

  var currentUser = null;
  var currentWorkId = null;

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

  var box, loggedOutView, loggedInView, userLabel, worksList, statusLine;

  function buildUI() {
    box = document.createElement('div');
    box.id = 'cloudBlock';
    box.style.cssText = 'background:#2a2f3a50;padding:12px;border-radius:8px;margin-bottom:15px;';

    var title = document.createElement('label');
    title.style.cssText = 'color:#60a5fa;margin-top:0;';
    title.textContent = '☁️ Облако';
    box.appendChild(title);

    statusLine = document.createElement('div');
    statusLine.style.cssText = 'font-size:11px;color:#f87171;min-height:14px;margin:4px 0;';
    box.appendChild(statusLine);

    /* ---- форма входа/регистрации ---- */
    loggedOutView = document.createElement('div');

    var emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'cloudEmail';
    emailInput.placeholder = 'Email';
    emailInput.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;padding:8px;border-radius:6px;border:1px solid #3a4150;background:#1b1f27;color:#e8e8e8;';

    var passInput = document.createElement('input');
    passInput.type = 'password';
    passInput.id = 'cloudPassword';
    passInput.placeholder = 'Пароль (минимум 8 символов)';
    passInput.style.cssText = emailInput.style.cssText;

    var rowBtns = document.createElement('div');
    rowBtns.style.cssText = 'display:flex;gap:8px;margin-top:4px;';

    var btnLogin = document.createElement('button');
    btnLogin.type = 'button';
    btnLogin.className = 'primary';
    btnLogin.style.cssText = 'flex:1;margin-top:0;padding:8px;font-size:13px;';
    btnLogin.textContent = 'Войти';
    btnLogin.addEventListener('click', function () { doAuth('/api/auth/login'); });

    var btnRegister = document.createElement('button');
    btnRegister.type = 'button';
    btnRegister.style.cssText = 'flex:1;padding:8px;font-size:13px;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;border-radius:8px;cursor:pointer;';
    btnRegister.textContent = 'Регистрация';
    btnRegister.addEventListener('click', function () { doAuth('/api/auth/register'); });

    rowBtns.appendChild(btnLogin);
    rowBtns.appendChild(btnRegister);
    loggedOutView.appendChild(emailInput);
    loggedOutView.appendChild(passInput);
    loggedOutView.appendChild(rowBtns);
    box.appendChild(loggedOutView);

    /* ---- вид для вошедшего пользователя ---- */
    loggedInView = document.createElement('div');
    loggedInView.style.display = 'none';

    userLabel = document.createElement('div');
    userLabel.style.cssText = 'font-size:12px;color:#9aa4b2;margin-bottom:8px;';
    loggedInView.appendChild(userLabel);

    var rowSave = document.createElement('div');
    rowSave.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

    var btnSaveNew = document.createElement('button');
    btnSaveNew.type = 'button';
    btnSaveNew.className = 'primary';
    btnSaveNew.style.cssText = 'flex:1;margin-top:0;padding:8px;font-size:12px;';
    btnSaveNew.textContent = '💾 Сохранить как новый';
    btnSaveNew.addEventListener('click', function () { saveWork(false); });

    var btnUpdate = document.createElement('button');
    btnUpdate.type = 'button';
    btnUpdate.id = 'cloudUpdateBtn';
    btnUpdate.style.cssText = 'flex:1;padding:8px;font-size:12px;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;border-radius:8px;cursor:pointer;display:none;';
    btnUpdate.textContent = '🔄 Обновить открытый';
    btnUpdate.addEventListener('click', function () { saveWork(true); });

    rowSave.appendChild(btnSaveNew);
    rowSave.appendChild(btnUpdate);
    loggedInView.appendChild(rowSave);

    var btnList = document.createElement('button');
    btnList.type = 'button';
    btnList.style.cssText = 'width:100%;padding:8px;font-size:12px;background:#2a2f3a;color:#e8e8e8;border:1px solid #3a4150;border-radius:8px;cursor:pointer;margin-bottom:8px;';
    btnList.textContent = '📂 Мои посты';
    btnList.addEventListener('click', function () {
      var visible = worksList.style.display !== 'none';
      worksList.style.display = visible ? 'none' : 'block';
      if (!visible) loadWorksList();
    });
    loggedInView.appendChild(btnList);

    worksList = document.createElement('div');
    worksList.style.cssText = 'display:none;max-height:200px;overflow:auto;margin-bottom:8px;';
    loggedInView.appendChild(worksList);

    var btnLogout = document.createElement('button');
    btnLogout.type = 'button';
    btnLogout.className = 'danger';
    btnLogout.style.cssText = 'width:100%;padding:8px;font-size:12px;';
    btnLogout.textContent = 'Выйти';
    btnLogout.addEventListener('click', logout);
    loggedInView.appendChild(btnLogout);

    box.appendChild(loggedInView);

    var panel = document.querySelector('.panel');
    if (panel) panel.insertBefore(box, panel.firstChild);
  }

  function showStatus(text, isError) {
    statusLine.textContent = text || '';
    statusLine.style.color = isError ? '#f87171' : '#4ade80';
    if (text) setTimeout(function () { if (statusLine.textContent === text) statusLine.textContent = ''; }, 4000);
  }

  function renderAuthState() {
    if (currentUser) {
      loggedOutView.style.display = 'none';
      loggedInView.style.display = 'block';
      userLabel.textContent = 'Вошли как: ' + currentUser.email;
      var updBtn = document.getElementById('cloudUpdateBtn');
      if (updBtn) updBtn.style.display = currentWorkId ? 'block' : 'none';
    } else {
      loggedOutView.style.display = 'block';
      loggedInView.style.display = 'none';
    }
  }

  function refreshAuthUI() {
    api('/api/auth/me').then(function (data) {
      currentUser = data.user || null;
      renderAuthState();
    }).catch(function () {
      currentUser = null;
      renderAuthState();
    });
  }

  function doAuth(path) {
    var email = document.getElementById('cloudEmail').value.trim();
    var password = document.getElementById('cloudPassword').value;
    if (!email || !password) { showStatus('Заполни email и пароль', true); return; }
    api(path, { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
      .then(function (data) {
        currentUser = data.user;
        renderAuthState();
        showStatus('Готово');
      })
      .catch(function (err) { showStatus(err.message, true); });
  }

  function logout() {
    api('/api/auth/logout', { method: 'POST' }).finally(function () {
      currentUser = null;
      currentWorkId = null;
      renderAuthState();
    });
  }

  function saveWork(update) {
    var data = captureSnapshot();
    var title = prompt('Название поста:', 'Пост от ' + new Date().toLocaleDateString());
    if (title === null) return;

    var path = update && currentWorkId ? ('/api/works/' + currentWorkId) : '/api/works';
    var method = update && currentWorkId ? 'PUT' : 'POST';

    api(path, { method: method, body: JSON.stringify({ title: title, data: data }) })
      .then(function (res) {
        currentWorkId = res.id;
        renderAuthState();
        showStatus('Сохранено: ' + res.title);
      })
      .catch(function (err) { showStatus(err.message, true); });
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
    api('/api/works/' + id).then(function (data) {
      restoreSnapshot(data.work.data);
      currentWorkId = id;
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
