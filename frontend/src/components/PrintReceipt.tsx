import { Ticket, CATEGORY_LABELS } from '@shared/schemas';
import { formatCurrency } from '../utils/export';

interface PrintReceiptProps {
    ticket: Ticket;
    agentName: string;
    onClose: () => void;
}

export default function PrintReceipt({ ticket, agentName, onClose }: PrintReceiptProps) {
    const handlePrint = () => {
        window.print();
    };

    const roundLabels: Record<string, string> = {
        morning: 'เช้า',
        afternoon: 'บ่าย',
        evening: 'เย็น',
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Print Content */}
                <div id="receipt-content" className="p-6 print:p-4">
                    {/* Header */}
                    <div className="text-center border-b-2 border-dashed border-gray-300 dark:border-slate-600 pb-4 mb-4">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                            📋 ใบเสร็จหวย
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                            BookieLocal
                        </p>
                    </div>

                    {/* Info */}
                    <div className="space-y-2 mb-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">เลขที่บิล:</span>
                            <span className="font-mono text-gray-900 dark:text-slate-100">
                                {ticket.id.slice(0, 8).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">เจ้าที่ส่ง:</span>
                            <span className="font-medium text-gray-900 dark:text-slate-100">
                                {agentName}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">วันที่:</span>
                            <span className="text-gray-900 dark:text-slate-100">{ticket.date}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">รอบ:</span>
                            <span className="text-gray-900 dark:text-slate-100">
                                {roundLabels[ticket.round] || ticket.round}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-slate-400">เวลา:</span>
                            <span className="text-gray-900 dark:text-slate-100">
                                {new Date(ticket.createdAt).toLocaleTimeString('th-TH')}
                            </span>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 dark:border-slate-600 my-4" />

                    {/* Entries */}
                    <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">
                            <span>ประเภท/เลข</span>
                            <span>ราคา</span>
                        </div>
                        {ticket.entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex justify-between items-center py-1"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                        {CATEGORY_LABELS[entry.category]}
                                    </span>
                                    <span className="font-mono font-bold text-lg text-gray-900 dark:text-slate-100">
                                        {entry.raw}
                                    </span>
                                    {entry.quantity > 1 && (
                                        <span className="text-xs text-gray-500 dark:text-slate-400">
                                            ×{entry.quantity}
                                        </span>
                                    )}
                                </div>
                                <span className="font-medium text-gray-900 dark:text-slate-100">
                                    {formatCurrency(entry.total ?? entry.unitPrice * entry.quantity)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 dark:border-slate-600 my-4" />

                    {/* Total */}
                    <div className="flex justify-between items-baseline">
                        <span className="text-lg font-medium text-gray-700 dark:text-slate-300">
                            ยอดรวม
                        </span>
                        <span className="text-3xl font-bold text-blue-600">
                            {formatCurrency(ticket.billTotal)}
                        </span>
                    </div>

                    {/* Footer */}
                    <div className="mt-6 text-center text-xs text-gray-400 dark:text-slate-500">
                        <p>ขอบคุณที่ใช้บริการ</p>
                        <p className="mt-1">
                            {new Date().toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>
                </div>

                {/* Actions - hidden when printing */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 print:hidden">
                    <button onClick={handlePrint} className="btn-primary flex-1">
                        🖨️ พิมพ์ใบเสร็จ
                    </button>
                    <button onClick={onClose} className="btn-secondary">
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
}
