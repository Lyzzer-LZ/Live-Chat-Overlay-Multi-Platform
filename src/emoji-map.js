// Kode emoji bawaan TikTok yang tampil sebagai teks di chat, mis. [laugh] atau [cool],
// diganti dengan emoji standar. Kode yang tidak dikenal dibiarkan apa adanya.
const MAP = {
  angel: '😇', angry: '😠', astonish: '😮', awkward: '😬', blink: '😉', clown: '🤡', complacent: '😌', cool: '😎',
  cry: '😢', cute: '😚', disdain: '😒', drool: '🤤', embarrassed: '😅', evil: '😈', excited: '🤩',
  facewithrollingeyes: '🙄', flushed: '😳', funnyface: '🤪', greedy: '🤑', happy: '😊', hehe: '😁', joyful: '😄',
  laugh: '😄', laughwithtears: '😂', loveface: '😍', lovely: '🥰', nap: '😴', pride: '😏', proud: '😤', rage: '🤬',
  scream: '😱', shock: '😨', shout: '😡', slap: '🤦', smile: '🙂', smileface: '😀', speechless: '😶', stun: '😵',
  sulk: '😞', surprised: '😲', tears: '🥲', thinking: '🤔', weep: '😭', wicked: '😜', wow: '😍', wronged: '🥺', yummy: '😋',
  // pilihan emoji dari pemilik (menimpa pemetaan lain bila kodenya sama)
  thanks: '😋', thumb: '👍', hi: '👋', heart: '\u2764\uFE0F', congrat: '🎉',
  rockyserious: '😡', rockyloveit: '🥵', rockyproud: '😁', rockycool: '😎',
  rosiedislike: '😤', rosieawkward: '🙂', rosiekisskiss: '😘', rosiecute: '🥰',
  jolliekissingface: '😚', jolliewow: '🤩', jolliespeechless: '🙄', jolliesatisfied: '🤗',
  sagethink: '🤔', sagefulfilled: '😊', sageclever: '🤓', sagemoney: '🤑',
  // nama lain yang sering muncul di chat
  laughcry: '😂', laughingcry: '😂', laughing: '😂', smirk: '😏'
};

export function emojify(text) {
  if (typeof text !== 'string' || !text.includes('[')) return text;
  return text.replace(/\[([A-Za-z0-9_]{2,24})\]/g, (match, code) => {
    const key = code.toLowerCase();
    return Object.hasOwn(MAP, key) ? MAP[key] : match;
  });
}

// Kode berbentuk [kata] yang belum ada di daftar (untuk dicatat agar bisa ditambahkan nanti).
export function unknownCodes(text) {
  if (typeof text !== 'string' || !text.includes('[')) return [];
  const found = new Set();
  for (const match of text.matchAll(/\[([A-Za-z][A-Za-z0-9_]{1,23})\]/g)) {
    if (!Object.hasOwn(MAP, match[1].toLowerCase())) found.add(match[1].toLowerCase());
  }
  return [...found];
}
