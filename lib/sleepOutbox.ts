import type { SleepMutation } from '@/types'

const DB_NAME = 'sommeil-offline'
const STORE = 'sleep-mutations'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'mutation_id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

export async function enqueueSleepMutation(mutation: SleepMutation): Promise<void> {
  await transact('readwrite', (store) => store.put(mutation))
}

export async function removeSleepMutation(id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(id))
}

export async function pendingSleepMutations(): Promise<SleepMutation[]> {
  if (typeof indexedDB === 'undefined') return []
  return transact('readonly', (store) => store.getAll())
}

export function createMutationId(): string {
  return crypto.randomUUID()
}
