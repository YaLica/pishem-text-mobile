/* Один независимый черновик на вкладку; восстановление последней работы на устройстве.
   Здесь нет запросов к API и нет хранения паролей/сессий. */
(function () {
  'use strict';
  var dbPromise, timer, ready = false, restoring = false, changedEarly = false;
  var lastData = null, queue = Promise.resolve();
  var tabId;
  try { tabId = sessionStorage.getItem('textturaDraftTab'); } catch (_) {}
  if (!tabId) {
    tabId = 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    try { sessionStorage.setItem('textturaDraftTab', tabId); } catch (_) {}
  }
  // Scope prevents test versions under other paths sharing drafts.
  var dbName = 'texttura-drafts:' + new URL('./', location.href).pathname;
  var restoreId = tabId, instance = Math.random().toString(36), duplicate = false;
  var channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(dbName) : null;
  if (channel) channel.onmessage = function(e) {
    var m = e.data || {};
    if (m.type === 'probe' && m.id === tabId && m.instance !== instance)
      channel.postMessage({type:'alive', target:m.instance});
    if (m.type === 'alive' && m.target === instance) duplicate = true;
  };
  async function claimTab() {
    if (channel) {
      channel.postMessage({type:'probe', id:tabId, instance:instance});
      await new Promise(function(resolve) { setTimeout(resolve, 80); });
    }
    // A duplicated browser tab may inherit sessionStorage; do not share its draft key.
    if (duplicate || !channel) {
      tabId = 'draft-' + Date.now() + '-' + instance;
      try { sessionStorage.setItem('textturaDraftTab', tabId); } catch (_) {}
    }
  }
  function storageError() {
    document.dispatchEvent(new CustomEvent('texttura:app-error', {detail:'Не удалось сохранить черновик на устройстве. Сохраните пост в «Мои посты» перед закрытием.'}));
  }
  function openDB() {
    if (!dbPromise) dbPromise = new Promise(function(resolve, reject) {
      var request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = function() { request.result.createObjectStore('drafts', {keyPath:'id'}); };
      request.onsuccess = function() { resolve(request.result); };
      request.onerror = function() { reject(request.error); };
      request.onblocked = function() { reject(new Error('Хранилище занято')); };
    });
    return dbPromise;
  }
  function getDrafts(db) {
    return new Promise(function(resolve, reject) {
      var request = db.transaction('drafts').objectStore('drafts').getAll();
      request.onsuccess = function() { resolve(request.result); };
      request.onerror = function() { reject(request.error); };
    });
  }
  function putDraft(db, record) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put(record);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = tx.onabort = function() { reject(tx.error || new Error('Ошибка записи')); };
    });
  }
  function valid(data) {
    try {
      var s = JSON.parse(data);
      return !!s && typeof s.html === 'string' && Array.isArray(s.textBoxes)
        && typeof s.fontSize === 'string' && typeof s.lineHeight === 'string'
        && typeof s.fontFamily === 'string';
    } catch (_) { return false; }
  }
  function flush() {
    clearTimeout(timer);
    if (!ready || restoring) return queue;
    if (TextturaDocument.isBusy()) return Promise.reject(new Error('Дождитесь завершения загрузки или сохранения.'));
    var data = TextturaDocument.capture();
    if (data === lastData) return queue;
    // Serialize writes so a delayed old transaction cannot overwrite newer typing.
    queue = queue.catch(function() {}).then(async function() {
      var db = await openDB();
      await putDraft(db, {id:tabId, updatedAt:Date.now(), data:data});
      lastData = data;
    });
    return queue;
  }
  function schedule() {
    if (restoring) return;
    if (!ready) { changedEarly = true; return; }
    clearTimeout(timer);
    timer = setTimeout(function() {
      if (TextturaDocument.isBusy()) { schedule(); return; }
      flush().catch(storageError);
    }, 450);
  }
  async function init() {
    // Observe content, including imported pictures, plates, background, and undo.
    var observer = new MutationObserver(function() { if (ready && !restoring) schedule(); });
    observer.observe(exportNode, {subtree:true,childList:true,characterData:true,attributes:true});
    document.addEventListener('pointerdown', function() { if (!ready) changedEarly = true; }, true);
    document.addEventListener('input', function(e) { if (!e.target.closest('#accountDialog')) schedule(); });
    document.addEventListener('texttura:work-loaded', schedule);
    document.addEventListener('texttura:new-post', function() {
      changedEarly = true;
      if (ready) { if (TextturaDocument.isBusy()) schedule(); else flush().catch(storageError); }
    });
    try {
      await claimTab();
      var db = await openDB();
      var records = await getDrafts(db);
      var record = records.find(function(d) { return d.id === restoreId; });
      if (!record) record = records.sort(function(a,b) { return b.updatedAt - a.updatedAt; })[0];
      if (record && !changedEarly) {
        if (!valid(record.data)) throw new Error('Повреждён черновик');
        restoring = true;
        TextturaDocument.restoreDraft(record.data);
        restoring = false;
        // A restored draft in a new tab gets its own copy, never overwrites the other tab.
        await putDraft(db, {id:tabId, updatedAt:Date.now(), data:TextturaDocument.capture()});
        lastData = TextturaDocument.capture();
      } else if (!changedEarly) lastData = TextturaDocument.capture();
    } catch (_) { restoring = false; storageError(); }
    ready = true;
    if (changedEarly) schedule();
  }
  window.TextturaDraft = {flush:flush, isReady:function() { return ready; }};
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && ready && !TextturaDocument.isBusy()) flush().catch(storageError);
  });
  window.addEventListener('pagehide', function() {
    if (ready && !TextturaDocument.isBusy()) flush().catch(function() {});
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
