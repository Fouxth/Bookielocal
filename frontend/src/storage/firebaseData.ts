/**
 * Firebase Data Layer
 * 
 * Primary data storage using Firebase Firestore.
 * All data is stored under tenants/{slug}/...
 * This replaces IndexedDB as the primary data store.
 */

import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    updateDoc,
    getDoc,
} from 'firebase/firestore';
import {
    Agent,
    Ticket,
    Settings,
    BlockedNumber,
    DEFAULT_SETTINGS,
} from '@shared/schemas';
import { getFirestoreInstance, getCurrentTenantId } from './sync';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Helper Functions
// =============================================================================

function getTenantPath(): string | null {
    const tenantId = getCurrentTenantId();
    if (!tenantId) {
        console.warn('No tenant selected - data operations will fail');
        return null;
    }
    return `tenants/${tenantId}`;
}

function getCollectionPath(collectionName: string): string {
    const tenantPath = getTenantPath();
    if (!tenantPath) {
        // Return a path that won't match anything - operations will be skipped
        return `_no_tenant_/${collectionName}`;
    }
    return `${tenantPath}/${collectionName}`;
}

// =============================================================================
// Agents
// =============================================================================

export async function getAgents(): Promise<Agent[]> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        console.warn('Firebase not initialized, returning empty agents');
        return [];
    }

    try {
        const agentsRef = collection(firestore, getCollectionPath('agents'));
        const q = query(agentsRef, orderBy('name'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Agent));
    } catch (error) {
        console.error('Failed to load agents:', error);
        return [];
    }
}

export async function createAgent(name: string): Promise<Agent> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        throw new Error('Firebase not initialized');
    }

    const agent: Agent = {
        id: uuidv4(),
        name,
    };

    await setDoc(doc(firestore, getCollectionPath('agents'), agent.id), agent);
    return agent;
}

export async function updateAgent(id: string, name: string): Promise<Agent | null> {
    const firestore = getFirestoreInstance();
    if (!firestore) return null;

    const agentRef = doc(firestore, getCollectionPath('agents'), id);
    await updateDoc(agentRef, { name });
    return { id, name };
}

export async function deleteAgent(id: string): Promise<void> {
    const firestore = getFirestoreInstance();
    if (!firestore) return;

    await deleteDoc(doc(firestore, getCollectionPath('agents'), id));
}

// =============================================================================
// Tickets
// =============================================================================

export async function getTickets(): Promise<Ticket[]> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        console.warn('Firebase not initialized, returning empty tickets');
        return [];
    }

    try {
        const ticketsRef = collection(firestore, getCollectionPath('tickets'));
        const q = query(ticketsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Ticket))
            .filter(t => !t.deleted);
    } catch (error) {
        console.error('Failed to load tickets:', error);
        return [];
    }
}

export async function createTicket(
    ticketData: Omit<Ticket, 'id' | 'createdAt' | 'modifiedAt' | 'synced' | 'deleted'>
): Promise<Ticket> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        throw new Error('Firebase not initialized');
    }

    const now = new Date().toISOString();
    const ticket: Ticket = {
        ...ticketData,
        id: uuidv4(),
        createdAt: now,
        modifiedAt: now,
        synced: true,
        deleted: false,
    };

    await setDoc(doc(firestore, getCollectionPath('tickets'), ticket.id), ticket);
    return ticket;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const firestore = getFirestoreInstance();
    if (!firestore) return null;

    const ticketRef = doc(firestore, getCollectionPath('tickets'), id);
    const updatedData = {
        ...updates,
        modifiedAt: new Date().toISOString(),
    };

    await updateDoc(ticketRef, updatedData);

    const updatedDoc = await getDoc(ticketRef);
    if (updatedDoc.exists()) {
        return { id: updatedDoc.id, ...updatedDoc.data() } as Ticket;
    }
    return null;
}

export async function deleteTicket(id: string): Promise<void> {
    const firestore = getFirestoreInstance();
    if (!firestore) return;

    // Soft delete
    const ticketRef = doc(firestore, getCollectionPath('tickets'), id);
    await updateDoc(ticketRef, {
        deleted: true,
        modifiedAt: new Date().toISOString()
    });
}

// =============================================================================
// Settings
// =============================================================================

export async function getSettings(): Promise<Settings> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        return DEFAULT_SETTINGS;
    }

    try {
        const settingsRef = doc(firestore, getCollectionPath('settings'), 'main');
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
            return { ...DEFAULT_SETTINGS, ...settingsDoc.data() } as Settings;
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Failed to load settings:', error);
        return DEFAULT_SETTINGS;
    }
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        return { ...DEFAULT_SETTINGS, ...updates };
    }

    const settingsRef = doc(firestore, getCollectionPath('settings'), 'main');
    const currentSettings = await getSettings();
    const newSettings = { ...currentSettings, ...updates };

    await setDoc(settingsRef, newSettings, { merge: true });
    return newSettings;
}

// =============================================================================
// Blocked Numbers
// =============================================================================

export async function getBlockedNumbers(): Promise<BlockedNumber[]> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        return [];
    }

    try {
        const blockedRef = collection(firestore, getCollectionPath('blockedNumbers'));
        const snapshot = await getDocs(blockedRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlockedNumber));
    } catch (error) {
        console.error('Failed to load blocked numbers:', error);
        return [];
    }
}

export async function createBlockedNumber(data: Omit<BlockedNumber, 'id'>): Promise<BlockedNumber> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        throw new Error('Firebase not initialized');
    }

    const blocked: BlockedNumber = {
        ...data,
        id: uuidv4(),
    };

    await setDoc(doc(firestore, getCollectionPath('blockedNumbers'), blocked.id), blocked);
    return blocked;
}

export async function updateBlockedNumber(id: string, updates: Partial<BlockedNumber>): Promise<BlockedNumber | null> {
    const firestore = getFirestoreInstance();
    if (!firestore) return null;

    const blockedRef = doc(firestore, getCollectionPath('blockedNumbers'), id);
    await updateDoc(blockedRef, updates);

    const updatedDoc = await getDoc(blockedRef);
    if (updatedDoc.exists()) {
        return { id: updatedDoc.id, ...updatedDoc.data() } as BlockedNumber;
    }
    return null;
}

export async function deleteBlockedNumber(id: string): Promise<void> {
    const firestore = getFirestoreInstance();
    if (!firestore) return;

    await deleteDoc(doc(firestore, getCollectionPath('blockedNumbers'), id));
}

// =============================================================================
// Lottery Results
// =============================================================================

import { LotteryResult } from '@shared/schemas';

export async function getLotteryResults(): Promise<LotteryResult[]> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        return [];
    }

    try {
        const resultsRef = collection(firestore, getCollectionPath('lotteryResults'));
        const q = query(resultsRef, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LotteryResult));
    } catch (error) {
        console.error('Failed to load lottery results:', error);
        return [];
    }
}

export async function saveLotteryResult(result: LotteryResult): Promise<LotteryResult> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        throw new Error('Firebase not initialized');
    }

    const resultId = result.id || `${result.date}`;
    const resultWithId = { ...result, id: resultId };

    await setDoc(doc(firestore, getCollectionPath('lotteryResults'), resultId), resultWithId);
    return resultWithId;
}

export async function getLotteryResultByDate(drawDate: string): Promise<LotteryResult | null> {
    const firestore = getFirestoreInstance();
    if (!firestore) return null;

    try {
        const resultRef = doc(firestore, getCollectionPath('lotteryResults'), drawDate);
        const resultDoc = await getDoc(resultRef);

        if (resultDoc.exists()) {
            return { id: resultDoc.id, ...resultDoc.data() } as LotteryResult;
        }
        return null;
    } catch (error) {
        console.error('Failed to load lottery result:', error);
        return null;
    }
}

export async function createLotteryResult(data: { date: string } & Partial<LotteryResult>): Promise<LotteryResult> {
    const firestore = getFirestoreInstance();
    if (!firestore) {
        throw new Error('Firebase not initialized');
    }

    // Use date as ID for easy lookup
    const resultId = data.date;
    const now = new Date().toISOString();
    const result: LotteryResult = {
        id: resultId,
        date: data.date,
        createdAt: now,
        modifiedAt: now,
        firstPrize: data.firstPrize, // Full 6-digit first prize
        threeTop: data.threeTop,
        threeDown: data.threeDown,
        twoDown: data.twoDown,
        threeTod1: data.threeTod1,
        threeTod2: data.threeTod2,
        threeTod3: data.threeTod3,
        threeTod4: data.threeTod4,
    };

    await setDoc(doc(firestore, getCollectionPath('lotteryResults'), resultId), result);
    return result;
}

export async function updateLotteryResult(id: string, updates: Partial<LotteryResult>): Promise<LotteryResult | null> {
    const firestore = getFirestoreInstance();
    if (!firestore) return null;

    try {
        const resultRef = doc(firestore, getCollectionPath('lotteryResults'), id);
        const existing = await getDoc(resultRef);

        if (!existing.exists()) return null;

        const updated = { ...existing.data(), ...updates, id };
        await setDoc(resultRef, updated);
        return updated as LotteryResult;
    } catch (error) {
        console.error('Failed to update lottery result:', error);
        return null;
    }
}

export async function deleteLotteryResult(id: string): Promise<void> {
    const firestore = getFirestoreInstance();
    if (!firestore) return;

    await deleteDoc(doc(firestore, getCollectionPath('lotteryResults'), id));
}
