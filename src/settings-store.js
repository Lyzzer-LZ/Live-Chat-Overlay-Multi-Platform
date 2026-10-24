// Menyimpan pengaturan overlay ke file JSON di folder data aplikasi, supaya tetap ada
// setelah aplikasi ditutup, laptop dimatikan, atau data browser internal terhapus.
import fs from 'node:fs';
import path from 'node:path';

const MAX_KEYS = 60;

// Hanya terima objek datar berisi angka / boolean / teks pendek.
export function sanitize(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const clean = {};
  for (const [key, value] of Object.entries(data).slice(0, MAX_KEYS)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 40)) clean[key] = value;
  }
  return clean;
}

export function createSettingsStore(directory, fileName = 'overlay-settings.json') {
  const file = path.join(directory, fileName);
  return {
    file,
    read() {
      try { return sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return null; }
    },
    write(data) {
      const clean = sanitize(data);
      if (!clean) return false;
      try {
        fs.mkdirSync(directory, { recursive: true });
        const temp = `${file}.tmp`;            // tulis ke file sementara dulu, lalu ganti: tidak ada file setengah jadi
        fs.writeFileSync(temp, JSON.stringify(clean, null, 2));
        fs.renameSync(temp, file);
        return true;
      } catch { return false; }
    }
  };
}
