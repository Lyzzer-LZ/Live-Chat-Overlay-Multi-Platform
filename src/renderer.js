const $ = selector => document.querySelector(selector);
let total = 0;
let startedAt = 0;
let timer;
let activeSources = [];
let lastTopKey = '';
let stickFeed = true;   // true = feed ikut turun ke pesan terbaru
let unread = 0;         // pesan baru yang masuk saat feed sedang di-scroll ke atas

// Batas riwayat ditentukan "Mode memori" (lihat MEMORY_PRESETS). Nilai awal = Normal memory.
let feedLimit = 50;
let lastTopData = null;   // data Top viewers terakhir, untuk render ulang saat pengaturan foto berubah

const format = value => new Intl.NumberFormat('id-ID', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value || 0);
const platformName = { tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch' };

function avatar(data, url = data.avatar) {
  return url
    ? Object.assign(document.createElement('img'), { className: 'avatar', src: url, alt: '' })
    : Object.assign(document.createElement('div'), { className: 'avatar', textContent: (data.nickname || data.username || '?')[0].toUpperCase() });
}

// Isi kotak avatar bulat (join / top viewers). Kalau foto gagal dimuat, jatuh ke huruf awal.
function fillAvatar(box, nickname, url) {
  const letter = (Array.from(nickname || '?')[0] || '?').toUpperCase();
  box.replaceChildren();
  if (!url) { box.textContent = letter; return; }
  const image = document.createElement('img');
  image.alt = ''; image.src = url;
  image.addEventListener('error', () => { box.replaceChildren(); box.textContent = letter; }, { once: true });
  box.append(image);
}

function badge(platform) {
  const element = document.createElement('span');
  element.className = `platform-badge ${platform}`;
  element.textContent = platformName[platform] || platform;
  return element;
}

const atBottom = (element, tolerance) => element.scrollHeight - element.scrollTop - element.clientHeight <= tolerance;

// Daftar tinggi tetap yang bisa di-scroll (riwayat bergabung & gift sematan). Item terbaru di bawah,
// otomatis ikut turun kecuali pengguna sedang membaca riwayat. Jumlah item dibatasi agar memori stabil.
function createStickyList(list, latestButton, initialLimit) {
  let stick = true;
  let limit = initialLimit;
  list.addEventListener('scroll', () => {
    stick = atBottom(list, 4);
    latestButton.hidden = stick;   // tombol "↓" muncul selama tidak di posisi terbaru
  }, { passive: true });
  latestButton.addEventListener('click', () => { list.scrollTop = list.scrollHeight; });
  return {
    push(row) {
      list.append(row);
      while (list.children.length > limit) list.firstElementChild.remove();
      if (stick) list.scrollTop = list.scrollHeight;
    },
    keepBottom() { if (stick) list.scrollTop = list.scrollHeight; },
    setLimit(value) {
      limit = value;
      while (list.children.length > limit) list.firstElementChild.remove();
      if (stick) list.scrollTop = list.scrollHeight;
    }
  };
}

function updateNewButton() {
  const button = $('#new-msg');
  button.hidden = unread === 0;
  $('#new-count').textContent = unread > 99 ? '99+' : String(unread);
}

// Dipanggil setiap ada item baru di feed: batasi jumlah, lalu turun ke bawah
// hanya kalau pengguna memang sedang di bawah (tidak sedang membaca riwayat).
function trimFeed() {
  const feed = $('#feed');
  while (feed.children.length > feedLimit) feed.firstElementChild.remove();
}

function afterFeedAppend(item) {
  const feed = $('#feed');
  trimFeed();
  if (stickFeed) feed.scrollTop = feed.scrollHeight;
  else if (item.offsetParent !== null) { unread += 1; updateNewButton(); }
}

function richText(parts, fallback) {
  const container = document.createElement('div');
  container.className = 'rich-text';
  const usable = Array.isArray(parts) && parts.length ? parts : [{ type: 'text', text: fallback || '' }];
  usable.forEach(part => {
    if (part.type === 'image' && part.url) {
      const image = document.createElement('img');
      image.className = 'chat-emoji'; image.src = part.url; image.alt = part.alt || 'emoji'; image.title = part.alt || '';
      container.append(image);
    } else if (part.text) container.append(document.createTextNode(part.text));
  });
  return container;
}

function ensureTimer(active) {
  clearInterval(timer);
  if (!active) { $('#duration').textContent = '00:00:00'; return; }
  if (!startedAt) startedAt = Date.now();
  const tick = () => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    $('#duration').textContent = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
  };
  tick(); timer = setInterval(tick, 1000);
}

/* ---------- Statistik per platform ---------- */
const ICONS = {
  eye: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
};

function statItem(kind, caption, title, value) {
  const item = document.createElement('div'); item.className = `stat ${kind}`; item.title = title;
  const icon = document.createElement('span'); icon.className = 'stat-ico'; icon.innerHTML = ICONS[kind === 'viewers' ? 'eye' : 'heart'];
  const text = document.createElement('div'); text.className = 'stat-text';
  const number = document.createElement('b'); number.textContent = Number.isFinite(value) ? format(value) : '—';
  const label = document.createElement('small'); label.textContent = caption;
  text.append(number, label); item.append(icon, text); return item;
}

function renderPlatformStats() {
  const container = $('#platform-stats');
  container.replaceChildren(...activeSources.map(source => {
    const card = document.createElement('div'); card.className = `stat-card ${source.platform}`; card.dataset.sourceId = source.id;
    const head = document.createElement('div'); head.className = 'stat-head';
    const tag = document.createElement('span'); tag.className = 'stat-platform'; tag.textContent = platformName[source.platform] || source.platform;
    const title = document.createElement('strong'); title.textContent = source.label; title.title = `${platformName[source.platform]} · ${source.label}`;
    head.append(tag, title);
    const grid = document.createElement('div'); grid.className = 'stat-grid';
    grid.append(statItem('viewers', 'Penonton', 'Penonton aktif saat ini', source.stats?.viewers));
    if (source.platform === 'tiktok' || source.platform === 'youtube') grid.append(statItem('likes', 'Suka', 'Total like', source.stats?.likes));
    card.append(head, grid); return card;
  }));
  container.hidden = activeSources.length === 0;
  syncSolo();
}

// "Solo stream": nama platform & username disembunyikan, tapi hanya bila tepat 1 stream aktif
// (kalau ada beberapa sumber, namanya tetap tampil supaya tidak tertukar).
function syncSolo() {
  const solo = Boolean(settings.soloStream) && activeSources.length === 1;
  $('#platform-stats').classList.toggle('solo', solo);
  $('#top').classList.toggle('solo', solo);
}

/* ---------- Top viewers ---------- */
function topCard(viewer, index) {
  const name = viewer.nickname || viewer.username || 'Penonton';
  const card = document.createElement('div'); card.className = `top-card rank-${index + 1}`;
  const rank = document.createElement('i'); rank.className = 'top-rank'; rank.textContent = String(index + 1);
  let lead = rank;                                   // tanpa foto: nomor peringkat berdiri sendiri
  if (!settings.hideProfile) {
    lead = document.createElement('div'); lead.className = 'top-ava';
    const pic = document.createElement('div'); pic.className = 'top-pic'; fillAvatar(pic, name, viewer.avatar);
    lead.append(pic, rank);
  } else rank.classList.add('solo');
  const meta = document.createElement('div'); meta.className = 'top-meta';
  const nick = document.createElement('b'); nick.textContent = name; nick.title = name;
  meta.append(nick);
  if (viewer.username && viewer.username !== 'penonton' && viewer.username !== name) {
    const handle = document.createElement('span'); handle.textContent = `@${viewer.username}`; meta.append(handle);
  }
  card.append(lead, meta); return card;
}

function renderTop(data) {
  const viewers = data.topViewers.slice(0, 3);
  lastTopData = data;
  const key = `${settings.hideProfile ? 'nophoto' : 'photo'}|${data.sourceLabel}|${viewers.map(item => `${item.username}~${item.nickname}~${item.avatar}`).join('|')}`;
  if (key === lastTopKey && !$('#top').hidden) return;   // tidak berubah: jangan render ulang (hindari kedip foto)
  lastTopKey = key;
  $('#top-source').textContent = data.sourceLabel || '';
  $('#top-list').replaceChildren(...viewers.map(topCard));
  $('#top').hidden = false;
}

/* ---------- Riwayat bergabung ---------- */
function addJoin(data) {
  $('#join').hidden = false;                        // tampilkan dulu agar ukurannya bisa dihitung
  const row = document.createElement('div'); row.className = 'join-item';
  const text = document.createElement('p');
  const name = document.createElement('b'); name.textContent = `${data.nickname} · ${platformName[data.platform] || 'TikTok'}`;
  text.append(name, ' baru bergabung');
  if (!settings.hideProfile) {
    const pic = document.createElement('div'); pic.className = 'join-ava'; pic.dataset.profile = ''; fillAvatar(pic, data.nickname, data.avatar);
    row.append(pic);
  }
  row.append(text);
  joinList.push(row);
}

// Gift yang disematkan: kolom sendiri, terpisah dari chat.
function addPinnedGift(data) {
  $('#gift-pin').hidden = false;
  const row = document.createElement('div'); row.className = 'gift-item';
  const text = document.createElement('p');
  const name = document.createElement('b'); name.textContent = data.nickname;
  text.append(name, ` mengirim ${data.giftName} ×${data.amount}`);
  if (!settings.hideProfile) {
    const pic = document.createElement('div'); pic.className = 'gift-ava'; pic.dataset.profile = ''; fillAvatar(pic, data.nickname, data.avatar);
    row.append(pic);
  }
  row.append(text);
  if (data.image) {
    const icon = document.createElement('img'); icon.className = 'gift-img'; icon.alt = ''; icon.src = data.image;
    icon.addEventListener('error', () => icon.remove(), { once: true });
    row.append(icon);
  }
  giftList.push(row);
}

/* ---------- Chat & aktivitas ---------- */
function addChat(data) {
  if (!data.comment) return;
  $('#empty')?.remove();
  const item = document.createElement('article');
  item.className = 'entry multi';
  const body = document.createElement('div'); body.className = 'body';
  const name = document.createElement('div'); name.className = 'name';
  const strong = document.createElement('b'); strong.textContent = data.nickname;
  const handle = document.createElement('span'); handle.textContent = data.username ? `@${data.username}` : '';
  name.append(strong, handle); body.append(name, richText(data.parts, data.comment)); if (settings.hideProfile) item.classList.add('no-ava');
  else { const photo = avatar(data); photo.dataset.profile = ''; item.append(photo); }
  item.append(body, badge(data.platform));
  $('#feed').append(item); total += 1; $('#count').textContent = `${total} komentar`; afterFeedAppend(item);
}

function addActivity(data) {
  if (!data.nickname) return;
  if (data.type === 'gift' && settings.pinGift) { addPinnedGift(data); return; }   // mati = tetap tercampur di chat
  $('#empty')?.remove();
  const item = document.createElement('article'); item.className = `entry activity multi ${data.type}`;
  const body = document.createElement('div'); body.className = 'body';
  const text = document.createElement('p'); text.className = 'text';
  const messages = {
    gift: `${data.nickname} mengirim ${data.giftName} ×${data.amount}`,
    share: `${data.nickname} membagikan LIVE`,
    repost: `${data.nickname} memposting ulang LIVE`,
    follow: `${data.nickname} mulai mengikuti host`,
    superchat: `${data.nickname} mengirim Super Chat ${data.amountText}`,
    membership: `${data.nickname} menjadi member`,
    cheer: `${data.nickname} mengirim ${data.amountText}${data.comment ? ` — ${data.comment}` : ''}`,
    subscription: `${data.nickname} berlangganan channel`
  };
  text.textContent = messages[data.type] || `${data.nickname}: ${data.comment || data.type}`;
  body.append(text);
  if (data.parts?.length) body.append(richText(data.parts, data.comment));
  if (data.stickerUrl) {
    const sticker = document.createElement('img'); sticker.className = 'super-sticker'; sticker.src = data.stickerUrl; sticker.alt = 'Super Sticker'; body.append(sticker);
  }
  // Gambar gift bukan foto profil, jadi tetap tampil. Foto profil user disembunyikan bila diminta.
  if (!data.image && settings.hideProfile) item.classList.add('no-ava');
  else { const icon = avatar(data, data.image || data.avatar); if (!data.image) icon.dataset.profile = ''; item.append(icon); }
  item.append(body, badge(data.platform));
  $('#feed').append(item); afterFeedAppend(item);
}

$('#platform').addEventListener('change', event => {
  const hints = { tiktok: 'Username atau URL TikTok LIVE', youtube: 'URL LIVE, video ID, atau channel ID', twitch: 'Nama channel atau URL Twitch' };
  $('#target').placeholder = hints[event.target.value];
});

$('#form').addEventListener('submit', async event => {
  event.preventDefault(); $('#error').textContent = ''; $('#connect').disabled = true;
  const result = await window.overlay.connect($('#platform').value, $('#target').value);
  $('#connect').disabled = false;
  if (!result.ok) $('#error').textContent = result.error;
  else { $('#target').value = ''; $('#setup').classList.add('collapsed'); }
});

window.overlay.onSources(sources => {
  activeSources = sources;
  const container = $('#sources');
  container.replaceChildren(...sources.map(source => {
    const pill = document.createElement('div'); pill.className = `source-pill ${source.platform}`;
    const text = document.createElement('span'); text.textContent = `${platformName[source.platform]} · ${source.label}`;
    const close = document.createElement('button'); close.textContent = '×'; close.title = 'Putuskan sumber'; close.onclick = () => window.overlay.disconnect(source.id);
    pill.append(text, close); return pill;
  }));
  const active = sources.length > 0;
  const status = $('#status'); status.className = `status ${active ? 'connected' : 'idle'}`;
  status.querySelector('span').textContent = active ? `${sources.length} stream aktif` : 'Belum ada stream';
  $('#disconnect-all').hidden = !active;
  if (!active) { startedAt = 0; $('#top').hidden = true; lastTopKey = ''; lastTopData = null; }
  renderPlatformStats();
  ensureTimer(active);
});

window.overlay.onChat(addChat);
window.overlay.onActivity(addActivity);
window.overlay.onMember(addJoin);
window.overlay.onStats(data => {
  const source = activeSources.find(item => item.id === data.sourceId);
  if (source) { source.stats = { ...source.stats, viewers: data.viewers, likes: data.likes }; renderPlatformStats(); }
  if (data.topViewers?.length) renderTop(data);
});
window.overlay.onSourceError(data => { $('#error').textContent = `${platformName[data.platform]}: ${data.error}`; });
window.overlay.onNotice(data => { $('#error').textContent = data.text; });

/* ---------- Scroll cerdas (feed & riwayat bergabung) ---------- */
const feedElement = $('#feed');
feedElement.addEventListener('scroll', () => {
  stickFeed = atBottom(feedElement, 80);
  if (stickFeed && unread) { unread = 0; updateNewButton(); }
}, { passive: true });
$('#new-msg').onclick = () => { feedElement.scrollTop = feedElement.scrollHeight; };
new ResizeObserver(() => { if (stickFeed) feedElement.scrollTop = feedElement.scrollHeight; }).observe(feedElement);

const joinList = createStickyList($('#join-list'), $('#join-latest'), 10);
const giftList = createStickyList($('#gift-list'), $('#gift-latest'), 25);

/* ---------- Pengaturan ---------- */
const STORE_KEY = 'overlay-settings-v1';
const DEFAULTS = {
  sizeChat: 16, sizeName: 11, sizeActivity: 12, sizeJoin: 11, sizeGift: 12, sizeTop: 11, sizeStats: 20,
  opacity: 90, avatar: 35, joinRows: 1, giftRows: 2, pinGift: false, soloStream: false, hideProfile: false,
  showStats: true, showTop: true, showJoin: true, showBadge: true,
  showChat: true, showGift: true, showFollow: true, showShare: true, showRepost: true,
  accent: 'tiktok', bg: 'gelap', joinPos: 'atas', giftPos: 'atas', memory: 'normal'
};
const CHOICES = { joinPos: ['atas', 'bawah'], giftPos: ['atas', 'bawah'], memory: ['high', 'normal', 'low'] };
// Mode memori: jumlah riwayat maksimum yang disimpan (makin kecil = makin hemat RAM).
const MEMORY_PRESETS = {
  high: { join: 25, gift: 50, chat: 100 },
  normal: { join: 10, gift: 25, chat: 50 },
  low: { join: 5, gift: 10, chat: 25 }
};
// Slider yang terkunci (abu-abu, tidak bisa digeser) saat kondisinya terpenuhi.
const LOCKS = {
  sizeGift: () => !settings.pinGift,
  giftRows: () => !settings.pinGift,
  avatar: () => settings.hideProfile
};
const CSS_VARS = {
  sizeChat: ['--size', 'px'], sizeName: ['--size-name', 'px'], sizeActivity: ['--size-activity', 'px'],
  sizeJoin: ['--size-join', 'px'], sizeGift: ['--size-gift', 'px'], sizeTop: ['--size-top', 'px'], sizeStats: ['--size-stats', 'px'],
  avatar: ['--avatar', 'px'], joinRows: ['--join-rows', ''], giftRows: ['--gift-rows', '']
};
const BODY_CLASS = {
  showStats: 'no-stats', showTop: 'no-top', showJoin: 'no-join', showBadge: 'no-badge',
  showChat: 'hide-chat', showGift: 'hide-gift', showFollow: 'hide-follow', showShare: 'hide-share', showRepost: 'hide-repost'
};
const ACCENTS = {
  tiktok: { label: 'TikTok', main: '#fe2c55', alt: '#25f4ee' },
  samudra: { label: 'Samudra', main: '#3b82f6', alt: '#22d3ee' },
  ungu: { label: 'Ungu', main: '#8b5cf6', alt: '#f0abfc' },
  zamrud: { label: 'Zamrud', main: '#10b981', alt: '#bef264' },
  emas: { label: 'Emas', main: '#f59e0b', alt: '#fde68a' }
};
const BACKGROUNDS = {
  gelap: { label: 'Gelap', rgb: '11,12,17' },
  hitam: { label: 'Hitam pekat', rgb: '0,0,0' },
  biru: { label: 'Biru malam', rgb: '9,14,30' },
  ungu: { label: 'Ungu malam', rgb: '20,11,34' }
};

const settings = { ...DEFAULTS };

function cleanSetting(key, value) {
  const fallback = DEFAULTS[key];
  if (typeof fallback === 'number') {
    const control = $(`[data-setting="${key}"]`);
    const number = Math.round(Number(value));
    if (!control || !Number.isFinite(number)) return fallback;
    return Math.min(Number(control.max), Math.max(Number(control.min), number));
  }
  if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
  if (CHOICES[key]) return CHOICES[key].includes(value) ? value : fallback;
  if (key === 'accent') return Object.hasOwn(ACCENTS, value) ? value : fallback;
  if (key === 'bg') return Object.hasOwn(BACKGROUNDS, value) ? value : fallback;
  return fallback;
}

let saveTimer;
function flushSave() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch {}
  try { window.overlay.saveSettings?.({ ...settings }); } catch {}   // salinan utama: file di folder data aplikasi
}
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 250); };
window.addEventListener('pagehide', flushSave);

function applySetting(key) {
  const value = settings[key], root = document.documentElement;
  const control = $(`[data-setting="${key}"]`), output = $(`[data-out="${key}"]`);
  let shown = String(value);
  if (CSS_VARS[key]) { root.style.setProperty(CSS_VARS[key][0], value + CSS_VARS[key][1]); shown = value + CSS_VARS[key][1]; }
  else if (key === 'opacity') { root.style.setProperty('--opacity', String(value / 100)); shown = `${value}%`; }
  else if (BODY_CLASS[key]) document.body.classList.toggle(BODY_CLASS[key], !value);
  else if (key === 'accent') {
    root.style.setProperty('--pink', ACCENTS[value].main); root.style.setProperty('--cyan', ACCENTS[value].alt); shown = ACCENTS[value].label;
  } else if (key === 'bg') { root.style.setProperty('--bg-rgb', BACKGROUNDS[value].rgb); shown = BACKGROUNDS[value].label; }
  else if (key === 'joinPos') document.body.classList.toggle('join-bottom', value === 'bawah');
  else if (key === 'giftPos') document.body.classList.toggle('gift-bottom', value === 'bawah');
  else if (key === 'pinGift') document.body.classList.toggle('pin-gift', value);
  else if (key === 'soloStream') { document.body.classList.toggle('solo-stream', value); syncSolo(); }
  else if (key === 'hideProfile') { document.body.classList.toggle('hide-profile', value); if (value) stripProfilePhotos(); else rerenderTop(); }
  else if (key === 'memory') applyMemory(value);
  if (control?.type === 'checkbox') control.checked = Boolean(value);
  else if (control) {
    control.value = value;
    control.style.setProperty('--fill', `${(value - Number(control.min)) / (Number(control.max) - Number(control.min)) * 100}%`);
  }
  if (output) output.textContent = shown;
  if (key === 'accent' || key === 'bg') {
    document.querySelectorAll(`[data-swatch="${key}"]`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === value)));
  }
  if (CHOICES[key]) document.querySelectorAll(`[data-choice="${key}"]`).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.value === value)));
  if (key === 'sizeJoin' || key === 'joinRows' || key === 'showJoin' || key === 'joinPos') joinList.keepBottom();
  if (key === 'sizeGift' || key === 'giftRows' || key === 'pinGift' || key === 'giftPos' || key === 'showGift') giftList.keepBottom();
  if (key === 'pinGift' || key === 'hideProfile') refreshLocks();
}

function refreshLocks() {
  Object.entries(LOCKS).forEach(([key, isLocked]) => {
    const control = $(`[data-setting="${key}"]`); if (!control) return;
    const locked = isLocked();
    control.disabled = locked;
    control.closest('.srow')?.classList.toggle('locked', locked);
  });
}

function applyMemory(mode) {
  const preset = MEMORY_PRESETS[mode];
  feedLimit = preset.chat; trimFeed();
  joinList.setLimit(preset.join); giftList.setLimit(preset.gift);
  const hint = $('#memory-hint');
  if (hint) hint.textContent = `Riwayat yang disimpan: komentar ${preset.chat} · gift ${preset.gift} · bergabung ${preset.join}. Makin kecil, makin hemat RAM.`;
}

// Saat "Sembunyikan foto profil" dinyalakan: buang semua foto profil yang sudah ada di layar
// (agar gambarnya benar-benar dilepas dari memori), lalu render ulang Top viewers tanpa foto.
function stripProfilePhotos() {
  document.querySelectorAll('[data-profile]').forEach(node => {
    node.closest('.entry')?.classList.add('no-ava');
    node.remove();
  });
  rerenderTop();
}
function rerenderTop() {
  if (!lastTopData) return;
  lastTopKey = '';
  renderTop(lastTopData);
}

function buildSwatches(container, key, presets) {
  Object.entries(presets).forEach(([id, preset]) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'swatch'; button.dataset.swatch = key; button.dataset.value = id;
    button.title = preset.label; button.setAttribute('aria-label', preset.label); button.setAttribute('aria-pressed', 'false');
    const first = preset.main || `rgb(${preset.rgb})`, second = preset.alt || first;
    button.style.setProperty('--sw-a', first); button.style.setProperty('--sw-b', second);
    button.onclick = () => { settings[key] = id; applySetting(key); save(); };
    container.append(button);
  });
}

function selectTab(name) {
  document.querySelectorAll('.tab').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach(pane => { pane.hidden = pane.dataset.pane !== name; });
}

function initSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    if (saved && typeof saved === 'object') Object.keys(DEFAULTS).forEach(key => { if (key in saved) settings[key] = cleanSetting(key, saved[key]); });
  } catch {}
  buildSwatches($('#accent-swatches'), 'accent', ACCENTS);
  buildSwatches($('#bg-swatches'), 'bg', BACKGROUNDS);
  document.querySelectorAll('[data-setting]').forEach(control => {
    const key = control.dataset.setting;
    control.addEventListener('input', () => {
      settings[key] = control.type === 'checkbox' ? control.checked : cleanSetting(key, control.value);
      applySetting(key); save();
    });
  });
  document.querySelectorAll('[data-choice]').forEach(button => {
    button.onclick = () => { settings[button.dataset.choice] = button.dataset.value; applySetting(button.dataset.choice); save(); };
  });
  const tabs = [...document.querySelectorAll('.tab')];
  tabs.forEach(tab => { tab.onclick = () => selectTab(tab.dataset.tab); });
  $('.tabs').addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = tabs.indexOf(document.activeElement); if (index < 0) return;
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.focus(); selectTab(next.dataset.tab); event.preventDefault();
  });
  $('#reset-settings').onclick = () => { Object.assign(settings, DEFAULTS); Object.keys(DEFAULTS).forEach(applySetting); flushSave(); };
  Object.keys(DEFAULTS).forEach(applySetting);
  syncSettingsFile();
}

// File pengaturan di folder data aplikasi adalah sumber utama. Kalau belum ada, salinan
// dari penyimpanan browser (versi sebelumnya) dipindahkan ke sana.
async function syncSettingsFile() {
  try {
    const stored = await window.overlay.loadSettings?.();
    if (stored) {
      Object.keys(DEFAULTS).forEach(key => { if (key in stored) settings[key] = cleanSetting(key, stored[key]); });
      Object.keys(DEFAULTS).forEach(applySetting);
    }
    flushSave();
  } catch {}
}
initSettings();

/* ---------- Kontrol jendela ---------- */
$('#gear').onclick = () => $('#settings').hidden = !$('#settings').hidden;
$('#setup-toggle').onclick = () => $('#setup').classList.toggle('collapsed');
async function showMobileInfo(info) { if (info?.url) $('#mobile-url').textContent = info.url; }
window.overlay.getMobileInfo().then(showMobileInfo);
Promise.resolve(window.overlay.getAppInfo?.()).then(info => { if (info?.version) $('#app-version').textContent = `version ${info.version} byLZ`; }).catch(() => {});
window.overlay.onMobileInfo(showMobileInfo);
$('#copy-mobile-url').onclick = async () => { try { await navigator.clipboard.writeText($('#mobile-url').textContent); $('#copy-mobile-url').textContent = 'Disalin'; setTimeout(() => $('#copy-mobile-url').textContent = 'Salin link', 1200); } catch {} };
$('#settings-close').onclick = () => $('#settings').hidden = true;
$('#topmost').onchange = event => window.overlay.alwaysOnTop(event.target.checked);
let toastTimer = 0;
function showToast(text) {
  const toast = $('#toast');
  toast.textContent = text; toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
}
// Ctrl+Shift+O mengubah "Selalu di atas" dari luar jendela: samakan tombolnya dan beri tahu sebentar.
window.overlay.onAlwaysOnTopState?.(enabled => {
  $('#topmost').checked = enabled;
  showToast(`Selalu di atas: ${enabled ? 'nyala' : 'mati'}`);
});
$('#passthrough').onchange = event => window.overlay.clickThrough(event.target.checked);
document.querySelectorAll('[data-size]').forEach(button => button.onclick = () => window.overlay.setSize(button.dataset.size));
window.overlay.onClickThroughState(enabled => { $('#passthrough').checked = enabled; document.body.classList.toggle('passthrough', enabled); if (enabled) $('#settings').hidden = true; });
$('#disconnect-all').onclick = () => window.overlay.disconnectAll();
$('#min').onclick = () => window.overlay.minimize();
$('#close').onclick = () => { flushSave(); window.overlay.close(); };

/* ---------- Geser jendela ---------- */
// Area bertanda data-drag (title bar, bar status, footer) bisa dipakai untuk memindahkan jendela.
// Dilakukan lewat JS agar tidak bergantung pada drag-region bawaan Electron yang kadang macet
// di jendela transparan, dan agar tidak memicu seret-teks/gambar bawaan browser (ikon 🚫).
document.addEventListener('dragstart', event => event.preventDefault());
let windowDrag = null;
let dragTimer = 0;
let lastDragSend = 0;
function sendDrag() {
  dragTimer = 0; lastDragSend = performance.now();
  if (windowDrag) window.overlay.dragMove?.(windowDrag.dx, windowDrag.dy);
}
document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || windowDrag) return;
  const handle = event.target.closest?.('[data-drag]');
  if (!handle || event.target.closest('button, input, select, textarea, a')) return;
  windowDrag = { id: event.pointerId, x: event.screenX, y: event.screenY, dx: 0, dy: 0 };
  try { handle.setPointerCapture(event.pointerId); } catch {}
  document.body.classList.add('moving');
  window.overlay.dragStart?.();
  event.preventDefault();
});
document.addEventListener('pointermove', event => {
  if (!windowDrag || event.pointerId !== windowDrag.id) return;
  windowDrag.dx = event.screenX - windowDrag.x; windowDrag.dy = event.screenY - windowDrag.y;
  const wait = 8 - (performance.now() - lastDragSend);
  if (wait <= 0) sendDrag(); else if (!dragTimer) dragTimer = setTimeout(sendDrag, wait);
});
function endWindowDrag(event) {
  if (!windowDrag || (event && event.pointerId !== undefined && event.pointerId !== windowDrag.id)) return;
  clearTimeout(dragTimer); dragTimer = 0;
  window.overlay.dragMove?.(windowDrag.dx, windowDrag.dy);
  window.overlay.dragEnd?.();
  windowDrag = null; document.body.classList.remove('moving');
}
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => document.addEventListener(name, endWindowDrag));
window.addEventListener('blur', () => endWindowDrag());
