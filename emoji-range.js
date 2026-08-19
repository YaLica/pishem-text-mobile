const emojiGroups = {
'😀 Эмоции': ['😊','😂','🤣','🥰','😍','😎','🤩','😉','🙂','😌','🤔','😏','😢','😭','😤','😡','🥺','😱','🤯','😴','🤗','😇','🥳','😜','🤪','🙄','😬','😐'],
'👍 Жесты': ['👍','👎','👏','🙌','🙏','🤝','✌️','🤞','👌','🤙','💪','👋','🫶','☝️','👇','👆','👉','👈','🤟','✊'],
'❤️ Символы': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💯','✨','⭐','🌟','💫','⚡','🔥','💥','🎉','🎊','🎁','🏆','🥇','👑','💎','🔔'],
'💼 Бизнес': ['📌','📍','✅','☑️','❌','⛔','⚠️','❗','❓','💡','📝','✍️','📢','📣','📊','📈','📉','💰','💸','🎯','🔑','🔒','📅','⏰','⏳','🚀','🛒','📦','🔗','💬','👀','🧠','📖'],
'➡️ Стрелки': ['➡️','⬅️','⬆️','⬇️','↗️','↘️','🔄','▶️','🔽','🔼','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'],
'🌿 Разное': ['🌿','🌸','🌹','🌻','🌈','☀️','🌙','❄️','🍀','☕','🍰','🥂','⚽','🎵','📷','🎬','✈️','🚗','🏠','🌍']
};
const emojiWrap = document.getElementById('emojiWrap');
Object.keys(emojiGroups).forEach(function(groupName) {
  const title = document.createElement('div');
  title.className = 'emoji-section-title';
  title.textContent = groupName;
  emojiWrap.appendChild(title);
  const bar = document.createElement('div');
  bar.className = 'emoji-bar';
  emojiGroups[groupName].forEach(function(emoji) {
    const span = document.createElement('span');
    span.textContent = emoji;
    span.onclick = function() {
      restoreSelection();
      if (insertTextAtSelection(emoji)) {
        updateRatio();
        saveHistory();
      }
      const scope = getEditingScope();
      if (scope && scope.focus) scope.focus();
    };
    bar.appendChild(span);
  });
  emojiWrap.appendChild(bar);
});
