
import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { computeSummary } from '../lib/compute';
import { computeActualPayout } from '../lib/payout';
import { getLotteryResults } from '../storage/db';
import { formatCurrency, exportSummaryCSV, exportTicketsCSV } from '../utils/export';
import { CATEGORY_LABELS, LotteryResult } from '@shared/schemas';
import { getDrawPeriodOptions, getCurrentDrawPeriod, isDateInDrawPeriod } from '../lib/drawPeriod';
import AgentDetailModal from './AgentDetailModal';

// Helper component for Stat Card
function StatCard({
    label,
    value,
    icon,
    color,
    valueColor,
}: {
    label: string;
    value: string;
    icon: string;
    color: string;
    valueColor?: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
        orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    };

    return (
        <div className="card p-4 sm:p-6 flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                    {label}
                </p>
                <h3
                    className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${valueColor ? valueColor : 'text-gray-900 dark:text-slate-100'
                        }`}
                >
                    {value}
                </h3>
            </div>
            <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                <span className="text-xl sm:text-2xl">{icon}</span>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const location = useLocation();
    const tickets = useAppStore((state) => state.tickets);
    const agents = useAppStore((state) => state.agents);
    const settings = useAppStore((state) => state.settings);

    const drawPeriodOptions = useMemo(() => getDrawPeriodOptions(12), []);

    // Check location state for period, otherwise use default
    const [selectedPeriod, setSelectedPeriod] = useState(() => {
        const statePeriod = location.state?.period;
        if (statePeriod) return statePeriod;
        return getCurrentDrawPeriod().id;
    });

    // Modal State
    const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
    const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);

    // Fetch lottery result for selected period
    useEffect(() => {
        const fetchResult = async () => {
            try {
                const results = await getLotteryResults();
                const match = results.find((r) => r.date === selectedPeriod);
                setLotteryResult(match || null);
            } catch (error) {
                console.error('Failed to fetch lottery results:', error);
            }
        };
        fetchResult();
    }, [selectedPeriod]);

    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => isDateInDrawPeriod(t.date, selectedPeriod));
    }, [tickets, selectedPeriod]);

    const summary = useMemo(() => {
        return computeSummary(filteredTickets, settings, agents, selectedPeriod);
    }, [filteredTickets, agents, settings, selectedPeriod]);

    const actualPayout = useMemo(() => {
        if (!lotteryResult) return null;
        return computeActualPayout(filteredTickets, lotteryResult);
    }, [filteredTickets, lotteryResult]);

    const agentStats = useMemo(() => {
        if (!lotteryResult) return summary.perAgent;

        // Calculate actual stats per agent
        const agentMap = new Map<string, { gross: number; payout: number; ticketCount: number }>();

        filteredTickets.forEach((ticket) => {
            const ticketPayout = computeActualPayout([ticket], lotteryResult);
            const current = agentMap.get(ticket.agentId) || { gross: 0, payout: 0, ticketCount: 0 };

            agentMap.set(ticket.agentId, {
                gross: current.gross + ticket.billTotal,
                payout: current.payout + ticketPayout,
                ticketCount: current.ticketCount + 1,
            });
        });

        // Convert to array matching summary.perAgent structure
        return Array.from(agentMap.entries()).map(([agentId, stats]) => {
            const agent = agents.find(a => a.id === agentId);
            return {
                agentId,
                agentName: agent?.name ?? 'Unknown',
                gross: stats.gross,
                expectedPayout: stats.payout, // Reusing field name but storing actual payout
                profit: stats.gross - stats.payout,
                ticketCount: stats.ticketCount,
            };
        }).sort((a, b) => b.gross - a.gross);

    }, [lotteryResult, summary.perAgent, filteredTickets, agents]);

    const handleExportSummary = () => {
        exportSummaryCSV(summary);
    };

    const handleExportTickets = () => {
        exportTicketsCSV(filteredTickets, agents);
    };

    const handleAgentClick = (agentId: string) => {
        setDetailAgentId(agentId);
    };

    const handleCloseModal = () => {
        setDetailAgentId(null);
    };

    const selectedAgentTickets = useMemo(() => {
        if (!detailAgentId) return [];
        return filteredTickets.filter(t => t.agentId === detailAgentId);
    }, [filteredTickets, detailAgentId]);

    const selectedAgentName = useMemo(() => {
        if (!detailAgentId) return '';
        return agents.find(a => a.id === detailAgentId)?.name ?? 'Unknown';
    }, [agents, detailAgentId]);

    // Determine values to display
    const displayPayout = actualPayout !== null ? actualPayout : summary.expectedPayout;
    const displayProfit = summary.gross - displayPayout;
    const isActual = actualPayout !== null;

    return (
        <div className="max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                        สรุปยอด
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400">
                        ภาพรวมยอดขายและผลกำไร {isActual && <span className="text-green-600 font-medium">(คำนวณจากผลหวยจริง)</span>}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="select flex-1 sm:flex-none"
                    >
                        {drawPeriodOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                งวด {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button onClick={handleExportSummary} className="btn-secondary btn-sm text-xs sm:text-sm">
                            📊 Export
                        </button>
                        <button onClick={handleExportTickets} className="btn-secondary btn-sm text-xs sm:text-sm">
                            📋 Tickets
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <StatCard
                    label="ยอดขายรวม"
                    value={formatCurrency(summary.gross)}
                    icon="💰"
                    color="blue"
                    valueColor="text-blue-600 dark:text-blue-400"
                />

                {isActual ? (
                    <>
                        <StatCard
                            label="จ่ายจริง (มีคนถูก)"
                            value={formatCurrency(displayPayout)}
                            icon="💸"
                            color={displayPayout > 0 ? "red" : "green"}
                            valueColor={displayPayout > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
                        />
                        <StatCard
                            label="กำไรสุทธิ"
                            value={formatCurrency(displayProfit)}
                            icon="📈"
                            color={displayProfit >= 0 ? "green" : "red"}
                            valueColor={displayProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                        />
                    </>
                ) : (
                    <>
                        <StatCard
                            label="ยอดจ่ายรางวัล"
                            value="รอผลรางวัล"
                            icon="⏳"
                            color="orange"
                            valueColor="text-orange-500 dark:text-orange-400 text-lg sm:text-xl md:text-2xl"
                        />
                        <StatCard
                            label="ผลกำไร"
                            value="รอผลรางวัล"
                            icon="⏳"
                            color="orange"
                            valueColor="text-orange-500 dark:text-orange-400 text-lg sm:text-xl md:text-2xl"
                        />
                    </>
                )}

                <StatCard
                    label="จำนวนบิล"
                    value={summary.ticketCount.toString()}
                    icon="🎫"
                    color="purple"
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                {/* Per Agent Breakdown */}
                <div className="card p-3 sm:p-6 overflow-hidden">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                        แยกตามเจ้าที่ส่ง {isActual && <span className="text-sm font-normal text-green-600">(ยอดจริง)</span>}
                    </h2>
                    {agentStats.length > 0 ? (
                        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                            <table className="table min-w-[600px] sm:min-w-full">
                                <thead>
                                    <tr>
                                        <th className="whitespace-nowrap">เจ้า</th>
                                        <th className="text-right whitespace-nowrap">ยอดขาย</th>
                                        <th className="text-right whitespace-nowrap">{isActual ? "จ่ายจริง" : "จ่ายคืน"}</th>
                                        <th className="text-right whitespace-nowrap">กำไร</th>
                                        <th className="text-right whitespace-nowrap">บิล</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agentStats.map((agent) => (
                                        <tr
                                            key={agent.agentId}
                                            onClick={() => handleAgentClick(agent.agentId)}
                                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                        >
                                            <td className="font-medium text-blue-600 hover:text-blue-800 underline decoration-dotted underline-offset-2 w-auto whitespace-nowrap">
                                                {agent.agentName}
                                            </td>
                                            <td className="text-right font-mono whitespace-nowrap">
                                                {formatCurrency(agent.gross)}
                                            </td>
                                            <td className={`text-right font-mono whitespace-nowrap ${isActual && agent.expectedPayout > 0 ? 'text-red-600' : isActual ? 'text-gray-400' : 'text-orange-500'}`}>
                                                {isActual ? formatCurrency(agent.expectedPayout) : 'รอผล'}
                                            </td>
                                            <td
                                                className={`text-right font-mono font-medium whitespace-nowrap ${!isActual ? 'text-orange-500' : agent.profit >= 0 ? 'text-green-500' : 'text-red-500'
                                                    }`}
                                            >
                                                {isActual ? formatCurrency(agent.profit) : 'รอผล'}
                                            </td>
                                            <td className="text-right whitespace-nowrap">{agent.ticketCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">ไม่มีข้อมูลการขายในงวดนี้</p>
                    )}
                </div>

                {/* Risk Breakdown */}
                <div className="card p-3 sm:p-6">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                        ⚠️ เลขเสี่ยง (เกิน 5,000)
                    </h2>
                    {summary.riskyNumbers.length > 0 ? (
                        <div className="space-y-3">
                            {summary.riskyNumbers.map((item, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-lg overflow-hidden">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <span className="font-mono font-bold text-lg text-red-600 dark:text-red-400 truncate">
                                            {item.combo}
                                        </span>
                                        <span className="badge-secondary text-xs whitespace-nowrap flex-shrink-0">
                                            {CATEGORY_LABELS[item.category]}
                                        </span>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <div className="font-bold text-red-600 text-sm sm:text-base">
                                            {formatCurrency(item.soldAmount)}
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400">
                                            เกิน {formatCurrency(item.threshold)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500 py-8">
                            <span className="text-4xl block mb-2">🛡️</span>
                            <p>ไม่มีเลขที่มีความเสี่ยงสูง</p>
                        </div>
                    )}
                </div>
            </div>

            <AgentDetailModal
                isOpen={!!detailAgentId}
                onClose={handleCloseModal}
                agentName={selectedAgentName}
                tickets={selectedAgentTickets}
                lotteryResult={lotteryResult}
            />
        </div>
    );
}
