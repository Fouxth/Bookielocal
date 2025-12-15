/**
 * Export utilities for CSV and JSON
 */

import { Ticket, Summary, Agent, CATEGORY_LABELS } from '@shared/schemas';

/**
 * Convert tickets to CSV format
 */
export function ticketsToCSV(tickets: Ticket[], agents: Agent[]): string {
    const headers = [
        'Ticket ID',
        'Agent',
        'Date',
        'Round',
        'Category',
        'Raw Number',
        'Expanded Combos',
        'Unit Price',
        'Quantity',
        'Total',
        'Created At',
    ];

    const rows: string[][] = [headers];

    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    for (const ticket of tickets) {
        for (const entry of ticket.entries) {
            rows.push([
                ticket.id,
                agentMap.get(ticket.agentId) ?? 'Unknown',
                ticket.date,
                ticket.round,
                CATEGORY_LABELS[entry.category] ?? entry.category,
                entry.raw,
                (entry.expanded ?? []).join(' '),
                entry.unitPrice.toString(),
                entry.quantity.toString(),
                (entry.total ?? 0).toString(),
                ticket.createdAt,
            ]);
        }
    }

    return rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

/**
 * Convert summary to CSV format
 */
export function summaryToCSV(summary: Summary): string {
    const lines: string[] = [
        `Date,${summary.date}`,
        `Round,${summary.round ?? 'All'}`,
        '',
        'Overall Summary',
        `Gross,${summary.gross}`,
        `Expected Payout,${summary.expectedPayout}`,
        `Profit,${summary.profit}`,
        `Ticket Count,${summary.ticketCount}`,
        '',
        'Per Agent Breakdown',
        'Agent,Gross,Expected Payout,Profit,Ticket Count',
    ];

    for (const agent of summary.perAgent) {
        lines.push(
            `${agent.agentName},${agent.gross},${agent.expectedPayout},${agent.profit},${agent.ticketCount}`
        );
    }

    if (summary.riskyNumbers.length > 0) {
        lines.push('');
        lines.push('Risky Numbers');
        lines.push('Number,Category,Sold Amount,Threshold');
        for (const risky of summary.riskyNumbers) {
            lines.push(
                `${risky.combo},${CATEGORY_LABELS[risky.category]},${risky.soldAmount},${risky.threshold}`
            );
        }
    }

    return lines.join('\n');
}

/**
 * Download data as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export tickets as CSV
 */
export function exportTicketsCSV(tickets: Ticket[], agents: Agent[], filename?: string): void {
    const csv = ticketsToCSV(tickets, agents);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, filename ?? `tickets_${date}.csv`, 'text/csv');
}

/**
 * Export tickets as JSON
 */
export function exportTicketsJSON(tickets: Ticket[], filename?: string): void {
    const json = JSON.stringify(tickets, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, filename ?? `tickets_${date}.json`, 'application/json');
}

/**
 * Export summary as CSV
 */
export function exportSummaryCSV(summary: Summary, filename?: string): void {
    const csv = summaryToCSV(summary);
    downloadFile(
        csv,
        filename ?? `summary_${summary.date}_${summary.round ?? 'all'}.csv`,
        'text/csv'
    );
}

/**
 * Format currency (Thai Baht)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('th-TH').format(num);
}

/**
 * Format date in Thai locale
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}

/**
 * Format time
 */
export function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

/**
 * Format date and time (short)
 */
export function formatDateTimeShort(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
