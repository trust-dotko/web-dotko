// web/src/utils/fileUpload.js
//
// Single client upload path: files go to the authenticated Admin-SDK proxy
// (/api/storage/upload). The browser never writes Firebase Storage directly.
// We also compute a SHA-256 of the bytes client-side as a tamper-evidence hash
// (stored forever on the trade; the file itself is retained per the lifecycle
// policy and served later via short-lived signed URLs).

export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
export const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB — keeps Storage cost minimal
export const MAX_FILES = 5;

export function sanitizeFilename(name) {
  const dot  = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext  = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  const clean = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return ext ? `${clean}.${ext}` : clean;
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload one file via the server proxy.
 * @param {File} file
 * @param {() => Promise<string>} getToken  resolves the Firebase ID token
 * @returns {Promise<{ path: string, hash: string, name: string }>}
 */
export async function uploadTradeFile(file, getToken) {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error(`${file.name}: only PDF, JPG, PNG allowed`);
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name}: exceeds 3 MB limit`);

  const buffer = await file.arrayBuffer();
  const [fileBase64, hash] = await Promise.all([
    Promise.resolve(bufferToBase64(buffer)),
    sha256Hex(buffer),
  ]);

  const token = await getToken();
  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileBase64, contentType: file.type, filename: sanitizeFilename(file.name), sha256: hash }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
  const data = await res.json();
  return { path: data.path, hash: data.hash || hash, name: file.name };
}
