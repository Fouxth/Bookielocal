/**
 * App Store
 * 
 * Main application state for agents, tickets, settings, and blocked numbers.
 * Uses Firebase Firestore as primary data storage.
 * Includes undo functionality.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
    Agent,
    Ticket,
    Entry,
    Settings,
    BlockedNumber,
    DEFAULT_SETTINGS,
    Category,
} from '@shared/schemas';
// Use Firebase as primary storage (not IndexedDB)
import * as db from '../storage/firebaseData';
import { syncManager, SyncStatus } from '../storage/sync';
import { computeEntryTotals } from '../lib/compute';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

interface UndoAction {
    type: 'CREATE_TICKET' | 'UPDATE_TICKET' | 'DELETE_TICKET';
    data: Ticket;
    timestamp: number;
}

interface AppState {
    // Data
    agents: Agent[];
    tickets: Ticket[];
    settings: Settings;
    blockedNumbers: BlockedNumber[];

    // UI State
    isLoading: boolean;
    syncStatus: SyncStatus;
    undoStack: UndoAction[];

    // Current ticket entry state
    currentTicket: {
        agentId: string;
        round: string;
        date: string;
        drawPeriod?: string;
        entries: Entry[];
    } | null;

    // Actions - Loading
    loadAll: () => Promise<void>;

    // Actions - Agents
    loadAgents: () => Promise<void>;
    createAgent: (name: string) => Promise<Agent>;
    updateAgent: (id: string, name: string) => Promise<void>;
    deleteAgent: (id: string) => Promise<void>;

    // Actions - Tickets
    loadTickets: () => Promise<void>;
    createTicket: (ticket: Omit<Ticket, 'id' | 'createdAt' | 'modifiedAt' | 'synced' | 'deleted'>) => Promise<Ticket>;
    updateTicket: (id: string, updates: Partial<Ticket>) => Promise<void>;
    deleteTicket: (id: string) => Promise<void>;

    // Actions - Settings
    loadSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;

    // Actions - Blocked Numbers
    loadBlockedNumbers: () => Promise<void>;
    createBlockedNumber: (data: Omit<BlockedNumber, 'id'>) => Promise<void>;
    updateBlockedNumber: (id: string, updates: Partial<BlockedNumber>) => Promise<void>;
    deleteBlockedNumber: (id: string) => Promise<void>;

    // Actions - Current Ticket Entry
    initCurrentTicket: (agentId: string, round: string, date: string, drawPeriod?: string) => void;
    addEntry: (category: Category, raw: string, unitPrice: number, quantity?: number, withReverse?: boolean) => void;
    updateEntry: (entryId: string, updates: Partial<Entry>) => void;
    removeEntry: (entryId: string) => void;
    clearCurrentTicket: () => void;
    saveCurrentTicket: (createdBy: string) => Promise<Ticket | null>;

    // Actions - Undo
    undo: () => Promise<boolean>;

    // Actions - Sync
    syncNow: () => Promise<void>;
    setSyncStatus: (status: SyncStatus) => void;
}

// =============================================================================
// Store
// =============================================================================

export const useAppStore = create<AppState>()(
    immer((set, get) => ({
        // Initial state
        agents: [],
        tickets: [],
        settings: DEFAULT_SETTINGS,
        blockedNumbers: [],
        isLoading: true,
        syncStatus: {
            lastSync: null,
            pending: 0,
            isOnline: navigator.onLine,
            isSyncing: false,
        },
        undoStack: [],
        currentTicket: null,

        // ==========================================================================
        // Loading
        // ==========================================================================

        loadAll: async () => {
            set((state) => {
                state.isLoading = true;
            });

            await Promise.all([
                get().loadAgents(),
                get().loadTickets(),
                get().loadSettings(),
                get().loadBlockedNumbers(),
            ]);

            // Initialize sync manager
            const settings = get().settings;
            await syncManager.initialize(settings);
            syncManager.setOnStatusChange((status) => get().setSyncStatus(status));

            set((state) => {
                state.isLoading = false;
            });
        },

        // ==========================================================================
        // Agents
        // ==========================================================================

        loadAgents: async () => {
            const agents = await db.getAgents();
            set((state) => {
                state.agents = agents;
            });
        },

        createAgent: async (name: string) => {
            const agent = await db.createAgent(name);
            set((state) => {
                state.agents.push(agent);
            });
            return agent;
        },

        updateAgent: async (id: string, name: string) => {
            const updated = await db.updateAgent(id, name);
            if (updated) {
                set((state) => {
                    const index = state.agents.findIndex((a) => a.id === id);
                    if (index >= 0) {
                        state.agents[index] = updated;
                    }
                });
            }
        },

        deleteAgent: async (id: string) => {
            await db.deleteAgent(id);
            set((state) => {
                state.agents = state.agents.filter((a) => a.id !== id);
            });
        },

        // ==========================================================================
        // Tickets
        // ==========================================================================

        loadTickets: async () => {
            const tickets = await db.getTickets();
            set((state) => {
                state.tickets = tickets;
            });
        },

        createTicket: async (ticketData) => {
            const ticket = await db.createTicket(ticketData);

            set((state) => {
                state.tickets.push(ticket);
                // Add to undo stack
                state.undoStack.push({
                    type: 'CREATE_TICKET',
                    data: ticket,
                    timestamp: Date.now(),
                });
                // Keep only last 10 undo actions
                if (state.undoStack.length > 10) {
                    state.undoStack.shift();
                }
            });

            return ticket;
        },

        updateTicket: async (id: string, updates: Partial<Ticket>) => {
            const current = get().tickets.find((t) => t.id === id);
            if (!current) return;

            const updated = await db.updateTicket(id, updates);

            if (updated) {
                set((state) => {
                    const index = state.tickets.findIndex((t) => t.id === id);
                    if (index >= 0) {
                        // Store old version for undo
                        state.undoStack.push({
                            type: 'UPDATE_TICKET',
                            data: current,
                            timestamp: Date.now(),
                        });
                        if (state.undoStack.length > 10) {
                            state.undoStack.shift();
                        }

                        state.tickets[index] = updated;
                    }
                });
            }
        },

        deleteTicket: async (id: string) => {
            const current = get().tickets.find((t) => t.id === id);
            if (!current) return;

            await db.deleteTicket(id);

            set((state) => {
                // Store for undo
                state.undoStack.push({
                    type: 'DELETE_TICKET',
                    data: current,
                    timestamp: Date.now(),
                });
                if (state.undoStack.length > 10) {
                    state.undoStack.shift();
                }

                state.tickets = state.tickets.filter((t) => t.id !== id);
            });
        },

        // ==========================================================================
        // Settings
        // ==========================================================================

        loadSettings: async () => {
            const settings = await db.getSettings();
            set((state) => {
                state.settings = settings;
            });
        },

        updateSettings: async (updates: Partial<Settings>) => {
            const settings = await db.updateSettings(updates);
            set((state) => {
                state.settings = settings;
            });

            // Reinitialize sync if storage mode changed
            if (updates.storageMode || updates.firebaseConfig) {
                await syncManager.initialize(settings);
            }
        },

        // ==========================================================================
        // Blocked Numbers
        // ==========================================================================

        loadBlockedNumbers: async () => {
            const blockedNumbers = await db.getBlockedNumbers();
            set((state) => {
                state.blockedNumbers = blockedNumbers;
            });
        },

        createBlockedNumber: async (data) => {
            const blocked = await db.createBlockedNumber(data);
            set((state) => {
                state.blockedNumbers.push(blocked);
            });
        },

        updateBlockedNumber: async (id: string, updates: Partial<BlockedNumber>) => {
            const updated = await db.updateBlockedNumber(id, updates);
            if (updated) {
                set((state) => {
                    const index = state.blockedNumbers.findIndex((b) => b.id === id);
                    if (index >= 0) {
                        state.blockedNumbers[index] = updated;
                    }
                });
            }
        },

        deleteBlockedNumber: async (id: string) => {
            await db.deleteBlockedNumber(id);
            set((state) => {
                state.blockedNumbers = state.blockedNumbers.filter((b) => b.id !== id);
            });
        },

        // ==========================================================================
        // Current Ticket Entry
        // ==========================================================================

        initCurrentTicket: (agentId: string, round: string, date: string, drawPeriod?: string) => {
            set((state) => {
                state.currentTicket = {
                    agentId,
                    round,
                    date,
                    drawPeriod,
                    entries: [],
                };
            });
        },

        addEntry: (category: Category, raw: string, unitPrice: number, quantity = 1, withReverse = false) => {
            const { settings, blockedNumbers, currentTicket } = get();
            if (!currentTicket) return;

            try {
                // Calculate expanded numbers
                let expanded: string[];
                if (withReverse && (category === '2top' || category === '2down') && raw.length === 2) {
                    // For 2-digit with reverse: include both original and reversed
                    const reversed = raw[1] + raw[0];
                    if (raw === reversed) {
                        expanded = [raw]; // Same digits like 55
                    } else {
                        expanded = [raw, reversed].sort();
                    }
                } else {
                    // Normal expansion based on category
                    expanded = undefined as unknown as string[]; // Will be computed by computeEntryTotals
                }

                // Create entry with computed totals
                const baseEntry = {
                    id: uuidv4(),
                    category,
                    raw,
                    unitPrice,
                    quantity,
                };

                let entry: Entry;
                if (expanded) {
                    // Custom expanded (withReverse) - each combo shows full price for payout
                    // But total = single price (what customer paid)
                    const perComboTotals = expanded.map((combo) => {
                        const blocked = blockedNumbers.find(
                            (b) => b.number === combo && b.category === category && b.enabled
                        );
                        const payoutRate = blocked?.payoutOverride ?? settings.payouts[category];
                        // Full soldAmount per combo for payout calculation
                        const soldAmount = unitPrice * quantity;
                        return {
                            combo,
                            unitPrice,
                            quantity,
                            soldAmount,
                            payoutRate,
                        };
                    });
                    // Total is single price, not multiplied by combo count
                    const total = unitPrice * quantity;
                    entry = {
                        ...baseEntry,
                        expanded,
                        perComboTotals,
                        total,
                    };
                } else {
                    entry = computeEntryTotals(baseEntry, settings, blockedNumbers);
                }

                set((state) => {
                    if (!state.currentTicket) return;

                    // Check for duplicates if merge is enabled
                    if (state.settings.mergeDuplicates) {
                        const existingIndex = state.currentTicket.entries.findIndex(
                            (e) => e.category === category && e.raw === raw
                        );

                        if (existingIndex >= 0) {
                            // Merge: add quantities
                            const existing = state.currentTicket.entries[existingIndex];
                            const newQuantity = existing.quantity + quantity;

                            const merged = computeEntryTotals(
                                {
                                    ...existing,
                                    quantity: newQuantity,
                                },
                                state.settings,
                                state.blockedNumbers
                            );

                            state.currentTicket.entries[existingIndex] = merged;
                            return;
                        }
                    }

                    state.currentTicket.entries.push(entry);
                });
            } catch (error) {
                console.error('Failed to add entry:', error);
            }
        },

        updateEntry: (entryId: string, updates: Partial<Entry>) => {
            set((state) => {
                if (!state.currentTicket) return;

                const index = state.currentTicket.entries.findIndex((e) => e.id === entryId);
                if (index < 0) return;

                const existing = state.currentTicket.entries[index];
                const updated = computeEntryTotals(
                    {
                        ...existing,
                        ...updates,
                        id: entryId,
                    },
                    state.settings,
                    state.blockedNumbers
                );

                state.currentTicket.entries[index] = updated;
            });
        },

        removeEntry: (entryId: string) => {
            set((state) => {
                if (!state.currentTicket) return;
                state.currentTicket.entries = state.currentTicket.entries.filter(
                    (e) => e.id !== entryId
                );
            });
        },

        clearCurrentTicket: () => {
            set((state) => {
                state.currentTicket = null;
            });
        },

        saveCurrentTicket: async (createdBy: string) => {
            const { currentTicket, createTicket } = get();
            if (!currentTicket || currentTicket.entries.length === 0) return null;

            const billTotal = currentTicket.entries.reduce(
                (sum, e) => sum + (e.total ?? 0),
                0
            );

            const ticket = await createTicket({
                agentId: currentTicket.agentId,
                round: currentTicket.round,
                date: currentTicket.date,
                drawPeriod: currentTicket.drawPeriod,
                createdBy,
                entries: currentTicket.entries,
                billTotal,
            });

            set((state) => {
                state.currentTicket = null;
            });

            return ticket;
        },

        // ==========================================================================
        // Undo
        // ==========================================================================

        undo: async () => {
            const { undoStack } = get();
            if (undoStack.length === 0) return false;

            const lastAction = undoStack[undoStack.length - 1];

            switch (lastAction.type) {
                case 'CREATE_TICKET':
                    // Undo create = delete
                    await db.deleteTicket(lastAction.data.id);
                    set((state) => {
                        state.tickets = state.tickets.filter((t) => t.id !== lastAction.data.id);
                        state.undoStack.pop();
                    });
                    break;

                case 'UPDATE_TICKET':
                    // Undo update = restore previous version
                    await db.updateTicket(lastAction.data.id, lastAction.data);
                    set((state) => {
                        const index = state.tickets.findIndex((t) => t.id === lastAction.data.id);
                        if (index >= 0) {
                            state.tickets[index] = lastAction.data;
                        }
                        state.undoStack.pop();
                    });
                    break;

                case 'DELETE_TICKET':
                    // Undo delete = restore ticket
                    await db.createTicket(lastAction.data);
                    set((state) => {
                        state.tickets.push(lastAction.data);
                        state.undoStack.pop();
                    });
                    break;
            }

            return true;
        },

        // ==========================================================================
        // Sync
        // ==========================================================================

        syncNow: async () => {
            await syncManager.syncNow();
            // Reload data after sync
            await get().loadTickets();
            await get().loadAgents();
        },

        setSyncStatus: (status: SyncStatus) => {
            set((state) => {
                state.syncStatus = status;
            });
        },
    }))
);

// =============================================================================
// Selectors
// =============================================================================

export const selectAgentById = (id: string) => (state: AppState) =>
    state.agents.find((a) => a.id === id);

export const selectTicketsByDate = (date: string) => (state: AppState) =>
    state.tickets.filter((t) => t.date === date);

export const selectTicketsByAgent = (agentId: string) => (state: AppState) =>
    state.tickets.filter((t) => t.agentId === agentId);

export const selectCurrentTicketTotal = () => (state: AppState) =>
    state.currentTicket?.entries.reduce((sum, e) => sum + (e.total ?? 0), 0) ?? 0;
