const DB_NAME = 'ScrolllerDB';
const STORE_NAME = 'starred';
const VERSION = 1;

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const target = (e.target as IDBOpenDBRequest).result;
      if (!target.objectStoreNames.contains(STORE_NAME)) {
        target.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => { db = (e.target as IDBOpenDBRequest).result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
};

export const getStarred = async (): Promise<string[]> => {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get('list');
    req.onsuccess = () => resolve(req.result || ['memes', 'pics', 'aww', 'funny', 'earthporn']);
  });
};

export const saveStarred = async (subs: string[]) => {
  const database = await openDB();
  return new Promise<void>((resolve) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(subs, 'list');
    tx.oncomplete = () => resolve();
  });
};