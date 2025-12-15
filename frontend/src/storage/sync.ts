/**
 * Firebase Firestore Sync Layer
 * 
 * Provides optional real-time synchronization with Firebase Firestore.
 * Supports Off/PushOnly/TwoWay modes with configurable conflict resolution.
 */

import { initializeApp, FirebaseApp } from 'firebase/app';
import {
    Firestore,
    collection,
    doc,
    getDocs,
    onSnapshot,
    writeBatch,
    getFirestore,
} from 'firebase/firestore';
import {
    Ticket,
    Agent,
    Settings,
    FirebaseConfig,
    BlockedNumber,
    LotteryResult,
} from '@shared/schemas';
import * as db from './db';

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let unsubscribers: (() => void)[] = [];
let currentTenantId: string | null = null;

// =============================================================================
// Tenant Management
// =============================================================================

export function setCurrentTenant(tenantId: string | null): void {
    currentTenantId = tenantId;
}

export function getCurrentTenantId(): string | null {
    return currentTenantId;
}

/**
 * Get collection path with tenant prefix if available
 * e.g., 'tickets' becomes 'tenants/{tenantId}/tickets'
 */
function getTenantCollectionPath(collectionName: string): string {
    if (currentTenantId) {
        return `tenants/${currentTenantId}/${collectionName}`;
    }
    return collectionName; // Backwards compatible
}

// =============================================================================
// Initialization
// =============================================================================

export function initializeFirebase(config: FirebaseConfig): boolean {
    try {
        if (!config.apiKey || !config.projectId) {
            console.warn('Firebase config incomplete, sync disabled');
            return false;
        }

        firebaseApp = initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
        });

        firestore = getFirestore(firebaseApp);
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        return false;
    }
}

export function isFirebaseInitialized(): boolean {
    return firestore !== null;
}

export function getFirestoreInstance(): Firestore | null {
    return firestore;
}

// =============================================================================
// Real-time Listeners (for TwoWay sync)
// =============================================================================

export function startRealtimeSync(
    conflictResolution: 'remote' | 'local',
    onSync: () => void
): void {
    if (!firestore) {
        console.warn('Firestore not initialized');
        return;
    }

    // Clear existing listeners
    stopRealtimeSync();

    // Listen to tickets collection
    const ticketsRef = collection(firestore, getTenantCollectionPath('tickets'));
    const ticketUnsub = onSnapshot(ticketsRef, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const remoteTicket = change.doc.data() as Ticket;

            if (change.type === 'added' || change.type === 'modified') {
                const localTicket = await db.getTicket(remoteTicket.id);

                if (localTicket) {
                    // Conflict resolution
                    const localTime = new Date(localTicket.modifiedAt).getTime();
                    const remoteTime = new Date(remoteTicket.modifiedAt).getTime();

                    if (conflictResolution === 'remote' || remoteTime > localTime) {
                        await db.updateTicket(remoteTicket.id, remoteTicket);
                    }
                } else {
                    // New ticket from remote
                    await db.createTicket(remoteTicket);
                }
            }
        }
        onSync();
    });

    unsubscribers.push(ticketUnsub);

    // Listen to agents collection
    const agentsRef = collection(firestore, getTenantCollectionPath('agents'));
    const agentUnsub = onSnapshot(agentsRef, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const remoteAgent = change.doc.data() as Agent;

            if (change.type === 'added' || change.type === 'modified') {
                const localAgent = await db.getAgent(remoteAgent.id);
                if (!localAgent) {
                    await db.createAgent(remoteAgent.name);
                } else if (remoteAgent.modifiedAt && localAgent.modifiedAt) {
                    if (new Date(remoteAgent.modifiedAt) > new Date(localAgent.modifiedAt)) {
                        await db.updateAgent(remoteAgent.id, remoteAgent.name);
                    }
                }
            }
        }
        onSync();
    });

    unsubscribers.push(agentUnsub);

    // Listen to settings collection
    const settingsRef = collection(firestore, getTenantCollectionPath('settings'));
    const settingsUnsub = onSnapshot(settingsRef, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            if (change.type === 'added' || change.type === 'modified') {
                const remoteSettings = change.doc.data();
                // Merge remote settings with local
                await db.updateSettings(remoteSettings as Partial<Settings>);
            }
        }
        onSync();
    });
    unsubscribers.push(settingsUnsub);

    // Listen to blockedNumbers collection
    const blockedRef = collection(firestore, getTenantCollectionPath('blockedNumbers'));
    const blockedUnsub = onSnapshot(blockedRef, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const remoteBlocked = change.doc.data() as BlockedNumber;
            if (change.type === 'added' || change.type === 'modified') {
                const local = await db.getBlockedNumber(remoteBlocked.id);
                if (!local) {
                    await db.createBlockedNumber(remoteBlocked as Omit<BlockedNumber, 'id'>);
                } else {
                    await db.updateBlockedNumber(remoteBlocked.id, remoteBlocked);
                }
            } else if (change.type === 'removed') {
                await db.deleteBlockedNumber(remoteBlocked.id);
            }
        }
        onSync();
    });
    unsubscribers.push(blockedUnsub);

    // Listen to lotteryResults collection
    const lotteryRef = collection(firestore, getTenantCollectionPath('lotteryResults'));
    const lotteryUnsub = onSnapshot(lotteryRef, async (snapshot) => {
        for (const change of snapshot.docChanges()) {
            const remoteResult = change.doc.data() as LotteryResult;
            if (change.type === 'added' || change.type === 'modified') {
                const local = await db.getLotteryResult(remoteResult.id);
                if (!local) {
                    await db.createLotteryResult(remoteResult as any);
                } else {
                    await db.updateLotteryResult(remoteResult.id, remoteResult);
                }
            } else if (change.type === 'removed') {
                await db.deleteLotteryResult(remoteResult.id);
            }
        }
        onSync();
    });
    unsubscribers.push(lotteryUnsub);

    console.log('Real-time sync started (full)');
}

export function stopRealtimeSync(): void {
    for (const unsub of unsubscribers) {
        unsub();
    }
    unsubscribers = [];
    console.log('Real-time sync stopped');
}

// =============================================================================
// Push Sync (for PushOnly and TwoWay)
// =============================================================================

export async function pushLocalChanges(): Promise<{ success: boolean; synced: number }> {
    if (!firestore) {
        return { success: false, synced: 0 };
    }

    const queue = await db.getSyncQueue();
    let synced = 0;

    const batch = writeBatch(firestore);

    try {
        for (const item of queue) {
            const collectionPath = getTenantCollectionPath(item.collection);
            const docRef = doc(firestore, collectionPath, (item.data as { id: string }).id);

            if (item.action === 'delete') {
                batch.delete(docRef);
            } else {
                batch.set(docRef, item.data as object);
            }
            synced++;
        }

        await batch.commit();
        await db.clearSyncQueue();

        return { success: true, synced };
    } catch (error) {
        console.error('Push sync failed:', error);
        return { success: false, synced: 0 };
    }
}

// =============================================================================
// Clear Remote Data (Factory Reset)
// =============================================================================

export async function clearRemoteData(): Promise<boolean> {
    if (!firestore) return false;

    try {
        const batch = writeBatch(firestore);
        let operationCount = 0;

        // Clear tickets
        const ticketsRef = collection(firestore, getTenantCollectionPath('tickets'));
        const ticketsSnapshot = await getDocs(ticketsRef);
        ticketsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            operationCount++;
        });

        // Clear agents (restored - can be deleted)
        const agentsRef = collection(firestore, getTenantCollectionPath('agents'));
        const agentsSnapshot = await getDocs(agentsRef);
        agentsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            operationCount++;
        });

        // KEEP SETTINGS - อัตราจ่าย
        // const settingsRef = collection(firestore, getTenantCollectionPath('settings'));
        // const settingsSnapshot = await getDocs(settingsRef);
        // settingsSnapshot.forEach((doc) => {
        //     batch.delete(doc.ref);
        //     operationCount++;
        // });

        // KEEP BLOCKED NUMBERS - เลขอั้น
        // const blockedRef = collection(firestore, getTenantCollectionPath('blockedNumbers'));
        // const blockedSnapshot = await getDocs(blockedRef);
        // blockedSnapshot.forEach((doc) => {
        //     batch.delete(doc.ref);
        //     operationCount++;
        // });

        // Clear lotteryResults
        const lotteryRef = collection(firestore, getTenantCollectionPath('lotteryResults'));
        const lotterySnapshot = await getDocs(lotteryRef);
        lotterySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            operationCount++;
        });

        if (operationCount > 0) {
            await batch.commit();
        }

        console.log(`Cleared ${operationCount} remote documents`);
        return true;
    } catch (error) {
        console.error('Failed to clear remote data:', error);
        return false;
    }
}

// =============================================================================
// Full Sync (download all remote data)
// =============================================================================

export async function pullRemoteData(
    conflictResolution: 'remote' | 'local'
): Promise<{ success: boolean; pulled: number }> {
    if (!firestore) {
        return { success: false, pulled: 0 };
    }

    let pulled = 0;

    try {
        // Pull tickets
        const ticketsRef = collection(firestore, getTenantCollectionPath('tickets'));
        const ticketsSnapshot = await getDocs(ticketsRef);

        for (const docSnap of ticketsSnapshot.docs) {
            const remoteTicket = docSnap.data() as Ticket;
            const localTicket = await db.getTicket(remoteTicket.id);

            if (!localTicket) {
                await db.createTicket(remoteTicket);
                pulled++;
            } else if (conflictResolution === 'remote') {
                const localTime = new Date(localTicket.modifiedAt).getTime();
                const remoteTime = new Date(remoteTicket.modifiedAt).getTime();

                if (remoteTime > localTime) {
                    await db.updateTicket(remoteTicket.id, remoteTicket);
                    pulled++;
                }
            }
        }

        // Pull agents
        const agentsRef = collection(firestore, getTenantCollectionPath('agents'));
        const agentsSnapshot = await getDocs(agentsRef);

        for (const docSnap of agentsSnapshot.docs) {
            const remoteAgent = docSnap.data() as Agent;
            const localAgent = await db.getAgent(remoteAgent.id);

            if (!localAgent) {
                await db.createAgent(remoteAgent.name);
                pulled++;
            }
        }

        // Pull blockedNumbers
        const blockedRef = collection(firestore, getTenantCollectionPath('blockedNumbers'));
        const blockedSnapshot = await getDocs(blockedRef);

        for (const docSnap of blockedSnapshot.docs) {
            const remoteBlocked = docSnap.data() as BlockedNumber;
            const localBlocked = await db.getBlockedNumber(remoteBlocked.id);

            if (!localBlocked) {
                await db.createBlockedNumber(remoteBlocked as Omit<BlockedNumber, 'id'>);
                pulled++;
            }
        }

        // Pull lotteryResults
        const lotteryRef = collection(firestore, getTenantCollectionPath('lotteryResults'));
        const lotterySnapshot = await getDocs(lotteryRef);

        for (const docSnap of lotterySnapshot.docs) {
            const remoteResult = docSnap.data() as LotteryResult;
            const localResult = await db.getLotteryResult(remoteResult.id);

            if (!localResult) {
                await db.createLotteryResult(remoteResult as any);
                pulled++;
            }
        }

        return { success: true, pulled };
    } catch (error) {
        console.error('Pull sync failed:', error);
        return { success: false, pulled: 0 };
    }
}

// =============================================================================
// Sync Manager
// =============================================================================

export interface SyncStatus {
    lastSync: string | null;
    pending: number;
    isOnline: boolean;
    isSyncing: boolean;
}

class SyncManager {
    private syncStatus: SyncStatus = {
        lastSync: null,
        pending: 0,
        isOnline: navigator.onLine,
        isSyncing: false,
    };

    private settings: Settings | null = null;
    private onStatusChange: ((status: SyncStatus) => void) | null = null;

    constructor() {
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    setOnStatusChange(callback: (status: SyncStatus) => void): void {
        this.onStatusChange = callback;
    }

    async initialize(settings: Settings): Promise<void> {
        this.settings = settings;

        if (settings.storageMode === 'Off') {
            stopRealtimeSync();
            return;
        }

        if (settings.firebaseConfig) {
            const initialized = initializeFirebase(settings.firebaseConfig);

            if (initialized && settings.storageMode === 'TwoWay') {
                startRealtimeSync(settings.conflictResolution, () => {
                    this.updateStatus({ lastSync: new Date().toISOString() });
                });
            }
        }

        await this.updatePendingCount();
    }

    private async handleOnline(): Promise<void> {
        this.updateStatus({ isOnline: true });

        if (this.settings?.storageMode !== 'Off') {
            await this.syncNow();
        }
    }

    private handleOffline(): void {
        this.updateStatus({ isOnline: false });
    }

    async syncNow(): Promise<{ success: boolean; pushed: number; pulled: number }> {
        if (!this.settings || this.settings.storageMode === 'Off') {
            return { success: false, pushed: 0, pulled: 0 };
        }

        this.updateStatus({ isSyncing: true });

        try {
            const pushResult = await pushLocalChanges();
            let pulled = 0;

            if (this.settings.storageMode === 'TwoWay') {
                const pullResult = await pullRemoteData(this.settings.conflictResolution);
                pulled = pullResult.pulled;
            }

            await this.updatePendingCount();

            this.updateStatus({
                isSyncing: false,
                lastSync: new Date().toISOString(),
            });

            return { success: true, pushed: pushResult.synced, pulled };
        } catch (error) {
            this.updateStatus({ isSyncing: false });
            console.error('Sync failed:', error);
            return { success: false, pushed: 0, pulled: 0 };
        }
    }

    private async updatePendingCount(): Promise<void> {
        const queue = await db.getSyncQueue();
        this.updateStatus({ pending: queue.length });
    }

    private updateStatus(partial: Partial<SyncStatus>): void {
        this.syncStatus = { ...this.syncStatus, ...partial };
        this.onStatusChange?.(this.syncStatus);
    }

    getStatus(): SyncStatus {
        return { ...this.syncStatus };
    }

    async clearRemoteData(): Promise<boolean> {
        return clearRemoteData();
    }
}

export const syncManager = new SyncManager();
