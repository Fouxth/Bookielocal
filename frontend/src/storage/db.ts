/**
 * IndexedDB Storage Layer using localForage
 * 
 * Provides offline-first storage with versioned schema and CRUD operations.
 * Multi-tenant aware: Each tenant has isolated data in separate IndexedDB databases.
 */

import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import {
    Agent,
    Ticket,
    Settings,
    BlockedNumber,
    User,
    DEFAULT_SETTINGS,
} from '@shared/schemas';
import { hashPassword } from '../utils/crypto';

// Database version for migrations
const DB_VERSION = 1;

// =============================================================================
// Tenant-aware Store Management
// =============================================================================

let currentTenantSlug: string | null = null;

// Store instances (recreated when tenant changes)
let agentsStore: LocalForage;
let ticketsStore: LocalForage;
let settingsStore: LocalForage;
let blockedNumbersStore: LocalForage;
let usersStore: LocalForage;
let syncQueueStore: LocalForage;
let lotteryResultsStore: LocalForage;

/**
 * Get the database name for a tenant
 */
function getDbName(tenantSlug: string | null): string {
    return tenantSlug ? `bookielocal-${tenantSlug}` : 'bookielocal';
}

/**
 * Initialize or reinitialize stores for the current tenant
 */
function initializeStores(tenantSlug: string | null): void {
    const dbName = getDbName(tenantSlug);

    agentsStore = localforage.createInstance({
        name: dbName,
        storeName: 'agents',
        version: DB_VERSION,
    });

    ticketsStore = localforage.createInstance({
        name: dbName,
        storeName: 'tickets',
        version: DB_VERSION,
    });

    settingsStore = localforage.createInstance({
        name: dbName,
        storeName: 'settings',
        version: DB_VERSION,
    });

    blockedNumbersStore = localforage.createInstance({
        name: dbName,
        storeName: 'blockedNumbers',
        version: DB_VERSION,
    });

    usersStore = localforage.createInstance({
        name: dbName,
        storeName: 'users',
        version: DB_VERSION,
    });

    syncQueueStore = localforage.createInstance({
        name: dbName,
        storeName: 'syncQueue',
        version: DB_VERSION,
    });

    lotteryResultsStore = localforage.createInstance({
        name: dbName,
        storeName: 'lotteryResults',
        version: DB_VERSION,
    });

    console.log(`[DB] Stores initialized for tenant: ${tenantSlug || 'default'}`);
}

/**
 * Set current tenant and reinitialize stores
 * Call this when tenant changes (on login, switch, etc.)
 */
export function setDbTenant(tenantSlug: string | null): void {
    if (currentTenantSlug !== tenantSlug) {
        currentTenantSlug = tenantSlug;
        initializeStores(tenantSlug);
    }
}

/**
 * Get current tenant slug for DB
 */
export function getCurrentDbTenant(): string | null {
    return currentTenantSlug;
}

// Initialize with default (no tenant) on first load
initializeStores(null);

// =============================================================================
// Helper Functions
// =============================================================================

async function getAllFromStore<T>(store: LocalForage): Promise<T[]> {
    const items: T[] = [];
    await store.iterate<T, void>((value) => {
        items.push(value);
    });
    return items;
}

// =============================================================================
// Agents CRUD
// =============================================================================

export async function getAgents(): Promise<Agent[]> {
    return getAllFromStore<Agent>(agentsStore);
}

export async function getAgent(id: string): Promise<Agent | null> {
    return agentsStore.getItem<Agent>(id);
}

export async function createAgent(name: string): Promise<Agent> {
    const agent: Agent = {
        id: uuidv4(),
        name,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
    };
    await agentsStore.setItem(agent.id, agent);
    await addToSyncQueue('create', 'agents', agent);
    return agent;
}

export async function updateAgent(id: string, name: string): Promise<Agent | null> {
    const existing = await getAgent(id);
    if (!existing) return null;

    const updated: Agent = {
        ...existing,
        name,
        modifiedAt: new Date().toISOString(),
    };
    await agentsStore.setItem(id, updated);
    await addToSyncQueue('update', 'agents', updated);
    return updated;
}

export async function deleteAgent(id: string): Promise<boolean> {
    const existing = await getAgent(id);
    if (existing) {
        await addToSyncQueue('delete', 'agents', { id });
    }
    await agentsStore.removeItem(id);
    return true;
}

// =============================================================================
// Tickets CRUD
// =============================================================================

export async function getTickets(): Promise<Ticket[]> {
    const tickets = await getAllFromStore<Ticket>(ticketsStore);
    return tickets.filter((t) => !t.deleted);
}

export async function getTicketsByFilter(filter: {
    agentId?: string;
    date?: string;
    round?: string;
}): Promise<Ticket[]> {
    const tickets = await getTickets();
    return tickets.filter((t) => {
        if (filter.agentId && t.agentId !== filter.agentId) return false;
        if (filter.date && t.date !== filter.date) return false;
        if (filter.round && t.round !== filter.round) return false;
        return true;
    });
}

export async function getTicket(id: string): Promise<Ticket | null> {
    return ticketsStore.getItem<Ticket>(id);
}

export async function createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'modifiedAt' | 'synced' | 'deleted'>): Promise<Ticket> {
    const newTicket: Ticket = {
        ...ticket,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        synced: false,
        deleted: false,
    };
    await ticketsStore.setItem(newTicket.id, newTicket);
    await addToSyncQueue('create', 'tickets', newTicket);
    return newTicket;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket | null> {
    const existing = await getTicket(id);
    if (!existing) return null;

    const updated: Ticket = {
        ...existing,
        ...updates,
        id,
        modifiedAt: new Date().toISOString(),
        synced: false,
    };
    await ticketsStore.setItem(id, updated);
    await addToSyncQueue('update', 'tickets', updated);
    return updated;
}

export async function deleteTicket(id: string): Promise<boolean> {
    const existing = await getTicket(id);
    if (!existing) return false;

    // Soft delete for sync purposes
    const updated: Ticket = {
        ...existing,
        deleted: true,
        modifiedAt: new Date().toISOString(),
        synced: false,
    };
    await ticketsStore.setItem(id, updated);
    await addToSyncQueue('delete', 'tickets', updated);
    return true;
}

// =============================================================================
// Settings
// =============================================================================

const SETTINGS_KEY = 'appSettings';

// Read Firebase config from environment variables
function getFirebaseConfigFromEnv() {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

    if (!apiKey || !projectId) return undefined;

    return {
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };
}

// Storage mode is now forced to TwoWay if config exists


export async function getSettings(): Promise<Settings> {
    const settings = await settingsStore.getItem<Settings>(SETTINGS_KEY);

    if (settings) {
        // If settings exist but no firebaseConfig, try to get from env
        if (!settings.firebaseConfig) {
            settings.firebaseConfig = getFirebaseConfigFromEnv();
        }
        // Always force TwoWay sync if config is present (per user request)
        if (settings.firebaseConfig) {
            settings.storageMode = 'TwoWay';
        }
        return settings;
    }

    // Return default settings with env overrides
    // Return default settings with enforced TwoWay sync if config exists
    const defaults = { ...DEFAULT_SETTINGS };
    const firebaseConfig = getFirebaseConfigFromEnv();

    if (firebaseConfig) {
        defaults.storageMode = 'TwoWay';
        defaults.firebaseConfig = firebaseConfig;
    }

    return defaults;
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const existing = await getSettings();
    const updated: Settings = {
        ...existing,
        ...updates,
    };
    await settingsStore.setItem(SETTINGS_KEY, updated);
    await addToSyncQueue('update', 'settings', { id: SETTINGS_KEY, ...updated });
    return updated;
}

// =============================================================================
// Blocked Numbers CRUD
// =============================================================================

export async function getBlockedNumbers(): Promise<BlockedNumber[]> {
    return getAllFromStore<BlockedNumber>(blockedNumbersStore);
}

export async function getBlockedNumber(id: string): Promise<BlockedNumber | null> {
    return blockedNumbersStore.getItem<BlockedNumber>(id);
}

export async function createBlockedNumber(data: Omit<BlockedNumber, 'id'>): Promise<BlockedNumber> {
    const blocked: BlockedNumber = {
        ...data,
        id: uuidv4(),
    };
    await blockedNumbersStore.setItem(blocked.id, blocked);
    await addToSyncQueue('create', 'blockedNumbers', blocked);
    return blocked;
}

export async function updateBlockedNumber(id: string, updates: Partial<BlockedNumber>): Promise<BlockedNumber | null> {
    const existing = await getBlockedNumber(id);
    if (!existing) return null;

    const updated: BlockedNumber = {
        ...existing,
        ...updates,
        id,
    };
    await blockedNumbersStore.setItem(id, updated);
    await addToSyncQueue('update', 'blockedNumbers', updated);
    return updated;
}

export async function deleteBlockedNumber(id: string): Promise<boolean> {
    await addToSyncQueue('delete', 'blockedNumbers', { id });
    await blockedNumbersStore.removeItem(id);
    return true;
}

// =============================================================================
// Users CRUD
// =============================================================================

export async function getUsers(): Promise<User[]> {
    return getAllFromStore<User>(usersStore);
}

export async function getUser(id: string): Promise<User | null> {
    return usersStore.getItem<User>(id);
}

export async function getUserByUsername(username: string): Promise<User | null> {
    const users = await getUsers();
    return users.find((u) => u.username === username) ?? null;
}

export async function createUser(
    username: string,
    password: string,
    role: 'admin' | 'user',
    mustChangePassword = false
): Promise<User> {
    const passwordHash = await hashPassword(password);
    const user: User = {
        id: uuidv4(),
        username,
        passwordHash,
        role,
        mustChangePassword,
        createdAt: new Date().toISOString(),
    };
    await usersStore.setItem(user.id, user);
    return user;
}

export async function updateUserPassword(id: string, newPassword: string): Promise<boolean> {
    const user = await getUser(id);
    if (!user) return false;

    const passwordHash = await hashPassword(newPassword);
    const updated: User = {
        ...user,
        passwordHash,
        mustChangePassword: false,
    };
    await usersStore.setItem(id, updated);
    return true;
}

// =============================================================================
// Sync Queue
// =============================================================================

interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete';
    collection: string;
    data: unknown;
    timestamp: string;
}

async function addToSyncQueue(
    action: 'create' | 'update' | 'delete',
    collection: string,
    data: unknown
): Promise<void> {
    const item: SyncQueueItem = {
        id: uuidv4(),
        action,
        collection,
        data,
        timestamp: new Date().toISOString(),
    };
    await syncQueueStore.setItem(item.id, item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    return getAllFromStore<SyncQueueItem>(syncQueueStore);
}

export async function clearSyncQueue(): Promise<void> {
    await syncQueueStore.clear();
}

export async function removeSyncQueueItem(id: string): Promise<void> {
    await syncQueueStore.removeItem(id);
}

// =============================================================================
// Seed Data
// =============================================================================

export async function seedDemoData(): Promise<void> {
    const existingUsers = await getUsers();
    const adminUser = existingUsers.find(u => u.username === 'admin');

    if (adminUser) {
        // Enforce password for existing admin
        await updateUserPassword(adminUser.id, '654321');
        console.log('Admin password updated to default');
    } else {
        // Create default admin user if not exists
        await createUser('admin', '654321', 'admin', false);
        console.log('Default admin user created');
    }
}

// =============================================================================
// Export/Import
// =============================================================================

export interface ExportData {
    version: number;
    exportedAt: string;
    agents: Agent[];
    tickets: Ticket[];
    settings: Settings;
    blockedNumbers: BlockedNumber[];
}

export async function exportAllData(): Promise<ExportData> {
    const [agents, tickets, settings, blockedNumbers] = await Promise.all([
        getAgents(),
        getAllFromStore<Ticket>(ticketsStore), // Include deleted for full export
        getSettings(),
        getBlockedNumbers(),
    ]);

    return {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        agents,
        tickets,
        settings,
        blockedNumbers,
    };
}

export async function importData(data: ExportData): Promise<void> {
    // Clear existing data
    await Promise.all([
        agentsStore.clear(),
        ticketsStore.clear(),
        blockedNumbersStore.clear(),
    ]);

    // Import agents
    for (const agent of data.agents) {
        await agentsStore.setItem(agent.id, agent);
    }

    // Import tickets
    for (const ticket of data.tickets) {
        await ticketsStore.setItem(ticket.id, ticket);
    }

    // Import settings
    await settingsStore.setItem(SETTINGS_KEY, data.settings);

    // Import blocked numbers
    for (const blocked of data.blockedNumbers) {
        await blockedNumbersStore.setItem(blocked.id, blocked);
    }
}

// =============================================================================
// Clear All Data (for testing)
// =============================================================================

// =============================================================================
// Factory Reset (Clear All EXCEPT Users)
// =============================================================================

export async function factoryResetData(): Promise<void> {
    await Promise.all([
        agentsStore.clear(),
        ticketsStore.clear(),
        // settingsStore.clear(), // KEEP SETTINGS - อัตราจ่าย
        // blockedNumbersStore.clear(), // KEEP BLOCKED NUMBERS - เลขอั้น
        // usersStore.clear(), // KEEP USERS
        syncQueueStore.clear(),
        lotteryResultsStore.clear(),
    ]);
}

export async function clearAllData(): Promise<void> {
    await Promise.all([
        agentsStore.clear(),
        ticketsStore.clear(),
        settingsStore.clear(),
        blockedNumbersStore.clear(),
        usersStore.clear(),
        syncQueueStore.clear(),
        lotteryResultsStore.clear(),
    ]);
}

// =============================================================================
// Lottery Results CRUD (ประวัติผลหวย)
// =============================================================================

import { LotteryResult, CreateLotteryResult } from '@shared/schemas';

export async function getLotteryResults(): Promise<LotteryResult[]> {
    const items = await getAllFromStore<LotteryResult>(lotteryResultsStore);
    // Sort by date descending
    return items.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getLotteryResult(id: string): Promise<LotteryResult | null> {
    return lotteryResultsStore.getItem<LotteryResult>(id);
}

export async function getLotteryResultByDate(date: string, drawPeriod?: string): Promise<LotteryResult | null> {
    const items = await getLotteryResults();
    return items.find((r) => r.date === date && r.drawPeriod === drawPeriod) ?? null;
}

export async function createLotteryResult(data: CreateLotteryResult): Promise<LotteryResult> {
    const now = new Date().toISOString();
    const result: LotteryResult = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        modifiedAt: now,
    };
    await lotteryResultsStore.setItem(result.id, result);
    await addToSyncQueue('create', 'lotteryResults', result);
    return result;
}

export async function updateLotteryResult(id: string, updates: Partial<LotteryResult>): Promise<LotteryResult | null> {
    const existing = await getLotteryResult(id);
    if (!existing) return null;

    const updated: LotteryResult = {
        ...existing,
        ...updates,
        id: existing.id,
        createdAt: existing.createdAt,
        modifiedAt: new Date().toISOString(),
    };
    await lotteryResultsStore.setItem(id, updated);
    await addToSyncQueue('update', 'lotteryResults', updated);
    return updated;
}

export async function deleteLotteryResult(id: string): Promise<void> {
    await addToSyncQueue('delete', 'lotteryResults', { id });
    await lotteryResultsStore.removeItem(id);
}

