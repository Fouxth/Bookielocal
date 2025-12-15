/**
 * Computation Logic
 * 
 * Handles all financial calculations for lottery entries, tickets, and summaries.
 */

import {
    Entry,
    Ticket,
    Settings,
    BlockedNumber,
    Category,
    PerComboTotal,
    Summary,
    AgentSummary,
    RiskyNumber,
    Agent,

} from '@shared/schemas';
import { isDateInDrawPeriod } from './drawPeriod';
import { expandNumber } from './expand';

/**
 * Find blocked number override for a specific combo and category
 */
function findBlockedNumber(
    combo: string,
    category: Category,
    blockedNumbers: BlockedNumber[]
): BlockedNumber | undefined {
    return blockedNumbers.find(
        (b) => b.number === combo && b.category === category && b.enabled
    );
}

/**
 * Computes the totals for a single entry, including expansion and per-combo breakdowns
 * 
 * @param entry - The entry to compute totals for
 * @param settings - Global settings containing payout rates
 * @param blockedNumbers - List of blocked numbers with override payouts
 * @returns Entry with computed expanded, perComboTotals, and total
 */
export function computeEntryTotals(
    entry: Omit<Entry, 'expanded' | 'perComboTotals' | 'total'>,
    settings: Settings,
    blockedNumbers: BlockedNumber[]
): Entry {
    const expanded = expandNumber(entry.raw, entry.category);

    // For tod/permutation categories, total is single price
    // But each combo soldAmount = full price (for payout calculation if that combo wins)
    const isTodCategory = entry.category === '3tod' || entry.category === '2tod';

    const perComboTotals: PerComboTotal[] = expanded.map((combo) => {
        const blocked = findBlockedNumber(combo, entry.category, blockedNumbers);
        const payoutRate = blocked?.payoutOverride ?? settings.payouts[entry.category];

        // Each combo gets full soldAmount for payout calculation
        const soldAmount = entry.unitPrice * entry.quantity;

        return {
            combo,
            unitPrice: entry.unitPrice,
            quantity: entry.quantity,
            soldAmount,
            payoutRate,
        };
    });

    // For tod: total = single price (what customer paid)
    // For others: total = sum of all combos (but usually just 1 combo)
    const total = isTodCategory
        ? entry.unitPrice * entry.quantity
        : perComboTotals.reduce((sum, combo) => sum + combo.soldAmount, 0);

    return {
        ...entry,
        expanded,
        perComboTotals,
        total,
    };
}

/**
 * Computes the grand total for a ticket (sum of all entry totals)
 */
export function computeTicketTotal(ticket: Ticket): number {
    return ticket.entries.reduce((sum, entry) => sum + (entry.total ?? 0), 0);
}

/**
 * Recalculates all entries in a ticket and updates billTotal
 */
export function recomputeTicket(
    ticket: Ticket,
    settings: Settings,
    blockedNumbers: BlockedNumber[]
): Ticket {
    const updatedEntries = ticket.entries.map((entry) =>
        computeEntryTotals(entry, settings, blockedNumbers)
    );

    const billTotal = updatedEntries.reduce((sum, entry) => sum + (entry.total ?? 0), 0);

    return {
        ...ticket,
        entries: updatedEntries,
        billTotal,
    };
}

/**
 * Calculates expected payout for a single entry
 * This is the amount we would need to pay if the number wins
 */
export function computeEntryExpectedPayout(entry: Entry): number {
    if (!entry.perComboTotals) return 0;

    return entry.perComboTotals.reduce((sum, combo) => {
        // Expected payout = payoutRate * unitPrice * quantity for each combo
        return sum + combo.payoutRate * combo.unitPrice * combo.quantity;
    }, 0);
}

/**
 * Calculates expected payout for an entire ticket
 */
export function computeTicketExpectedPayout(ticket: Ticket): number {
    return ticket.entries.reduce((sum, entry) => sum + computeEntryExpectedPayout(entry), 0);
}

/**
 * Aggregates sold amounts per combo across all tickets
 * Used for detecting risky numbers
 */
function aggregateComboSales(
    tickets: Ticket[]
): Map<string, { combo: string; category: Category; soldAmount: number }> {
    const comboMap = new Map<string, { combo: string; category: Category; soldAmount: number }>();

    for (const ticket of tickets) {
        if (ticket.deleted) continue;

        for (const entry of ticket.entries) {
            if (!entry.perComboTotals) continue;

            for (const comboTotal of entry.perComboTotals) {
                const key = `${entry.category}:${comboTotal.combo}`;
                const existing = comboMap.get(key);

                if (existing) {
                    existing.soldAmount += comboTotal.soldAmount;
                } else {
                    comboMap.set(key, {
                        combo: comboTotal.combo,
                        category: entry.category,
                        soldAmount: comboTotal.soldAmount,
                    });
                }
            }
        }
    }

    return comboMap;
}

/**
 * Find risky numbers (combos with sold amount exceeding threshold)
 */
export function findRiskyNumbers(
    tickets: Ticket[],
    threshold: number
): RiskyNumber[] {
    const comboSales = aggregateComboSales(tickets);
    const riskyNumbers: RiskyNumber[] = [];

    for (const [, data] of comboSales) {
        if (data.soldAmount > threshold) {
            riskyNumbers.push({
                combo: data.combo,
                category: data.category,
                soldAmount: data.soldAmount,
                threshold,
            });
        }
    }

    return riskyNumbers.sort((a, b) => b.soldAmount - a.soldAmount);
}

/**
 * Computes comprehensive summary for a set of tickets
 * 
 * @param tickets - Tickets to summarize
 * @param settings - Global settings
 * @param agents - List of agents for name lookup
 * @param date - Date filter
 * @param round - Optional round filter
 * @returns Summary object with all calculations
 */
export function computeSummary(
    tickets: Ticket[],
    settings: Settings,
    agents: Agent[],
    date: string,
    round?: string
): Summary {
    // Filter tickets
    const filteredTickets = tickets.filter((t) => {
        if (t.deleted) return false;
        // Support both draw period (range) and exact date filtering
        if (!isDateInDrawPeriod(t.date, date) && t.date !== date) return false;
        if (round && t.round !== round) return false;
        return true;
    });

    // Calculate totals
    let gross = 0;
    let expectedPayout = 0;

    // Agent aggregation
    const agentTotals = new Map<string, { gross: number; expectedPayout: number; ticketCount: number }>();

    for (const ticket of filteredTickets) {
        const ticketGross = ticket.billTotal;
        const ticketExpectedPayout = computeTicketExpectedPayout(ticket);

        gross += ticketGross;
        expectedPayout += ticketExpectedPayout;

        // Aggregate by agent
        const existing = agentTotals.get(ticket.agentId);
        if (existing) {
            existing.gross += ticketGross;
            existing.expectedPayout += ticketExpectedPayout;
            existing.ticketCount += 1;
        } else {
            agentTotals.set(ticket.agentId, {
                gross: ticketGross,
                expectedPayout: ticketExpectedPayout,
                ticketCount: 1,
            });
        }
    }

    // Build per-agent summaries
    const perAgent: AgentSummary[] = [];
    for (const [agentId, totals] of agentTotals) {
        const agent = agents.find((a) => a.id === agentId);
        perAgent.push({
            agentId,
            agentName: agent?.name ?? 'Unknown',
            gross: totals.gross,
            expectedPayout: totals.expectedPayout,
            profit: totals.gross - totals.expectedPayout,
            ticketCount: totals.ticketCount,
        });
    }

    // Sort by gross descending
    perAgent.sort((a, b) => b.gross - a.gross);

    // Find risky numbers
    const riskyNumbers = findRiskyNumbers(filteredTickets, settings.riskyThreshold);

    return {
        date,
        round,
        gross,
        expectedPayout,
        profit: gross - expectedPayout,
        ticketCount: filteredTickets.length,
        perAgent,
        riskyNumbers,
    };
}

/**
 * Merge duplicate entries in a ticket (same category + raw number)
 * Combines by summing unitPrice and quantity
 */
export function mergeDuplicateEntries(entries: Entry[]): Entry[] {
    const merged = new Map<string, Entry>();

    for (const entry of entries) {
        const key = `${entry.category}:${entry.raw}`;
        const existing = merged.get(key);

        if (existing) {
            // Merge: add quantities and keep the first id
            merged.set(key, {
                ...existing,
                quantity: existing.quantity + entry.quantity,
                // Recalculation needed after merge
                total: (existing.total ?? 0) + (entry.total ?? 0),
            });
        } else {
            merged.set(key, { ...entry });
        }
    }

    return Array.from(merged.values());
}

/**
 * Check if a combo exceeds the ceiling limit
 */
export function checkCeilingViolation(
    tickets: Ticket[],
    newEntry: Entry,
    settings: Settings
): { violated: boolean; combo: string; currentAmount: number; maxAmount: number } | null {
    const comboSales = aggregateComboSales(tickets);

    if (!newEntry.perComboTotals) return null;

    for (const comboTotal of newEntry.perComboTotals) {
        const key = `${newEntry.category}:${comboTotal.combo}`;
        const existing = comboSales.get(key);
        const currentAmount = (existing?.soldAmount ?? 0) + comboTotal.soldAmount;

        if (currentAmount > settings.ceilings.perComboMax) {
            return {
                violated: true,
                combo: comboTotal.combo,
                currentAmount,
                maxAmount: settings.ceilings.perComboMax,
            };
        }
    }

    return null;
}

/**
 * Calculate total amounts per number across all tickets for a given date
 * Used for ceiling alerts
 */
export interface NumberTotal {
    number: string;
    category: Category;
    totalAmount: number;
    exceedsCeiling: boolean;
}

export function getNumberTotals(
    tickets: Ticket[],
    date: string,
    perNumberMax: number
): Map<string, NumberTotal> {
    const numberMap = new Map<string, NumberTotal>();

    const filteredTickets = tickets.filter(
        (t) => !t.deleted && t.date === date
    );

    for (const ticket of filteredTickets) {
        for (const entry of ticket.entries) {
            const expanded = entry.expanded || [entry.raw];

            for (const num of expanded) {
                const key = `${entry.category}-${num}`;
                const perComboAmount = entry.perComboTotals?.find(
                    (p) => p.combo === num
                )?.soldAmount ?? entry.unitPrice;

                const existing = numberMap.get(key);
                if (existing) {
                    existing.totalAmount += perComboAmount;
                    existing.exceedsCeiling = existing.totalAmount >= perNumberMax;
                } else {
                    const total = perComboAmount;
                    numberMap.set(key, {
                        number: num,
                        category: entry.category,
                        totalAmount: total,
                        exceedsCeiling: total >= perNumberMax,
                    });
                }
            }
        }
    }

    return numberMap;
}

/**
 * Check if a specific number exceeds the ceiling
 */
export function checkNumberCeiling(
    number: string,
    category: Category,
    tickets: Ticket[],
    date: string,
    perNumberMax: number
): { exceeds: boolean; current: number; max: number } {
    const totals = getNumberTotals(tickets, date, perNumberMax);
    const key = `${category}-${number}`;
    const total = totals.get(key);

    return {
        exceeds: total?.exceedsCeiling ?? false,
        current: total?.totalAmount ?? 0,
        max: perNumberMax,
    };
}

