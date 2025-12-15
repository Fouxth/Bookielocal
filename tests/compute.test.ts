/**
 * Unit tests for computation logic
 */

import { describe, it, expect } from 'vitest';
import {
    computeEntryTotals,
    computeTicketTotal,
    computeEntryExpectedPayout,
    findRiskyNumbers,
    mergeDuplicateEntries,
} from '../frontend/src/lib/compute';
import { Entry, Settings, BlockedNumber, Ticket, DEFAULT_SETTINGS } from '../shared/schemas';
import { v4 as uuidv4 } from 'uuid';

const createEntry = (
    category: string,
    raw: string,
    unitPrice: number,
    quantity = 1
): Omit<Entry, 'expanded' | 'perComboTotals' | 'total'> => ({
    id: uuidv4(),
    category: category as Entry['category'],
    raw,
    unitPrice,
    quantity,
});

const settings: Settings = {
    ...DEFAULT_SETTINGS,
    payouts: {
        '3top': 800,
        '3tod': 130,
        '3down': 400,
        '3back': 130,
        '2top': 70,
        '2tod': 35,
        '2down': 70,
        '2back': 35,
    },
};

describe('computeEntryTotals', () => {
    describe('basic calculations', () => {
        it('should compute totals for 3top entry', () => {
            const entry = createEntry('3top', '123', 100);
            const result = computeEntryTotals(entry, settings, []);

            expect(result.expanded).toEqual(['123']);
            expect(result.perComboTotals).toHaveLength(1);
            expect(result.perComboTotals![0].combo).toBe('123');
            expect(result.perComboTotals![0].soldAmount).toBe(100);
            expect(result.perComboTotals![0].payoutRate).toBe(800);
            expect(result.total).toBe(100);
        });

        it('should compute totals for 3tod entry with 6 combos', () => {
            const entry = createEntry('3tod', '123', 10);
            const result = computeEntryTotals(entry, settings, []);

            expect(result.expanded).toHaveLength(6);
            expect(result.perComboTotals).toHaveLength(6);

            // Each combo should have soldAmount of 10
            result.perComboTotals!.forEach((combo) => {
                expect(combo.soldAmount).toBe(10);
                expect(combo.payoutRate).toBe(130);
            });

            // Total = 6 combos × 10 = 60
            expect(result.total).toBe(60);
        });

        it('should compute totals for 2tod entry with 2 combos', () => {
            const entry = createEntry('2tod', '12', 5);
            const result = computeEntryTotals(entry, settings, []);

            expect(result.expanded).toHaveLength(2);
            expect(result.perComboTotals).toHaveLength(2);

            // Each combo should have soldAmount of 5
            result.perComboTotals!.forEach((combo) => {
                expect(combo.soldAmount).toBe(5);
                expect(combo.payoutRate).toBe(35);
            });

            // Total = 2 combos × 5 = 10
            expect(result.total).toBe(10);
        });

        it('should multiply by quantity', () => {
            const entry = createEntry('3top', '123', 100, 3);
            const result = computeEntryTotals(entry, settings, []);

            expect(result.perComboTotals![0].quantity).toBe(3);
            expect(result.perComboTotals![0].soldAmount).toBe(300); // 100 × 3
            expect(result.total).toBe(300);
        });
    });

    describe('blocked number overrides', () => {
        it('should use override payout rate for blocked number', () => {
            const entry = createEntry('3top', '123', 100);
            const blockedNumbers: BlockedNumber[] = [
                {
                    id: 'b1',
                    number: '123',
                    category: '3top',
                    payoutOverride: 10,
                    enabled: true,
                },
            ];

            const result = computeEntryTotals(entry, settings, blockedNumbers);

            expect(result.perComboTotals![0].payoutRate).toBe(10); // Override
            expect(result.perComboTotals![0].soldAmount).toBe(100); // Sold amount unchanged
        });

        it('should not use disabled blocked number', () => {
            const entry = createEntry('3top', '123', 100);
            const blockedNumbers: BlockedNumber[] = [
                {
                    id: 'b1',
                    number: '123',
                    category: '3top',
                    payoutOverride: 10,
                    enabled: false, // Disabled
                },
            ];

            const result = computeEntryTotals(entry, settings, blockedNumbers);

            expect(result.perComboTotals![0].payoutRate).toBe(800); // Default
        });

        it('should not use blocked number for different category', () => {
            const entry = createEntry('3top', '123', 100);
            const blockedNumbers: BlockedNumber[] = [
                {
                    id: 'b1',
                    number: '123',
                    category: '3tod', // Different category
                    payoutOverride: 10,
                    enabled: true,
                },
            ];

            const result = computeEntryTotals(entry, settings, blockedNumbers);

            expect(result.perComboTotals![0].payoutRate).toBe(800); // Default
        });

        it('should apply blocked override to expanded combos in tod', () => {
            const entry = createEntry('3tod', '123', 10);
            const blockedNumbers: BlockedNumber[] = [
                {
                    id: 'b1',
                    number: '321',
                    category: '3tod',
                    payoutOverride: 50,
                    enabled: true,
                },
            ];

            const result = computeEntryTotals(entry, settings, blockedNumbers);

            // Find the 321 combo
            const blocked321 = result.perComboTotals!.find((c) => c.combo === '321');
            const other = result.perComboTotals!.find((c) => c.combo === '123');

            expect(blocked321?.payoutRate).toBe(50); // Override
            expect(other?.payoutRate).toBe(130); // Default
        });
    });
});

describe('computeEntryExpectedPayout', () => {
    it('should calculate expected payout correctly', () => {
        const entry = createEntry('3top', '123', 100);
        const computed = computeEntryTotals(entry, settings, []);

        const expectedPayout = computeEntryExpectedPayout(computed);

        // Expected payout = payoutRate × unitPrice × quantity
        // = 800 × 100 × 1 = 80,000
        expect(expectedPayout).toBe(80000);
    });

    it('should calculate expected payout for multi-combo entries', () => {
        const entry = createEntry('3tod', '123', 10);
        const computed = computeEntryTotals(entry, settings, []);

        const expectedPayout = computeEntryExpectedPayout(computed);

        // Expected payout = 6 × (130 × 10 × 1) = 7,800
        expect(expectedPayout).toBe(7800);
    });
});

describe('computeTicketTotal', () => {
    it('should sum all entry totals', () => {
        const ticket: Ticket = {
            id: 't1',
            agentId: 'a1',
            round: 'morning',
            date: '2024-01-01',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            modifiedAt: new Date().toISOString(),
            entries: [
                { ...createEntry('3top', '123', 100), total: 100, expanded: ['123'], perComboTotals: [] },
                { ...createEntry('2top', '12', 50), total: 50, expanded: ['12'], perComboTotals: [] },
            ],
            billTotal: 150,
            synced: false,
            deleted: false,
        };

        expect(computeTicketTotal(ticket)).toBe(150);
    });
});

describe('findRiskyNumbers', () => {
    it('should find numbers exceeding threshold', () => {
        const ticket: Ticket = {
            id: 't1',
            agentId: 'a1',
            round: 'morning',
            date: '2024-01-01',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            modifiedAt: new Date().toISOString(),
            entries: [
                {
                    ...createEntry('3top', '123', 6000),
                    total: 6000,
                    expanded: ['123'],
                    perComboTotals: [
                        { combo: '123', unitPrice: 6000, quantity: 1, soldAmount: 6000, payoutRate: 800 },
                    ],
                },
            ],
            billTotal: 6000,
            synced: false,
            deleted: false,
        };

        const risky = findRiskyNumbers([ticket], 5000);

        expect(risky).toHaveLength(1);
        expect(risky[0].combo).toBe('123');
        expect(risky[0].soldAmount).toBe(6000);
    });

    it('should aggregate sales across tickets', () => {
        const ticket1: Ticket = {
            id: 't1',
            agentId: 'a1',
            round: 'morning',
            date: '2024-01-01',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            modifiedAt: new Date().toISOString(),
            entries: [
                {
                    ...createEntry('3top', '123', 3000),
                    total: 3000,
                    expanded: ['123'],
                    perComboTotals: [
                        { combo: '123', unitPrice: 3000, quantity: 1, soldAmount: 3000, payoutRate: 800 },
                    ],
                },
            ],
            billTotal: 3000,
            synced: false,
            deleted: false,
        };

        const ticket2: Ticket = {
            id: 't2',
            agentId: 'a1',
            round: 'morning',
            date: '2024-01-01',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            modifiedAt: new Date().toISOString(),
            entries: [
                {
                    ...createEntry('3top', '123', 3000),
                    total: 3000,
                    expanded: ['123'],
                    perComboTotals: [
                        { combo: '123', unitPrice: 3000, quantity: 1, soldAmount: 3000, payoutRate: 800 },
                    ],
                },
            ],
            billTotal: 3000,
            synced: false,
            deleted: false,
        };

        const risky = findRiskyNumbers([ticket1, ticket2], 5000);

        expect(risky).toHaveLength(1);
        expect(risky[0].soldAmount).toBe(6000); // Aggregated
    });
});

describe('mergeDuplicateEntries', () => {
    it('should merge entries with same category and raw', () => {
        const entries: Entry[] = [
            { ...createEntry('3top', '123', 100), id: '1', total: 100, expanded: [], perComboTotals: [] },
            { ...createEntry('3top', '123', 50), id: '2', total: 50, expanded: [], perComboTotals: [] },
        ];

        const merged = mergeDuplicateEntries(entries);

        expect(merged).toHaveLength(1);
        expect(merged[0].quantity).toBe(2);
        expect(merged[0].total).toBe(150);
    });

    it('should not merge entries with different categories', () => {
        const entries: Entry[] = [
            { ...createEntry('3top', '123', 100), id: '1', total: 100, expanded: [], perComboTotals: [] },
            { ...createEntry('3tod', '123', 50), id: '2', total: 50, expanded: [], perComboTotals: [] },
        ];

        const merged = mergeDuplicateEntries(entries);

        expect(merged).toHaveLength(2);
    });
});
