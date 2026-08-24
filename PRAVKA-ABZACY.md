# ПРАВКА: абзацное выравнивание + картинка не ломает верхний текст

Файл для правки: **`size-align.js`**
Правок: **3**. Одна замена + два блока в конец файла.

---

## ЧТО ЗА БАГ

В браузере проверено, что происходит при набоpе:

```
набрала ONE         →  <div data-para="1">ONE</div>
нажала Enter        →  <div data-para="1">ONE<br><br></div>
набрала TWO         →  <div data-para="1">ONE<br>TWO</div>
```

Два абзаца лежат **внутри одного** `<div data-para>`, разделённые `<br>`.
Функция `needsNormalize()` смотрит только прямых детей редактора и такой
`<br>` не видит → перестройка не запускается → кнопка выравнивания
красит весь блок целиком.

По той же причине картинка попадает внутрь абзаца с текстом и наследует
его выравнивание — отсюда «слетает верхний текст».

---

## ПРАВКА 1 — заменить функцию `needsNormalize`

Файл `size-align.js`, **строки 73–86**.

### НАЙТИ (весь этот кусок):

```javascript
  function needsNormalize() {
    if (!editor) return false;
    var kids = editor.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3 && (n.textContent || '').trim()) return true;
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') return true;
        if (isSkippable(n)) continue;
        if (n.tagName !== 'DIV' && n.tagName !== 'P') return true;
      }
    }
    return false;
  }
```

### ЗАМЕНИТЬ НА:

```javascript
  function needsNormalize() {
    if (!editor) return false;
    var kids = editor.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3 && (n.textContent || '').trim()) return true;
      if (n.nodeType === 1) {
        if (n.tagName === 'BR') return true;
        if (isSkippable(n)) continue;
        if (n.tagName !== 'DIV' && n.tagName !== 'P') return true;
        // Enter кладёт <br> ВНУТРЬ готового абзаца — это тоже надо разбирать
        for (var j = 0; j < n.childNodes.length; j++) {
          var c = n.childNodes[j];
          if (c.nodeType === 1 && c.tagName === 'BR') return true;
        }
      }
    }
    return false;
  }
```

**Что изменилось:** добавлен внутренний цикл `for (var j = ...)` — 5 строк
перед закрывающей `}` блока `if (n.nodeType === 1)`.

---

## ПРАВКА 2 — разбор `<br>` внутри абзацев

Файл `size-align.js`. Найти начало функции `normalizeParagraphs`:

### НАЙТИ:

```javascript
  function normalizeParagraphs() {
    if (!editor || !editorHasContent()) return;

    var kids = Array.prototype.slice.call(editor.childNodes);
    var run = [];
```

### ЗАМЕНИТЬ НА:

```javascript
  function normalizeParagraphs() {
    if (!editor || !editorHasContent()) return;

    // Сначала разбираем абзацы, внутрь которых Enter положил <br>.
    // Каждая строка становится своим блоком и наследует выравнивание.
    Array.prototype.slice.call(editor.querySelectorAll('[data-para]')).forEach(function (para) {
      var direct = Array.prototype.slice.call(para.childNodes);
      var hasBr = direct.some(function (n) {
        return n.nodeType === 1 && n.tagName === 'BR';
      });
      if (!hasBr) return;

      var parts = [[]];
      direct.forEach(function (node) {
        if (node.nodeType === 1 && node.tagName === 'BR') parts.push([]);
        else parts[parts.length - 1].push(node);
      });

      var ref = para;
      parts.forEach(function (nodes, index) {
        var div;
        if (index === 0) {
          div = para;
          while (div.firstChild) div.removeChild(div.firstChild);
        } else {
          div = document.createElement('div');
          div.setAttribute('data-para', '1');
          div.style.textAlign = para.style.textAlign || '';
          div.style.textAlignLast = para.style.textAlignLast || '';
          ref.parentNode.insertBefore(div, ref.nextSibling);
          ref = div;
        }
        nodes.forEach(function (node) { div.appendChild(node); });
        if (!div.childNodes.length) div.appendChild(document.createElement('br'));
      });
    });

    var kids = Array.prototype.slice.call(editor.childNodes);
    var run = [];
```

**Что изменилось:** между `if (!editor || ...) return;` и `var kids = ...`
вставлен блок разбора `<br>` внутри абзацев. Остальное тело функции
не трогается.

---

## ПРАВКА 3 — в САМЫЙ КОНЕЦ файла

Файл `size-align.js`. В конце файла есть такие строки:

### НАЙТИ (это последние строки файла):

```javascript
    normalizeParagraphs();
    updateAlignButtons();
  });
})();
```

### ЗАМЕНИТЬ НА:

```javascript
    normalizeParagraphs();
    updateAlignButtons();
  });

  /* ======================================================================
     АВТОРАЗБИВКА НА АБЗАЦЫ
     Раньше перестройка запускалась только в момент нажатия кнопки
     выравнивания — а к этому времени курсор уже мог слететь на кнопку.
     Теперь строки становятся абзацами сразу при вводе, поэтому кнопке
     некуда промахнуться.
     ====================================================================== */
  var normTimer = null;

  function scheduleNormalize() {
    clearTimeout(normTimer);
    // ждём, пока браузер закончит менять contenteditable
    normTimer = setTimeout(function () {
      if (needsNormalize()) normalizeKeepingCaret();
    }, 0);
  }

  ready(function () {
    if (typeof editor === 'undefined' || !editor) return;
    editor.addEventListener('input', scheduleNormalize);
    editor.addEventListener('focus', scheduleNormalize);

    /* ====================================================================
       КАРТИНКА НЕ ЛЕЗЕТ В АБЗАЦ
       Картинка вставлялась внутрь того абзаца, где стоял курсор, и
       наследовала его выравнивание — из-за этого верхний текст съезжал.
       Теперь после вставки она выносится отдельным блоком.
       ==================================================================== */
    if (typeof window.insertMultipleImages !== 'function') return;
    var originalInsert = window.insertMultipleImages;

    window.insertMultipleImages = function () {
      var result = originalInsert.apply(this, arguments);

      setTimeout(function () {
        Array.prototype.slice.call(editor.querySelectorAll('.img-box')).forEach(function (box) {
          var para = box.closest ? box.closest('[data-para]') : null;
          if (!para || para.parentNode !== editor) return;
          // картинка сидит внутри абзаца — выносим её сразу после него
          editor.insertBefore(box, para.nextSibling);
        });
        normalizeParagraphs();
        if (typeof updateRatio === 'function') updateRatio();
      }, 150);

      return result;
    };
  });

})();
```

**Что изменилось:** после закрывающей `});` первого блока `ready` добавлены
два новых блока, и только потом идёт финальная `})();`.

---

## ПОСЛЕ ЗАЛИВКИ

1. Залить `size-align.js` на GitHub
2. Подождать 2–3 минуты (Pages пересобирается)
3. Открыть сайт, **Ctrl+F5** (телефон — инкогнито)
4. Набрать три строки через Enter
5. Поставить курсор в среднюю, нажать выравнивание по центру

**Должно быть:** уехала только средняя строка.

**Проверка картинки:** выровнять верхний текст по центру → вставить
картинку → набрать текст ниже. Верхний текст должен остаться на месте.

---

## ЕСЛИ НЕ ЗАРАБОТАЕТ

F12 → Console → повторить действие → прислать красные строки.

---

## ЧТО НЕ ТРОГАЕТСЯ

- `export.js` — остаётся твоя утренняя версия
- `format-range.js` — не трогается
- `images.js` — не трогается, перехват идёт снаружи
- плашки, подложка, копирование в TG — не трогаются
