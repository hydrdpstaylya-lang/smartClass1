/* ---------- IndexedDB ---------- */
const DB = (() => {
  let dbp = null;
  const open = () => dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('smartclass-goftogu', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (store, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return {
    get: (k, store='kv') => tx(store, 'readonly', s => s.get(k)),
    put: (k, v, store='kv') => tx(store, 'readwrite', s => s.put(v, k)),
    del: (k, store='kv') => tx(store, 'readwrite', s => s.delete(k)),
    keys: (store='blobs') => tx(store, 'readonly', s => s.getAllKeys()),
    clear: async () => { await tx('kv','readwrite', s => s.clear()); await tx('blobs','readwrite', s => s.clear()); },
  };
})();
const URLS = {};
async function blobURL(key){ if(!key) return ''; if(URLS[key]) return URLS[key]; const b = await DB.get(key, 'blobs'); if(!b) return ''; return URLS[key] = URL.createObjectURL(b); }
async function putBlob(blob){ const key = 'b' + nid(); await DB.put(key, blob, 'blobs'); URLS[key] = URL.createObjectURL(blob); return key; }
