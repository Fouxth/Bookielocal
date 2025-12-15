import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Ticket, Entry, CATEGORY_LABELS, DEFAULT_PAYOUTS, LotteryResult } from '@shared/schemas';
import { formatCurrency } from '../utils/export';
import {
    getLotteryResults,
    getLotteryResultByDate,
    createLotteryResult,
} from '../storage/firebaseData';
import { getDrawPeriodOptions, getCurrentDrawPeriod, isDateInDrawPeriod } from '../lib/drawPeriod';
import { fetchLotteryResults } from '../utils/lotteryApi';

interface WinningNumbers {
    firstPrize: string;         // รางวัลที่ 1 (6 หลัก)
    front3Digit1: string;       // เลขหน้า 3 ตัว ชุด 1
    front3Digit2: string;       // เลขหน้า 3 ตัว ชุด 2
    back3Digit1: string;        // เลขท้าย 3 ตัว ชุด 1
    back3Digit2: string;        // เลขท้าย 3 ตัว ชุด 2
    back2Digit: string;         // เลขท้าย 2 ตัว
}

interface WinnerEntry {
    ticket: Ticket;
    entry: Entry;
    agentName: string;
    winAmount: number;
}

export default function LotteryCheck() {
    const tickets = useAppStore((state) => state.tickets);
    const agents = useAppStore((state) => state.agents);
    const settings = useAppStore((state) => state.settings);

    const drawPeriodOptions = useMemo(() => getDrawPeriodOptions(12), []);
    const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentDrawPeriod().id);
    const [winningNumbers, setWinningNumbers] = useState<WinningNumbers>({
        firstPrize: '',
        front3Digit1: '',
        front3Digit2: '',
        back3Digit1: '',
        back3Digit2: '',
        back2Digit: '',
    });
    const [isCalculated, setIsCalculated] = useState(false);
    const [savedResults, setSavedResults] = useState<LotteryResult[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Load saved results on mount
    useEffect(() => {
        getLotteryResults().then(setSavedResults);
    }, []);

    // Auto-fetch and auto-calculate when period changes
    useEffect(() => {
        const loadAndFetchResult = async () => {
            setIsFetching(true);
            setIsCalculated(false);

            // First, check if we have saved result in Firebase
            const savedResult = await getLotteryResultByDate(selectedPeriod);

            if (savedResult && savedResult.firstPrize) {
                // Use saved result
                setWinningNumbers({
                    firstPrize: savedResult.firstPrize || (savedResult.threeTop ? '000' + savedResult.threeTop : ''),
                    front3Digit1: savedResult.threeTod1 || '',
                    front3Digit2: savedResult.threeTod2 || '',
                    back3Digit1: savedResult.threeTod3 || '',
                    back3Digit2: savedResult.threeTod4 || '',
                    back2Digit: savedResult.twoDown || '',
                });
                setIsCalculated(true);
                setIsFetching(false);
                return;
            }

            // No saved result - try to fetch from API
            try {
                const apiResult = await fetchLotteryResults(selectedPeriod);

                if (apiResult) {
                    // Fill form with API result
                    setWinningNumbers({
                        firstPrize: apiResult.prizeFirst,
                        front3Digit1: apiResult.threeFront[0] || '',
                        front3Digit2: apiResult.threeFront[1] || '',
                        back3Digit1: apiResult.threeDown[0] || '',
                        back3Digit2: apiResult.threeDown[1] || '',
                        back2Digit: apiResult.twoDown,
                    });

                    // Auto-save to Firebase
                    const saveData = {
                        date: selectedPeriod,
                        firstPrize: apiResult.prizeFirst,
                        threeTop: apiResult.prizeFirst.slice(-3),
                        threeDown: apiResult.threeDown[0] || apiResult.threeDown[1],
                        twoDown: apiResult.twoDown,
                        threeTod1: apiResult.threeFront[0] || '',
                        threeTod2: apiResult.threeFront[1] || '',
                        threeTod3: apiResult.threeDown[0] || '',
                        threeTod4: apiResult.threeDown[1] || '',
                    };

                    await createLotteryResult(saveData);

                    // Reload saved results
                    const updatedResults = await getLotteryResults();
                    setSavedResults(updatedResults);

                    // Auto-calculate
                    setIsCalculated(true);
                } else {
                    // No result from API (period not yet drawn)
                    setWinningNumbers({
                        firstPrize: '',
                        front3Digit1: '',
                        front3Digit2: '',
                        back3Digit1: '',
                        back3Digit2: '',
                        back2Digit: '',
                    });
                }
            } catch (error) {
                console.error('Failed to fetch lottery results:', error);
                // Reset form on error
                setWinningNumbers({
                    firstPrize: '',
                    front3Digit1: '',
                    front3Digit2: '',
                    back3Digit1: '',
                    back3Digit2: '',
                    back2Digit: '',
                });
            } finally {
                setIsFetching(false);
            }
        };

        loadAndFetchResult();
    }, [selectedPeriod]);



    // Derived values from first prize
    const twoTop = winningNumbers.firstPrize.slice(-2);  // 2 ตัวบน = 2 หลักสุดท้ายของรางวัลที่ 1
    const threeTop = winningNumbers.firstPrize.slice(-3); // 3 ตัวบน = 3 หลักสุดท้ายของรางวัลที่ 1

    const agentMap = useMemo(() => {
        return new Map(agents.map((a) => [a.id, a.name]));
    }, [agents]);

    // หวยรัฐบาลมีรอบเดียว - filter ตามงวด
    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => isDateInDrawPeriod(t.date, selectedPeriod));
    }, [tickets, selectedPeriod]);

    const summary = useMemo(() => {
        let totalGross = 0;
        for (const ticket of filteredTickets) {
            for (const entry of ticket.entries) {
                totalGross += entry.total ?? entry.unitPrice * entry.quantity;
            }
        }
        return { totalGross };
    }, [filteredTickets]);

    const winners = useMemo((): WinnerEntry[] => {
        if (!isCalculated) return [];

        const results: WinnerEntry[] = [];
        const payouts = settings.payouts || DEFAULT_PAYOUTS;

        for (const ticket of filteredTickets) {
            for (const entry of ticket.entries) {
                let isWinner = false;
                let winAmount = 0;

                const expanded = entry.expanded || [entry.raw];

                for (const num of expanded) {
                    switch (entry.category) {
                        case '3top':
                            if (num === threeTop) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['3top'] || 800);
                            }
                            break;
                        case '3tod': {
                            const sorted3Top = threeTop.split('').sort().join('');
                            const sortedNum = num.split('').sort().join('');
                            if (sortedNum === sorted3Top) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['3tod'] || 130);
                            }
                            break;
                        }
                        case '3down':
                            // ตรวจทั้ง 2 ชุดของเลขท้าย 3 ตัว
                            if (num === winningNumbers.back3Digit1 || num === winningNumbers.back3Digit2) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['3down'] || 400);
                            }
                            break;
                        case '2top':
                            if (num === twoTop) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['2top'] || 70);
                            }
                            break;
                        case '2down':
                            if (num === winningNumbers.back2Digit) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['2down'] || 70);
                            }
                            break;
                        case '2back': {
                            const reversed = num.split('').reverse().join('');
                            if (num === winningNumbers.back2Digit || reversed === winningNumbers.back2Digit) {
                                isWinner = true;
                                winAmount = entry.unitPrice * (payouts['2back'] || 35);
                            }
                            break;
                        }
                    }
                    if (isWinner) break;
                }

                if (isWinner) {
                    results.push({
                        ticket,
                        entry,
                        agentName: agentMap.get(ticket.agentId) || 'Unknown',
                        winAmount: winAmount * entry.quantity,
                    });
                }
            }
        }

        return results;
    }, [filteredTickets, winningNumbers, isCalculated, settings.payouts, agentMap, threeTop, twoTop]);

    const totalPayout = winners.reduce((sum, w) => sum + w.winAmount, 0);
    const profit = summary.totalGross - totalPayout;


    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                    🎯 ตรวจหวย
                </h1>
                <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400">
                    กรอกผลหวยและคำนวณกำไร/ขาดทุน
                </p>
            </div>

            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
                <div>
                    <label className="label">งวดหวย</label>
                    <select
                        value={selectedPeriod}
                        onChange={(e) => {
                            setSelectedPeriod(e.target.value);
                            setIsCalculated(false);
                        }}
                        className="select w-full sm:max-w-xs"
                    >
                        {drawPeriodOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                งวด {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        📊 พบ <strong>{filteredTickets.length}</strong> บิล,
                        ยอดรับแทงรวม <strong>{formatCurrency(summary.totalGross)}</strong>
                    </p>
                </div>
            </div>

            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                    กรอกผลหวย
                </h2>

                {/* Loading indicator */}
                {isFetching && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        <span className="text-blue-700 dark:text-blue-300">กำลังดึงผลหวย...</span>
                    </div>
                )}

                {/* รางวัลที่ 1 */}
                <div className="mb-4 sm:mb-6">
                    <label className="label text-base sm:text-lg">รางวัลที่ 1 *</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={winningNumbers.firstPrize}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setWinningNumbers((prev) => ({
                                ...prev,
                                firstPrize: val,
                            }));
                            setIsCalculated(false);
                        }}
                        className="number-input text-center text-2xl sm:text-3xl font-bold"
                        placeholder="000000"
                        maxLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        2 ตัวบน: <span className="font-mono font-bold text-blue-600">{twoTop || '--'}</span> |
                        3 ตัวบน: <span className="font-mono font-bold text-blue-600">{threeTop || '---'}</span>
                    </p>
                </div>

                {/* เลขหน้า 3 ตัว และ เลขท้าย 3 ตัว */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                    <div>
                        <label className="label">เลขหน้า 3 ตัว</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={winningNumbers.front3Digit1}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setWinningNumbers((prev) => ({ ...prev, front3Digit1: val }));
                                    setIsCalculated(false);
                                }}
                                className="number-input text-center flex-1 text-lg"
                                placeholder="---"
                                maxLength={3}
                            />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={winningNumbers.front3Digit2}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setWinningNumbers((prev) => ({ ...prev, front3Digit2: val }));
                                    setIsCalculated(false);
                                }}
                                className="number-input text-center flex-1 text-lg"
                                placeholder="---"
                                maxLength={3}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="label">เลขท้าย 3 ตัว</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={winningNumbers.back3Digit1}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setWinningNumbers((prev) => ({ ...prev, back3Digit1: val }));
                                    setIsCalculated(false);
                                }}
                                className="number-input text-center flex-1 text-lg"
                                placeholder="---"
                                maxLength={3}
                            />
                            <input
                                type="text"
                                inputMode="numeric"
                                value={winningNumbers.back3Digit2}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                                    setWinningNumbers((prev) => ({ ...prev, back3Digit2: val }));
                                    setIsCalculated(false);
                                }}
                                className="number-input text-center flex-1 text-lg"
                                placeholder="---"
                                maxLength={3}
                            />
                        </div>
                    </div>
                </div>

                {/* เลขท้าย 2 ตัว */}
                <div className="mb-4 sm:mb-6">
                    <label className="label text-center block">เลขท้าย 2 ตัว</label>
                    <div className="max-w-[120px] sm:max-w-[150px] mx-auto">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={winningNumbers.back2Digit}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                setWinningNumbers((prev) => ({ ...prev, back2Digit: val }));
                                setIsCalculated(false);
                            }}
                            className="number-input text-center text-xl sm:text-2xl"
                            placeholder="--"
                            maxLength={2}
                        />
                    </div>
                </div>



                {/* History Modal */}
                {showHistory && (
                    <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-slate-800 animate-fade-in">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                                📋 ประวัติผลหวย
                            </h3>
                            <button
                                onClick={() => setShowHistory(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                ✕
                            </button>
                        </div>
                        {savedResults.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-slate-400 py-4">
                                ยังไม่มีประวัติผลหวย
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {savedResults.slice(0, 10).map((result) => (
                                    <button
                                        key={result.id}
                                        onClick={() => {
                                            setSelectedPeriod(result.date);
                                            setShowHistory(false);
                                        }}
                                        className={`w-full text-left p-3 rounded-lg transition-colors ${result.date === selectedPeriod
                                            ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-500'
                                            : 'bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">
                                                {new Date(result.date).toLocaleDateString('th-TH', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                })}
                                            </span>
                                            <span className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                                                {result.threeTop || '---'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                                            2ล่าง: {result.twoDown || '--'} | 3ล่าง: {result.threeDown || '---'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isCalculated && (
                <div className="space-y-4 sm:space-y-6 animate-fade-in">
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <div className="card p-3 sm:p-4 text-center">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">ยอดรับแทง</p>
                            <p className="text-lg sm:text-2xl font-bold text-blue-600">
                                {formatCurrency(summary.totalGross)}
                            </p>
                        </div>
                        <div className="card p-3 sm:p-4 text-center">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">ต้องจ่าย</p>
                            <p className="text-lg sm:text-2xl font-bold text-red-600">
                                {formatCurrency(totalPayout)}
                            </p>
                        </div>
                        <div className="card p-3 sm:p-4 text-center">
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
                                {profit >= 0 ? 'กำไร' : 'ขาดทุน'}
                            </p>
                            <p className={`text-lg sm:text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(profit))}
                            </p>
                        </div>
                    </div>

                    <div className="card p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                            🎉 รายการที่ถูก ({winners.length} รายการ)
                        </h2>

                        {winners.length > 0 ? (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>เจ้าที่ส่ง</th>
                                            <th>ประเภท</th>
                                            <th>เลข</th>
                                            <th className="text-right">แทง</th>
                                            <th className="text-right">ต้องจ่าย</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {winners.map((winner, idx) => (
                                            <tr key={idx}>
                                                <td className="font-medium">{winner.agentName}</td>
                                                <td>
                                                    <span className="badge-primary">
                                                        {CATEGORY_LABELS[winner.entry.category]}
                                                    </span>
                                                </td>
                                                <td className="font-mono font-bold text-lg">
                                                    {winner.entry.raw}
                                                </td>
                                                <td className="text-right">
                                                    {formatCurrency(winner.entry.unitPrice * winner.entry.quantity)}
                                                </td>
                                                <td className="text-right font-bold text-red-600">
                                                    {formatCurrency(winner.winAmount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-red-50 dark:bg-red-900/20">
                                            <td colSpan={4} className="text-right font-medium">
                                                รวมต้องจ่าย:
                                            </td>
                                            <td className="text-right font-bold text-xl text-red-600">
                                                {formatCurrency(totalPayout)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                                <div className="text-4xl mb-2">😊</div>
                                <p>ไม่มีคนถูกรางวัล</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
