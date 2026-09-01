const DB_NAME = 'alphapilot-backtests';
const DB_VERSION = 1;
const STORE_NAME = 'multiPeriod';

export type StoredMultiValidation<T> = {
  id: string;
  createdAt: string;
  status: 'running' | 'complete' | 'failed';
  universeMode: 'CUSTOM' | 'FNO44';
  symbolsText: string;
  startDate: string;
  endDate: string;
  minRR: string;
  results: T[];
  error?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open backtest storage.'));
  });
}

export async function saveMultiValidation<T>(value: StoredMultiValidation<T>): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save multi-period validation.'));
      tx.onabort = () => reject(tx.error ?? new Error('Multi-period validation save was aborted.'));
    });
  } finally {
    db.close();
  }
}

export async function listMultiValidations<T>(): Promise<StoredMultiValidation<T>[]> {
  const db = await openDb();
  try {
    const items = await new Promise<StoredMultiValidation<T>[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result ?? []) as StoredMultiValidation<T>[]);
      request.onerror = () => reject(request.error ?? new Error('Could not read multi-period history.'));
    });
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    db.close();
  }
}

export async function deleteMultiValidation(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not delete multi-period validation.'));
    });
  } finally {
    db.close();
  }
}
