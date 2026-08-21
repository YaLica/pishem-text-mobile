/* ==========================================================================
   ЭМОДЗИ — большой набор с поиском

   Раньше в панели было 146 эмодзи, вшитых прямо в emoji-range.js.
   Теперь их 1914, они лежат отдельным файлом emoji-data.json,
   и к ним добавлен поиск по русским словам.

   Вставка работает ровно как раньше — через ту же функцию редактора,
   так что курсор, история и плашки ведут себя без изменений.
   Если файл с эмодзи почему-то не загрузится, останется прежний
   набор — панель не опустеет.
   ========================================================================== */

(function () {
  'use strict';

  var PATH = 'emoji-data.json';
  var RECENT_KEY = 'emojiRecent';
  var RECENT_MAX = 32;
  var PAGE = 120;           // сколько показываем сразу, остальное по кнопке

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
    return list;
  }

  // вставка через штатную функцию редактора — поведение не меняется
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

  ready(function () {
    var wrap = document.getElementById('emojiWrap');
    if (!wrap) return;

    fetch(PATH, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('нет файла');
        return r.json();
      })
      .then(function (groups) { build(wrap, groups); })
      .catch(function () { /* оставляем прежний набор */ });
  });

  function build(wrap, groups) {
    wrap.innerHTML = '';
    wrap.classList.add('emoji-pro');

    var names = Object.keys(groups);
    var current = names[0];
    var query = '';
    var shown = PAGE;

    /* ---- поиск ---- */
    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'emoji-search';
    search.placeholder = 'Поиск: сердце, кот, дождь…';
    search.autocomplete = 'off';
    wrap.appendChild(search);

    /* ---- вкладки категорий ---- */
    var tabs = document.createElement('div');
    tabs.className = 'emoji-tabs';
    wrap.appendChild(tabs);

    var recentName = '🕘 Недавние';
    var tabNames = [recentName].concat(names);

    var tabBtns = {};
    tabNames.forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'emoji-tab';
      b.textContent = name.split(' ')[0];   // только значок, чтобы влезло
      b.title = name.replace(/^\S+\s/, '');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        current = name;
        query = '';
        search.value = '';
        shown = PAGE;
        render();
      });
      tabs.appendChild(b);
      tabBtns[name] = b;
    });

    /* ---- сетка ---- */
    var grid = document.createElement('div');
    grid.className = 'emoji-bar emoji-grid';
    wrap.appendChild(grid);

    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'emoji-more';
    more.textContent = 'Показать ещё';
    more.addEventListener('click', function (e) {
      e.preventDefault();
      shown += PAGE * 2;
      render();
    });
    wrap.appendChild(more);

    var empty = document.createElement('div');
    empty.className = 'emoji-empty';
    empty.textContent = 'Ничего не нашлось';
    empty.style.display = 'none';
    wrap.appendChild(empty);

    function currentList() {
      if (query) {
        var q = query.toLowerCase();
        var out = [];
        names.forEach(function (n) {
          groups[n].forEach(function (item) {
            if (item[1].indexOf(q) !== -1) out.push(item);
          });
        });
        return out;
      }
      if (current === recentName) {
        var rec = loadRecent();
        var byChar = {};
        names.forEach(function (n) {
          groups[n].forEach(function (item) { byChar[item[0]] = item; });
        });
        return rec.map(function (c) { return byChar[c] || [c, '']; });
      }
      return groups[current] || [];
    }

    function render() {
      Object.keys(tabBtns).forEach(function (n) {
        tabBtns[n].classList.toggle('active', !query && n === current);
      });

      var list = currentList();
      grid.innerHTML = '';

      if (!list.length) {
        empty.style.display = '';
        empty.textContent = query ? 'Ничего не нашлось' : 'Здесь пока пусто';
        more.style.display = 'none';
        return;
      }
      empty.style.display = 'none';

      var slice = list.slice(0, shown);
      var frag = document.createDocumentFragment();
      slice.forEach(function (item) {
        var span = document.createElement('span');
        span.textContent = item[0];
        span.title = item[1].split(' ')[0] || '';
        span.addEventListener('click', function () {
          insert(item[0]);
          pushRecent(item[0]);
        });
        frag.appendChild(span);
      });
      grid.appendChild(frag);

      more.style.display = (list.length > shown) ? '' : 'none';
      more.textContent = 'Показать ещё ' + Math.min(PAGE * 2, list.length - shown);
    }

    var timer = null;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        query = search.value.trim();
        shown = PAGE;
        render();
      }, 120);
    });

    // если недавних нет, открываем первую настоящую категорию
    current = loadRecent().length ? recentName : names[0];
    render();
  }
})();
