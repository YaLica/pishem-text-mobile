/* ==========================================================================
   ЭМОДЗИ — перемещаемая панель, никаких скроллбаров
   ========================================================================== */

(function () {
  'use strict';

  var PATH = 'emoji-data.json';
  var RECENT_KEY = 'emojiRecent';
  var RECENT_MAX = 40;
  var STEP = 120;
  var dragState = null;

  var data = null;
  var panel = null;
  var built = false;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  function loadRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function pushRecent(ch) {
    var list = loadRecent().filter(function (x) { return x !== ch; });
    list.unshift(ch);
    list = list.slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function insert(ch) {
    try {
      if (typeof restoreSelection === 'function') restoreSelection();
      if (typeof insertTextAtSelection === 'function') {
        if (insertTextAtSelection(ch)) {
          if (typeof updateRatio === 'function') updateRatio();
          if (typeof saveHistory === 'function') saveHistory();
        }
      }
      var scope = (typeof getEditingScope === 'function') ? getEditingScope() : null;
      if (scope && scope.focus) scope.focus();
    } catch (e) {}
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'emojiPop';
    panel.className = 'emoji-pop';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Эмодзи');

    var head = document.createElement('div');
    head.className = 'emoji-pop-head';
    head.style.cursor = 'move';

    var dragHandle = document.createElement('div');
    dragHandle.className = 'emoji-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = 'Перетащить панель';
    head.appendChild(dragHandle);

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'emoji-search';
    search.placeholder = 'Поиск: кот, огонь…';
    search.autocomplete = 'off';
    head.appendChild(search);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'emoji-close';
    close.textContent = '✕';
    close.title = 'Закрыть (Esc)';
    close.addEventListener('click', hide);
    head.appendChild(close);

    panel.appendChild(head);

    var tabs = document.createElement('div');
    tabs.className = 'emoji-tabs';
    panel.appendChild(tabs);

    var scroll = document.createElement('div');
    scroll.className = 'emoji-scroll';
    panel.appendChild(scroll);

    var grid = document.createElement('div');
    grid.className = 'emoji-grid';
    scroll.appendChild(grid);

    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'emoji-more';
    more.textContent = 'Ещё';
    scroll.appendChild(more);

    var empty = document.createElement('div');
    empty.className = 'emoji-empty';
    empty.textContent = 'Ничего не найдено';
    empty.style.display = 'none';
    scroll.appendChild(empty);

    document.body.appendChild(panel);

    /* ---- перетаскивание ---- */
    var offsetX = 0, offsetY = 0;
    head.addEventListener('mousedown', function (e) {
      if (e.target === close || e.target.closest('input')) return;
      dragState = {
        x: e.clientX - panel.offsetLeft,
        y: e.clientY - panel.offsetTop
      };
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragState) return;
      panel.style.left = (e.clientX - dragState.x) + 'px';
      panel.style.top = (e.clientY - dragState.y) + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', function () {
      dragState = null;
    });

    /* ---- категории ---- */
    var names = Object.keys(data);
    var recentName = '🕘 Недавние';
    var current = loadRecent().length ? recentName : names[0];
    var query = '';
    var shown = STEP;
    var tabBtns = {};

    [recentName].concat(names).forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-tab';
      b.textContent = name.split(' ')[0];
      b.title = name.replace(/^\S+\s/, '');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        current = name;
        query = '';
        search.value = '';
        shown = STEP;
        scroll.scrollTop = 0;
        render();
      });
      tabs.appendChild(b);
      tabBtns[name] = b;
    });

    function list() {
      if (query) {
        var q = query.toLowerCase(), out = [];
        names.forEach(function (n) {
          data[n].forEach(function (it) {
            if (it[1].indexOf(q) !== -1) out.push(it);
          });
        });
        return out;
      }
      if (current === recentName) {
        var by = {};
        names.forEach(function (n) {
          data[n].forEach(function (it) { by[it[0]] = it; });
        });
        return loadRecent().map(function (c) { return by[c] || [c, '']; });
      }
      return data[current] || [];
    }

    function render() {
      Object.keys(tabBtns).forEach(function (n) {
        tabBtns[n].classList.toggle('active', !query && n === current);
      });

      var items = list();
      grid.innerHTML = '';

      if (!items.length) {
        empty.style.display = '';
        empty.textContent = query ? 'Ничего не найдено' : 'Здесь пока пусто';
        more.style.display = 'none';
        return;
      }
      empty.style.display = 'none';

      var frag = document.createDocumentFragment();
      items.slice(0, shown).forEach(function (it) {
        var s = document.createElement('span');
        s.textContent = it[0];
        s.title = it[1].split(' ').slice(0, 2).join(' ') || '';
        s.addEventListener('click', function () {
          insert(it[0]);
          pushRecent(it[0]);
        });
        frag.appendChild(s);
      });
      grid.appendChild(frag);

      var left = items.length - shown;
      more.style.display = left > 0 ? '' : 'none';
      more.textContent = 'Ещё ' + Math.min(STEP, left);
    }

    more.addEventListener('click', function (e) {
      e.preventDefault();
      shown += STEP;
      render();
    });

    var t = null;
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        query = search.value.trim();
        shown = STEP;
        scroll.scrollTop = 0;
        render();
      }, 120);
    });

    panel._render = render;
    render();
    built = true;
  }

  function show() {
    if (!data) return;
    if (!built) buildPanel();
    panel.classList.add('open');
    if (panel._render) panel._render();
    setTimeout(function () {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', onEsc, true);
    }, 0);
  }

  function hide() {
    if (!panel) return;
    panel.classList.remove('open');
    document.removeEventListener('mousedown', outside, true);
    document.removeEventListener('keydown', onEsc, true);
  }

  function outside(e) {
    if (panel.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.emoji-open-btn')) return;
    hide();
  }

  function onEsc(e) {
    if (e.key === 'Escape') hide();
  }

  function toggle(e) {
    if (e) e.preventDefault();
    if (panel && panel.classList.contains('open')) hide();
    else show();
  }

  function placeButton() {
    var wrap = document.getElementById('emojiWrap');
    if (!wrap) return;

    wrap.innerHTML = '';
    wrap.classList.add('emoji-slot');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-open-btn';
    btn.innerHTML = '<span>😀</span> Эмодзи';
    btn.addEventListener('click', toggle);
    wrap.appendChild(btn);

    var qb = document.getElementById('quickBar');
    if (qb && !qb.querySelector('.emoji-open-btn')) {
      var m = document.createElement('button');
      m.type = 'button';
      m.className = 'emoji-open-btn qb-emoji';
      m.textContent = '😀';
      m.title = 'Эмодзи';
      m.addEventListener('mousedown', function (e) { e.preventDefault(); });
      m.addEventListener('click', toggle);
      qb.appendChild(m);
    }
  }

  ready(function () {
    fetch(PATH, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('нет файла');
        return r.json();
      })
      .then(function (json) {
        data = json;
        placeButton();
      })
      .catch(function () { /* остаётся старый набор */ });
  });
})();
