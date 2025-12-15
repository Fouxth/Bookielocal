import { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useIsAdmin } from '../store/authStore';
import { formatCurrency, formatTime, exportTicketsCSV, exportTicketsJSON } from '../utils/export';
import { CATEGORY_LABELS } from '@shared/schemas';
import { getDrawPeriodOptions, getCurrentDrawPeriod, isDateInDrawPeriod } from '../lib/drawPeriod';

export default function Tickets() {
    const tickets = useAppStore((state) => state.tickets);
    const agents = useAppStore((state) => state.agents);
    const deleteTicket = useAppStore((state) => state.deleteTicket);
    const isAdmin = useIsAdmin();

    const drawPeriodOptions = useMemo(() => getDrawPeriodOptions(12), []);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => getCurrentDrawPeriod().id);
    const [selectedAgent, setSelectedAgent] = useState<string>('');
    const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    const filteredTickets = useMemo(() => {
        return tickets
            .filter((t) => {
                if (selectedPeriod && !isDateInDrawPeriod(t.date, selectedPeriod)) return false;
                if (selectedAgent && t.agentId !== selectedAgent) return false;
                return true;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [tickets, selectedPeriod, selectedAgent]);

    const handleExportCSV = () => {
        exportTicketsCSV(filteredTickets, agents);
    };

    const handleExportJSON = () => {
        exportTicketsJSON(filteredTickets);
    };

    const handleDelete = async (id: string) => {
        await deleteTicket(id);
        setShowDeleteConfirm(null);
    };

    const agentMap = useMemo(() => {
        return new Map(agents.map((a) => [a.id, a.name]));
    }, [agents]);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                        รายการบิล
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400">
                        ดูและจัดการบิลทั้งหมด
                    </p>
                </div>

                <div className="flex gap-2">
                    <button onClick={handleExportCSV} className="btn-secondary btn-sm text-xs sm:text-sm">
                        📋 CSV
                    </button>
                    <button onClick={handleExportJSON} className="btn-secondary btn-sm text-xs sm:text-sm">
                        📦 JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-3 sm:p-4 mb-4 sm:mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                        <label className="label">งวดหวย</label>
                        <select
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="select"
                        >
                            <option value="">ทั้งหมด</option>
                            {drawPeriodOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    งวด {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">เจ้าที่ส่ง</label>
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="select"
                        >
                            <option value="">ทั้งหมด</option>
                            {agents.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tickets List */}
            <div className="space-y-3 sm:space-y-4">
                {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            className="card overflow-hidden transition-all duration-200 hover:shadow-md"
                        >
                            {/* Ticket Header */}
                            <div
                                className="p-3 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                onClick={() =>
                                    setExpandedTicketId(expandedTicketId === ticket.id ? null : ticket.id)
                                }
                            >
                                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                    <button className="p-1 flex-shrink-0">
                                        <svg
                                            className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${expandedTicketId === ticket.id ? 'rotate-90' : ''
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                            />
                                        </svg>
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-slate-100 truncate">
                                                {agentMap.get(ticket.agentId) ?? 'Unknown'}
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate">
                                            {ticket.date} • {formatTime(ticket.createdAt)} • {ticket.entries.length} รายการ
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                                    <span className="text-base sm:text-xl font-bold text-blue-600">
                                        {formatCurrency(ticket.billTotal)}
                                    </span>
                                    {isAdmin && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowDeleteConfirm(ticket.id);
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedTicketId === ticket.id && (
                                <div className="border-t border-gray-200 dark:border-slate-700 p-4 animate-slide-down">
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>ประเภท</th>
                                                    <th>เลข</th>
                                                    <th>ขยาย</th>
                                                    <th className="text-right">ราคา</th>
                                                    <th className="text-right">จำนวน</th>
                                                    <th className="text-right">รวม</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ticket.entries.map((entry) => (
                                                    <tr key={entry.id}>
                                                        <td>
                                                            <span className="badge-primary">
                                                                {CATEGORY_LABELS[entry.category]}
                                                            </span>
                                                        </td>
                                                        <td className="font-mono font-bold text-lg">{entry.raw}</td>
                                                        <td className="text-gray-500 dark:text-slate-400 text-sm">
                                                            {entry.expanded?.join(', ')}
                                                        </td>
                                                        <td className="text-right font-mono">
                                                            {formatCurrency(entry.unitPrice)}
                                                        </td>
                                                        <td className="text-right">{entry.quantity}</td>
                                                        <td className="text-right font-mono font-medium">
                                                            {formatCurrency(entry.total ?? 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-gray-50 dark:bg-slate-700/50">
                                                    <td colSpan={5} className="text-right font-medium">
                                                        ยอดรวม:
                                                    </td>
                                                    <td className="text-right font-mono font-bold text-lg text-blue-600">
                                                        {formatCurrency(ticket.billTotal)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-slate-400">
                                        <p>สร้างโดย: {ticket.createdBy}</p>
                                        <p>ID: {ticket.id}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="card p-12 text-center">
                        <div className="text-4xl mb-4">🎫</div>
                        <p className="text-gray-500 dark:text-slate-400">ไม่พบบิลที่ตรงกับเงื่อนไข</p>
                    </div>
                )}
            </div>

            {/* Summary */}
            {filteredTickets.length > 0 && (
                <div className="card p-4 mt-6 flex items-center justify-between">
                    <span className="text-gray-600 dark:text-slate-400">
                        แสดง {filteredTickets.length} บิล
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-slate-100">
                        รวม:{' '}
                        <span className="text-blue-600">
                            {formatCurrency(filteredTickets.reduce((sum, t) => sum + t.billTotal, 0))}
                        </span>
                    </span>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                ยืนยันการลบ
                            </h2>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600 dark:text-slate-400">
                                ต้องการลบบิลนี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={() => handleDelete(showDeleteConfirm)} className="btn-danger">
                                ลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
