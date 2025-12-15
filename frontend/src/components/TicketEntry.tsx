import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { Category, CATEGORY_LABELS, Entry } from '@shared/schemas';
import { expandNumber, getExpansionCount, validateNumber } from '../lib/expand';
import { formatCurrency } from '../utils/export';
import { getNumberTotals, NumberTotal } from '../lib/compute';
import NumpadEntry from './NumpadEntry';
import BatchEntry from './BatchEntry';
import BillScanner from './BillScanner';

const CATEGORIES: Category[] = [
    '3top',
    '3tod',
    '3down',
    '2top',
    '2down',
];

/**
 * คำนวณงวดหวยจากวันที่
 * - วันที่ 18 ถึงวันที่ 1 ของเดือนถัดไป = งวดวันที่ 1
 * - วันที่ 2 ถึงวันที่ 16/17 = งวดวันที่ 16 (หรือปรับตามวันหยุด)
 */
function calculateDrawPeriod(dateStr: string): { period: string; drawDate: string } {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();

    if (day >= 18) {
        // งวดวันที่ 1 ของเดือนถัดไป
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const drawDate = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
        return { period: '1', drawDate };
    } else if (day <= 1) {
        // งวดวันที่ 1 ของเดือนนี้
        const drawDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        return { period: '1', drawDate };
    } else {
        // งวดวันที่ 16 ของเดือนนี้ (ค่าเริ่มต้น อาจเป็น 17 ตามวันหยุด)
        const drawDate = `${year}-${String(month + 1).padStart(2, '0')}-16`;
        return { period: '16', drawDate };
    }
}

export default function TicketEntry() {
    const agents = useAppStore((state) => state.agents);
    const tickets = useAppStore((state) => state.tickets);
    const settings = useAppStore((state) => state.settings);
    const currentTicket = useAppStore((state) => state.currentTicket);
    const initCurrentTicket = useAppStore((state) => state.initCurrentTicket);
    const addEntry = useAppStore((state) => state.addEntry);
    const removeEntry = useAppStore((state) => state.removeEntry);
    const clearCurrentTicket = useAppStore((state) => state.clearCurrentTicket);
    const saveCurrentTicket = useAppStore((state) => state.saveCurrentTicket);
    const createAgent = useAppStore((state) => state.createAgent);
    const undo = useAppStore((state) => state.undo);
    const username = useAuthStore((state) => state.user?.username) ?? 'unknown';

    const [selectedAgent, setSelectedAgent] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCategories, setSelectedCategories] = useState<Category[]>(['3top']);
    const [numberInput, setNumberInput] = useState('');
    const [unitPrice, setUnitPrice] = useState('');
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showNewAgent, setShowNewAgent] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
    const [useNumpad, setUseNumpad] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('bookielocal-numpad') === 'true';
        }
        return false;
    });
    const [showBatchMode, setShowBatchMode] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [reverse2Digit, setReverse2Digit] = useState(false); // กลับเลข 2 ตัว บน-ล่าง

    const numberInputRef = useRef<HTMLInputElement>(null);

    // Calculate numbers near/at ceiling
    const ceilingAlerts = useMemo((): NumberTotal[] => {
        const perNumberMax = settings.ceilings?.perNumberMax ?? 50000;
        const totals = getNumberTotals(tickets, selectedDate, perNumberMax);

        // Filter numbers at 80% or more of ceiling
        const alerts: NumberTotal[] = [];
        for (const [, total] of totals) {
            if (total.totalAmount >= perNumberMax * 0.8) {
                alerts.push(total);
            }
        }

        // Sort by amount descending
        return alerts.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10);
    }, [tickets, selectedDate, settings.ceilings]);

    // Auto-calculate draw period from date
    const drawPeriodInfo = useMemo(() => {
        return calculateDrawPeriod(selectedDate);
    }, [selectedDate]);

    // Initialize ticket when agent/date changes
    useEffect(() => {
        if (selectedAgent) {
            initCurrentTicket(selectedAgent, 'government', selectedDate, drawPeriodInfo.period);
        }
    }, [selectedAgent, selectedDate, drawPeriodInfo.period, initCurrentTicket]);

    // Focus number input after adding entry
    const focusNumberInput = useCallback(() => {
        numberInputRef.current?.focus();
    }, []);

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedAgent) {
            setError('กรุณาเลือกเจ้าที่ส่ง');
            return;
        }

        if (selectedCategories.length === 0) {
            setError('กรุณาเลือกประเภทอย่างน้อย 1 รายการ');
            return;
        }

        if (!numberInput) {
            setError('กรุณากรอกหมายเลข');
            return;
        }

        const price = parseFloat(unitPrice);
        if (isNaN(price) || price <= 0) {
            setError('กรุณากรอกราคาที่ถูกต้อง');
            return;
        }

        try {
            // Validate and add entry for each selected category
            for (const category of selectedCategories) {
                validateNumber(numberInput, category);

                // เพิ่มเลขหลัก
                addEntry(category, numberInput, price, 1);

                // ถ้าเปิด "กลับ" และเป็น 2 ตัว ให้เพิ่มเลขกลับเป็นรายการแยก
                if (reverse2Digit && (category === '2top' || category === '2down') && numberInput.length === 2) {
                    const reversed = numberInput.split('').reverse().join('');
                    // เพิ่มเฉพาะถ้าเลขกลับไม่เหมือนเลขเดิม (เช่น 55 กลับก็ 55)
                    if (reversed !== numberInput) {
                        addEntry(category, reversed, price, 1);
                    }
                }
            }

            // Clear input and refocus, reset categories
            setNumberInput('');
            setUnitPrice('');
            setSelectedCategories([]);
            setReverse2Digit(false);
            focusNumberInput();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid input');
        }
    };

    const handleSave = async () => {
        const ticket = await saveCurrentTicket(username);
        if (ticket) {
            setShowConfirm(false);
            // Reset form
            setNumberInput('');
            setUnitPrice('');
        }
    };

    const handleCreateAgent = async () => {
        if (!newAgentName.trim()) return;

        const agent = await createAgent(newAgentName.trim());
        setSelectedAgent(agent.id);
        setNewAgentName('');
        setShowNewAgent(false);
    };

    const handleUndo = async () => {
        await undo();
    };

    const getDigitLength = (): number => {
        if (selectedCategories.length === 0) return 3;
        return selectedCategories[0].startsWith('3') ? 3 : 2;
    };

    const toggleCategory = (cat: Category) => {
        const isThreeDigit = cat.startsWith('3');
        setSelectedCategories((prev) => {
            if (prev.includes(cat)) {
                // Remove if already selected
                return prev.filter((c) => c !== cat);
            } else {
                // Add to selection, but only same digit-length categories
                const filtered = prev.filter((c) => c.startsWith('3') === isThreeDigit);
                return [...filtered, cat];
            }
        });
    };

    const ticketTotal = currentTicket?.entries.reduce((sum, e) => sum + (e.total ?? 0), 0) ?? 0;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                        ออกบิล
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400">
                        กรอกรายการหวยและบันทึกบิล
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowScanner(true)}
                        className="btn-secondary btn-sm"
                        title="สแกนบิลกระดาษ"
                    >
                        📷 <span className="hidden sm:inline">สแกน</span>
                    </button>
                    <button onClick={handleUndo} className="btn-ghost btn-sm">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="hidden sm:inline">Undo</span>
                    </button>
                </div>
            </div>

            {/* Bill Scanner Modal */}
            {showScanner && (
                <BillScanner
                    onEntriesScanned={(entries) => {
                        for (const entry of entries) {
                            addEntry(entry.category, entry.number, entry.price, 1);
                        }
                        setShowScanner(false);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
                {/* Left: Entry Form */}
                <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
                    {/* Ticket Info */}
                    <div className="card p-4 sm:p-6">
                        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                            ข้อมูลบิล
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            {/* Agent Select */}
                            <div>
                                <label className="label">เจ้าที่ส่ง</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedAgent}
                                        onChange={(e) => setSelectedAgent(e.target.value)}
                                        className="select flex-1"
                                    >
                                        <option value="">-- เลือก --</option>
                                        {agents.map((agent) => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewAgent(true)}
                                        className="btn-secondary btn-sm"
                                        title="เพิ่มเจ้าใหม่"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="label">วันที่</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="input"
                                />
                            </div>

                            {/* Draw Period - Auto calculated */}
                            <div>
                                <label className="label">งวด</label>
                                <div className="input bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center gap-2">
                                    <span className="text-lg font-semibold">วันที่ {drawPeriodInfo.period}</span>
                                    <span className="text-xs text-gray-500 dark:text-slate-400">(อัตโนมัติ)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Entry Form */}
                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                                เพิ่มรายการ
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowBatchMode(!showBatchMode)}
                                className={`text-xs sm:text-sm px-2 sm:px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 sm:gap-2 ${showBatchMode
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                                    }`}
                            >
                                📝 <span className="hidden sm:inline">{showBatchMode ? 'โหมดปกติ' : 'กรอกเลขรัว'}</span>
                                <span className="sm:hidden">{showBatchMode ? 'ปกติ' : 'รัว'}</span>
                            </button>
                        </div>

                        {/* Batch Entry Mode */}
                        {showBatchMode && (
                            <BatchEntry
                                selectedCategories={selectedCategories}
                                onAddEntries={(entries) => {
                                    for (const entry of entries) {
                                        for (const category of entry.categories) {
                                            try {
                                                validateNumber(entry.number, category);
                                                addEntry(category, entry.number, entry.price, 1);
                                            } catch (err) {
                                                console.error('Failed to add batch entry:', err);
                                            }
                                        }
                                    }
                                }}
                                onClose={() => setShowBatchMode(false)}
                            />
                        )}

                        {error && (
                            <div className="mb-3 sm:mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-400 text-sm animate-fade-in">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAddEntry}>
                            {/* Category Selection */}
                            <div className="mb-3 sm:mb-4">
                                <label className="label">ประเภท</label>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {CATEGORIES.map((cat) => {
                                        const isSelected = selectedCategories.includes(cat);
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleCategory(cat)}
                                                className={`px-2 sm:px-3 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 ${isSelected
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                                {CATEGORY_LABELS[cat]}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Toggle กลับ 2 ตัว */}
                                {(selectedCategories.includes('2top') || selectedCategories.includes('2down')) && (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setReverse2Digit(!reverse2Digit)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${reverse2Digit
                                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                }`}
                                        >
                                            <span className="text-lg">🔄</span>
                                            กลับ (เพิ่มเลขกลับอัตโนมัติ)
                                            {reverse2Digit && (
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                        {reverse2Digit && (
                                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                                เช่น กรอก 54 จะเพิ่ม 45 อัตโนมัติ
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Number Input */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="label mb-0">หมายเลข ({getDigitLength()} หลัก)</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newVal = !useNumpad;
                                                setUseNumpad(newVal);
                                                localStorage.setItem('bookielocal-numpad', String(newVal));
                                            }}
                                            className={`text-xs px-2 py-1 rounded-lg transition-all ${useNumpad
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400'
                                                }`}
                                        >
                                            {useNumpad ? '⌨️ Numpad' : '⌨️ Keyboard'}
                                        </button>
                                    </div>
                                    {useNumpad ? (
                                        <NumpadEntry
                                            value={numberInput}
                                            onChange={setNumberInput}
                                            maxLength={getDigitLength()}
                                            placeholder={getDigitLength() === 3 ? 'กรอกเลข 3 หลัก' : 'กรอกเลข 2 หลัก'}
                                        />
                                    ) : (
                                        <input
                                            ref={numberInputRef}
                                            type="text"
                                            value={numberInput}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                if (val.length <= getDigitLength()) {
                                                    setNumberInput(val);
                                                }
                                            }}
                                            className="number-input"
                                            placeholder={getDigitLength() === 3 ? '123' : '12'}
                                            maxLength={getDigitLength()}
                                            inputMode="numeric"
                                            autoComplete="off"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="label">ราคา (บาท)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(e.target.value)}
                                        className="input text-center text-lg font-semibold"
                                        placeholder="100"
                                        min="1"
                                        step="1"
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            {numberInput && numberInput.length === getDigitLength() && selectedCategories.length > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm animate-fade-in">
                                    <div className="mb-2">
                                        <span className="text-gray-600 dark:text-slate-400">ประเภทที่เลือก: </span>
                                        <span className="font-medium text-blue-700 dark:text-blue-300">
                                            {selectedCategories.map((c) => CATEGORY_LABELS[c]).join(', ')}
                                        </span>
                                    </div>
                                    <span className="text-gray-600 dark:text-slate-400">ขยายเป็น: </span>
                                    <span className="font-mono font-medium text-blue-700 dark:text-blue-300">
                                        {(() => {
                                            try {
                                                const expanded = expandNumber(numberInput, selectedCategories[0]);
                                                return expanded.join(', ');
                                            } catch {
                                                return numberInput;
                                            }
                                        })()}
                                    </span>
                                    <span className="text-gray-500 dark:text-slate-400 ml-2">
                                        ({getExpansionCount(numberInput, selectedCategories[0])} เลข × {selectedCategories.length} ประเภท)
                                    </span>
                                </div>
                            )}

                            <button type="submit" className="btn-primary w-full sm:w-auto">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                เพิ่มรายการ
                            </button>
                        </form>
                    </div>

                    {/* Current Entries */}
                    {currentTicket && currentTicket.entries.length > 0 && (
                        <div className="card p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                                รายการในบิล ({currentTicket.entries.length} รายการ)
                            </h2>

                            <div className="space-y-3">
                                {currentTicket.entries.map((entry) => (
                                    <EntryRow
                                        key={entry.id}
                                        entry={entry}
                                        isExpanded={expandedEntryId === entry.id}
                                        onToggleExpand={() =>
                                            setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)
                                        }
                                        onRemove={() => removeEntry(entry.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Summary */}
                <div className="space-y-6">
                    {/* Ceiling Alerts */}
                    {ceilingAlerts.length > 0 && (
                        <div className="card p-4 border-2 border-orange-500/50 bg-orange-50 dark:bg-orange-900/20 animate-fade-in">
                            <h3 className="text-base font-semibold text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                                ⚠️ เลขใกล้เต็มเพดาน
                            </h3>
                            <div className="space-y-2">
                                {ceilingAlerts.map((alert) => (
                                    <div
                                        key={`${alert.category}-${alert.number}`}
                                        className={`flex items-center justify-between p-2 rounded ${alert.exceedsCeiling
                                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-lg font-bold">
                                                {alert.number}
                                            </span>
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-white/50 dark:bg-black/20">
                                                {CATEGORY_LABELS[alert.category]}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold">
                                                {formatCurrency(alert.totalAmount)}
                                            </span>
                                            {alert.exceedsCeiling && (
                                                <span className="text-xs ml-1 text-red-600 dark:text-red-400">
                                                    เต็ม!
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-orange-600/70 dark:text-orange-400/70 mt-2">
                                เพดาน: {formatCurrency(settings.ceilings?.perNumberMax ?? 50000)}
                            </p>
                        </div>
                    )}

                    {/* Bill Summary - not sticky on mobile to prevent overlap */}
                    <div className="card p-6 lg:sticky lg:top-24">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                            สรุปบิล
                        </h2>

                        {selectedAgent ? (
                            <>
                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">เจ้าที่ส่ง:</span>
                                        <span className="font-medium text-gray-900 dark:text-slate-100">
                                            {agents.find((a) => a.id === selectedAgent)?.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">วันที่:</span>
                                        <span className="font-medium text-gray-900 dark:text-slate-100">
                                            {selectedDate}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500 dark:text-slate-400">จำนวนรายการ:</span>
                                        <span className="font-medium text-gray-900 dark:text-slate-100">
                                            {currentTicket?.entries.length ?? 0}
                                        </span>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mb-6">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-gray-700 dark:text-slate-300 font-medium">ยอดรวม:</span>
                                        <span className="text-3xl font-bold text-blue-600">
                                            {formatCurrency(ticketTotal)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={!currentTicket?.entries.length}
                                        className="btn-success w-full"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        บันทึกบิล
                                    </button>
                                    <button
                                        onClick={clearCurrentTicket}
                                        disabled={!currentTicket?.entries.length}
                                        className="btn-ghost w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        ล้างข้อมูล
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                                กรุณาเลือกเจ้าที่ส่งก่อน
                            </p>
                        )}
                    </div>


                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                ยืนยันการบันทึก
                            </h2>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600 dark:text-slate-400">
                                ต้องการบันทึกบิลนี้หรือไม่?
                            </p>
                            <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <div className="flex justify-between text-sm mb-2">
                                    <span>จำนวนรายการ:</span>
                                    <span className="font-medium">{currentTicket?.entries.length}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold">
                                    <span>ยอดรวม:</span>
                                    <span className="text-blue-600">{formatCurrency(ticketTotal)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowConfirm(false)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={handleSave} className="btn-success">
                                ยืนยัน
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Agent Modal */}
            {showNewAgent && (
                <div className="modal-overlay" onClick={() => setShowNewAgent(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                เพิ่มเจ้าที่ส่งใหม่
                            </h2>
                        </div>
                        <div className="modal-body">
                            <label className="label">ชื่อเจ้า</label>
                            <input
                                type="text"
                                value={newAgentName}
                                onChange={(e) => setNewAgentName(e.target.value)}
                                className="input"
                                placeholder="กรอกชื่อเจ้าที่ส่ง"
                                autoFocus
                            />
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowNewAgent(false)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={handleCreateAgent} className="btn-primary">
                                เพิ่ม
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Entry Row Component
interface EntryRowProps {
    entry: Entry;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onRemove: () => void;
}

function EntryRow({ entry, isExpanded, onToggleExpand, onRemove }: EntryRowProps) {
    return (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onToggleExpand}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
                    >
                        <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="badge-primary">{CATEGORY_LABELS[entry.category]}</span>
                    <span className="font-mono text-lg font-bold text-gray-900 dark:text-slate-100">
                        {entry.raw}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                        × {entry.quantity} @ {formatCurrency(entry.unitPrice)}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-gray-900 dark:text-slate-100">
                        {formatCurrency(entry.total ?? 0)}
                    </span>
                    <button
                        onClick={onRemove}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {isExpanded && entry.perComboTotals && (
                <div className="p-3 space-y-2 animate-slide-down">
                    <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                        Expanded Combos ({entry.expanded?.length ?? 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {entry.perComboTotals.map((combo) => (
                            <div
                                key={combo.combo}
                                className="combo-pill"
                                title={`Payout: ${combo.payoutRate}x`}
                            >
                                <span className="font-bold mr-2">{combo.combo}</span>
                                <span className="text-gray-500 dark:text-slate-400 text-xs">
                                    {formatCurrency(combo.soldAmount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
