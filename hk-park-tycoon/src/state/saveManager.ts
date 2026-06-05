// =============================================================================
// HK Theme Park Tycoon - Save Manager (IndexedDB)
// =============================================================================

import type { GameDate } from '../engine/types';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DB_NAME = 'hk-park-tycoon';
const DB_VERSION = 1;
const STORE_NAME = 'saves';
const AUTO_SAVE_SLOT = '__autosave__';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SaveMetadata {
  slotId: string;
  parkName: string;
  money: number;
  date: GameDate;
  timestamp: number;
}

/** Shape of the game state object passed into save functions. */
export interface SaveData {
  parkName: string;
  money: number;
  date: GameDate;
}

interface SaveRecord {
  slotId: string;
  parkName: string;
  money: number;
  date: GameDate;
  timestamp: number;
  state: string; // JSON-serialized game state
}

// -----------------------------------------------------------------------------
// Database Helpers
// -----------------------------------------------------------------------------

/**
 * Opens (or creates) the IndexedDB database and returns a promise that
 * resolves with the IDBDatabase handle.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Runs a single read-write transaction against the saves object store.
 */
function withStore<T = unknown>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = callback(store);

        req.onsuccess = () => {
          resolve(req.result as T);
        };

        req.onerror = () => {
          reject(req.error);
        };

        tx.oncomplete = () => {
          db.close();
        };

        tx.onerror = () => {
          reject(tx.error);
        };
      }),
  );
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Saves the current game state to the specified slot.
 * The state object is JSON-serialized before storage.
 */
export async function saveGame(slotId: string, state: SaveData): Promise<void> {
  const record: SaveRecord = {
    slotId,
    parkName: state.parkName ?? 'Unknown Park',
    money: state.money ?? 0,
    date: state.date ?? { day: 1, month: 1, year: 1 },
    timestamp: Date.now(),
    state: JSON.stringify(state),
  };

  await withStore<void>('readwrite', (store) => store.put(record));
}

/**
 * Loads a saved game from the specified slot.
 * Returns the deserialized state object, or null if the slot is empty.
 */
export async function loadGame(slotId: string): Promise<SaveData | null> {
  const record = await withStore<SaveRecord | undefined>('readonly', (store) =>
    store.get(slotId),
  );

  if (!record || !record.state) {
    return null;
  }

  try {
    return JSON.parse(record.state) as SaveData;
  } catch {
    console.error(`[SaveManager] Failed to parse save data for slot "${slotId}".`);
    return null;
  }
}

/**
 * Returns metadata for every save slot (without the full state payload).
 */
export async function listSaves(): Promise<SaveMetadata[]> {
  const records = await withStore<SaveRecord[]>('readonly', (store) =>
    store.getAll(),
  );

  if (!records || !Array.isArray(records)) {
    return [];
  }

  return records.map((r) => ({
    slotId: r.slotId,
    parkName: r.parkName,
    money: r.money,
    date: r.date,
    timestamp: r.timestamp,
  }));
}

/**
 * Deletes the save at the specified slot.
 */
export async function deleteSave(slotId: string): Promise<void> {
  await withStore<void>('readwrite', (store) => store.delete(slotId));
}

/**
 * Performs an auto-save using a dedicated slot.
 * Can be called on a periodic interval (e.g., every 60 seconds of real time).
 */
export async function autoSave(state: SaveData): Promise<void> {
  await saveGame(AUTO_SAVE_SLOT, state);
}

/**
 * Loads the auto-save slot. Returns null if no auto-save exists.
 */
export async function loadAutoSave(): Promise<SaveData | null> {
  return loadGame(AUTO_SAVE_SLOT);
}

/**
 * Returns the auto-save slot ID constant for external use.
 */
export function getAutoSaveSlotId(): string {
  return AUTO_SAVE_SLOT;
}

const saveManager = {
  saveGame,
  loadGame,
  listSaves,
  deleteSave,
  autoSave,
  loadAutoSave,
  getAutoSaveSlotId,
};

export default saveManager;
