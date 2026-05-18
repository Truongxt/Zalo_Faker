/**
 * IndexedDB service for managing offline messages
 * Stores pending messages when offline and syncs when connection is restored
 */

export interface PendingMessage {
    id: string
    conversationId: string
    senderId: string
    type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice'
    content: {
        text?: string
        mediaUrl?: string
        thumbnail?: string
        fileName?: string
        fileSize?: number
        duration?: number
    }
    metadata?: {
        isAnnouncement?: boolean
        isImportant?: boolean
    }
    replyTo?: string
    status: 'pending' | 'failed' | 'sent'
    retryCount: number
    createdAt: string
    lastRetryAt?: string
    error?: string
}

class OfflineMessagesDB {
    private dbName = 'taklo'
    private storeName = 'pendingMessages'
    private dbPromise: Promise<IDBDatabase>

    constructor() {
        this.dbPromise = this.initDB()
    }

    private initDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1)

            request.onerror = () => reject(request.error)
            request.onsuccess = () => resolve(request.result)

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' })

                    // Create indices for faster queries
                    store.createIndex('conversationId', 'conversationId', { unique: false })
                    store.createIndex('status', 'status', { unique: false })
                    store.createIndex('createdAt', 'createdAt', { unique: false })
                }
            }
        })
    }

    async addMessage(message: PendingMessage): Promise<void> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readwrite')
        const store = tx.objectStore(this.storeName)

        return new Promise((resolve, reject) => {
            const request = store.add(message)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async updateMessage(id: string, updates: Partial<PendingMessage>): Promise<void> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readwrite')
        const store = tx.objectStore(this.storeName)

        return new Promise(async (resolve, reject) => {
            // Get the existing message first
            const getRequest = store.get(id)
            getRequest.onsuccess = () => {
                const existing = getRequest.result
                if (!existing) {
                    reject(new Error(`Message ${id} not found`))
                    return
                }

                const updated = { ...existing, ...updates }
                const putRequest = store.put(updated)

                putRequest.onsuccess = () => resolve()
                putRequest.onerror = () => reject(putRequest.error)
            }
            getRequest.onerror = () => reject(getRequest.error)
        })
    }

    async getPendingByConversation(conversationId: string): Promise<PendingMessage[]> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readonly')
        const store = tx.objectStore(this.storeName)
        const index = store.index('conversationId')

        return new Promise((resolve, reject) => {
            const request = index.getAll(conversationId)
            request.onsuccess = () => {
                // Sort by createdAt
                const messages = request.result.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                )
                resolve(messages)
            }
            request.onerror = () => reject(request.error)
        })
    }

    async getAllPending(): Promise<PendingMessage[]> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readonly')
        const store = tx.objectStore(this.storeName)
        const index = store.index('status')

        return new Promise((resolve, reject) => {
            const request = index.getAll('pending')
            request.onsuccess = () => {
                const messages = request.result.sort((a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                )
                resolve(messages)
            }
            request.onerror = () => reject(request.error)
        })
    }

    async removeMessage(id: string): Promise<void> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readwrite')
        const store = tx.objectStore(this.storeName)

        return new Promise((resolve, reject) => {
            const request = store.delete(id)
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async clearAll(): Promise<void> {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readwrite')
        const store = tx.objectStore(this.storeName)

        return new Promise((resolve, reject) => {
            const request = store.clear()
            request.onsuccess = () => resolve()
            request.onerror = () => reject(request.error)
        })
    }

    async getStats() {
        const db = await this.dbPromise
        const tx = db.transaction([this.storeName], 'readonly')
        const store = tx.objectStore(this.storeName)

        return new Promise<{
            total: number
            pending: number
            failed: number
        }>((resolve, reject) => {
            const totalRequest = store.count()
            totalRequest.onsuccess = () => {
                const total = totalRequest.result

                const index = store.index('status')
                const pendingRequest = index.count('pending')
                pendingRequest.onsuccess = () => {
                    const pending = pendingRequest.result
                    const failedRequest = index.count('failed')
                    failedRequest.onsuccess = () => {
                        resolve({
                            total,
                            pending,
                            failed: failedRequest.result
                        })
                    }
                    failedRequest.onerror = () => reject(failedRequest.error)
                }
                pendingRequest.onerror = () => reject(pendingRequest.error)
            }
            totalRequest.onerror = () => reject(totalRequest.error)
        })
    }
}

// Singleton instance
export const offlineMessagesDB = new OfflineMessagesDB()
