const emojiGroups = {
'😀 Эмоции': ['😊','😂','🤣','🥰','😍','😎','🤩','😉','🙂','😌','🤔','😏','😢','😭','😤','😡','🥺','😱','🤯','😴','🤗','😇','🥳','😜','🤪','🙄','😬','😐'],
'👍 Жесты': ['👍','👎','👏','🙌','🙏','🤝','✌️','🤞','👌','🤙','💪','👋','🫶','☝️','👇','👆','👉','👈','🤟','✊'],
'❤️ Символы': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💯','✨','⭐','🌟','💫','⚡','🔥','💥','🎉','🎊','🎁','🏆','🥇','👑','💎','🔔'],
'💼 Бизнес': ['📌','📍','✅','☑️','❌','⛔','⚠️','❗','❓','💡','📝','✍️','📢','📣','📊','📈','📉','💰','💸','🎯','🔑','🔒','📅','⏰','⏳','🚀','🛒','📦','🔗','💬','👀','🧠','📖'],
'➡️ Стрелки': ['➡️','⬅️','⬆️','⬇️','↗️','↘️','🔄','▶️','🔽','🔼','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'],
'🌿 Разное': ['🌿','🌸','🌹','🌻','🌈','☀️','🌙','❄️','🍀','☕','🍰','🥂','⚽','🎵','📷','🎬','✈️','🚗','🏠','🌍']
};
const emojiWrap = document.getElementById('emojiWrap');
Object.keys(emojiGroups).forEach(function(g) {
const t = document.createElement('div'); t.className = 'emoji-section-title'; t.textContent = g; emojiWrap.appendChild(t);
const bar = document.createElement('div'); bar.className = 'emoji-bar';
emojiGroups[g].forEach(function(e) {
const span = document.createElement('span'); span.textContent = e;
span.onclick = function() { restoreSelection(); document.execCommand('insertText', false, e); updateRatio(); saveHistory(); if (!currentTextBox) focusEditor(); else currentTextBox.focus(); };
bar.appendChild(span);
});
emojiWrap.appendChild(bar);
});

