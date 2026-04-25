import { ChatSession } from '@/app/types';

const DB_NAME = 'x-chat';
const DB_VERSION = 1;
const SESSION_STORE = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another tab'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function getIndexedSessions(): Promise<ChatSession[]> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(SESSION_STORE, 'readonly');
    const store = transaction.objectStore(SESSION_STORE);
    const sessions = await requestToPromise<ChatSession[]>(store.getAll());
    await transactionDone(transaction);
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function syncIndexedSessions(sessions: ChatSession[]): Promise<void> {
  const db = await openDatabase();
  try {
    const readTransaction = db.transaction(SESSION_STORE, 'readonly');
    const readStore = readTransaction.objectStore(SESSION_STORE);
    const existingKeys = await requestToPromise<IDBValidKey[]>(readStore.getAllKeys());
    await transactionDone(readTransaction);

    const transaction = db.transaction(SESSION_STORE, 'readwrite');
    const store = transaction.objectStore(SESSION_STORE);
    const nextIds = new Set(sessions.map((session) => session.id));

    for (const session of sessions) {
      store.put(session);
    }

    for (const key of existingKeys) {
      if (typeof key === 'string' && !nextIds.has(key)) {
        store.delete(key);
      }
    }

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
