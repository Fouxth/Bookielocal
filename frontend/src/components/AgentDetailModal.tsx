
import { useState } from 'react';
import { Ticket, LotteryResult, CATEGORY_LABELS, Category } from '@shared/schemas';
import { formatCurrency, formatDateTimeShort } from '../utils/export';
import { computeActualPayout } from '../lib/payout';

interface AgentDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentName: string;
    tickets: Ticket[];
    lotteryResult: LotteryResult | null;
}

export default function AgentDetailModal({
    isOpen,
    onClose,
    agentName,
    tickets,
    lotteryResult,
}: AgentDetailModalProps) {
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

    if (!isOpen) return null;

    const checkEntryWin = (category: Category, combo: string): boolean => {
        if (!lotteryResult) return false;
        const { threeTop, twoDown, threeTod3, threeTod4 } = lotteryResult;
        const twoTop = threeTop ? threeTop.slice(-2) : "";

        switch (category) {
            case '3top':
            case '3tod':
                return threeTop === combo;
            case '2top':
                return twoTop === combo;
            case '2down':
                return twoDown === combo;
            case '3down':
                return (threeTod3 === combo) || (threeTod4 === combo);
            default:
                return false;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                    &#8203;
                </span>

                <div className="inline-block align-bottom bg-white dark:bg-slate-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                    <div className="bg-white dark:bg-slate-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-slate-100 mb-4">
                                    รายละเอียดบิลของ: {agentName}
                                </h3>

                                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                                    {tickets.map((ticket) => {
                                        const payout = lotteryResult ? computeActualPayout([ticket], lotteryResult) : 0;
                                        const isWin = payout > 0;

                                        return (
                                            <div
                                                key={ticket.id}
                                                className={`card overflow-hidden transition-all duration-200 border ${isWin ? 'border-red-200 dark:border-red-900/50 bg-red-50/10' : 'border-gray-200 dark:border-slate-700'}`}
                                            >
                                                <div
                                                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50"
                                                    onClick={() => setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)}
                                                >
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <svg
                                                            className={`w-4 h-4 transition-transform ${expandedTicketId === ticket.id ? 'rotate-90' : ''}`}
                                                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                        <span className="text-sm text-gray-500 dark:text-slate-400">
                                                            {formatDateTimeShort(ticket.createdAt)}
                                                        </span>
                                                        <span className="text-sm font-medium">
                                                            {ticket.entries.length} รายการ
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-bold text-blue-600">
                                                            {formatCurrency(ticket.billTotal)}
                                                        </span>
                                                        {isWin && (
                                                            <span className="font-bold text-red-500">
                                                                ถูก {formatCurrency(payout)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {expandedTicketId === ticket.id && (
                                                    <div className="border-t border-gray-200 dark:border-slate-700 p-3 bg-gray-50/50 dark:bg-slate-800/50">
                                                        <div className="overflow-x-auto">
                                                            <table className="table w-full text-sm whitespace-nowrap">
                                                                <thead>
                                                                    <tr>
                                                                        <th>ประเภท</th>
                                                                        <th>เลข</th>
                                                                        <th>ยอดแทง</th>
                                                                        {lotteryResult && <th>สถานะ</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {ticket.entries.map((entry) => {
                                                                        // Check if any combo wins
                                                                        let winAmount = 0;
                                                                        let isEntryWin = false;

                                                                        if (lotteryResult && entry.perComboTotals) {
                                                                            for (const item of entry.perComboTotals) {
                                                                                if (checkEntryWin(entry.category, item.combo)) {
                                                                                    winAmount += item.payoutRate * item.unitPrice * item.quantity;
                                                                                    isEntryWin = true;
                                                                                }
                                                                            }
                                                                        }

                                                                        return (
                                                                            <tr key={entry.id} className={isEntryWin ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                                                                <td>{CATEGORY_LABELS[entry.category]}</td>
                                                                                <td className="font-mono">{entry.raw}</td>
                                                                                <td>{entry.total}</td>
                                                                                {lotteryResult && (
                                                                                    <td className={isEntryWin ? 'text-red-600 font-bold' : 'text-gray-400'}>
                                                                                        {isEntryWin ? `ถูก ${formatCurrency(winAmount)}` : '-'}
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-700/20 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-base font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={onClose}
                        >
                            ปิด
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
