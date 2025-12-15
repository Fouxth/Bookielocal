import { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { formatCurrency } from '../utils/export';

interface MonthData {
    month: string; // YYYY-MM
    label: string;
    totalSales: number;
    totalPayout: number;
    profit: number;
    ticketCount: number;
}

export default function MonthlyReport() {
    const tickets = useAppStore((state) => state.tickets);
    const settings = useAppStore((state) => state.settings);

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Calculate monthly data
    const monthlyData = useMemo((): MonthData[] => {
        const data: Map<string, MonthData> = new Map();

        // Initialize all months
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${selectedYear}-${month.toString().padStart(2, '0')}`;
            const monthLabel = new Date(selectedYear, month - 1).toLocaleDateString('th-TH', {
                month: 'short',
            });
            data.set(monthKey, {
                month: monthKey,
                label: monthLabel,
                totalSales: 0,
                totalPayout: 0,
                profit: 0,
                ticketCount: 0,
            });
        }

        // Aggregate tickets by month
        for (const ticket of tickets) {
            if (ticket.deleted) continue;

            const ticketDate = new Date(ticket.date);
            if (ticketDate.getFullYear() !== selectedYear) continue;

            const monthKey = `${selectedYear}-${(ticketDate.getMonth() + 1).toString().padStart(2, '0')}`;
            const monthData = data.get(monthKey);
            if (!monthData) continue;

            monthData.ticketCount += 1;
            monthData.totalSales += ticket.billTotal;

            // Calculate payout (simplified - assumes all entries could win)
            // Note: Actual payout only happens if the number wins
            // This report shows sales only, not actual payout
        }

        // Calculate profit (sales - estimated expenses/commissions)
        for (const monthData of data.values()) {
            // Simple profit calculation: assume 80% retention
            monthData.profit = monthData.totalSales * 0.8 - monthData.totalPayout;
        }

        return Array.from(data.values());
    }, [tickets, selectedYear, settings]);

    // Calculate year totals
    const yearTotals = useMemo(() => {
        return monthlyData.reduce(
            (acc, month) => ({
                totalSales: acc.totalSales + month.totalSales,
                totalPayout: acc.totalPayout + month.totalPayout,
                profit: acc.profit + month.profit,
                ticketCount: acc.ticketCount + month.ticketCount,
            }),
            { totalSales: 0, totalPayout: 0, profit: 0, ticketCount: 0 }
        );
    }, [monthlyData]);

    // Find max value for chart scaling
    const maxValue = useMemo(() => {
        return Math.max(...monthlyData.map((m) => m.totalSales), 1);
    }, [monthlyData]);

    const years = useMemo(() => {
        const ticketYears = new Set(tickets.map((t) => new Date(t.date).getFullYear()));
        ticketYears.add(currentYear);
        return Array.from(ticketYears).sort((a, b) => b - a);
    }, [tickets, currentYear]);

    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                        📊 รายงานรายเดือน
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400">
                        สรุปยอดขายและกำไร/ขาดทุน
                    </p>
                </div>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="select w-full sm:w-auto"
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            ปี {year + 543}
                        </option>
                    ))}
                </select>
            </div>

            {/* Year Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="card p-4 text-center">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">ยอดขายรวม</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">
                        {formatCurrency(yearTotals.totalSales)}
                    </p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">กำไรโดยประมาณ</p>
                    <p className={`text-lg sm:text-2xl font-bold ${yearTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {formatCurrency(yearTotals.profit)}
                    </p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">จำนวนบิล</p>
                    <p className="text-lg sm:text-2xl font-bold text-purple-600">
                        {yearTotals.ticketCount.toLocaleString()}
                    </p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">เฉลี่ยต่อ Bill</p>
                    <p className="text-lg sm:text-2xl font-bold text-orange-600">
                        {yearTotals.ticketCount > 0
                            ? formatCurrency(yearTotals.totalSales / yearTotals.ticketCount)
                            : '฿0'}
                    </p>
                </div>
            </div>

            {/* Monthly Bar Chart */}
            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                    กราฟยอดขายรายเดือน
                </h2>
                <div className="flex items-end gap-2 h-48 sm:h-64">
                    {monthlyData.map((month) => {
                        const height = maxValue > 0 ? (month.totalSales / maxValue) * 100 : 0;
                        return (
                            <div
                                key={month.month}
                                className="flex-1 flex flex-col items-center"
                            >
                                <div
                                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all duration-500"
                                    style={{ height: `${height}%`, minHeight: month.totalSales > 0 ? '4px' : '0' }}
                                    title={`${month.label}: ${formatCurrency(month.totalSales)}`}
                                />
                                <span className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                                    {month.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Monthly Detail Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-slate-300">
                                    เดือน
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-slate-300">
                                    จำนวนบิล
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-slate-300">
                                    ยอดขาย
                                </th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-slate-300">
                                    กำไรโดยประมาณ
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map((month, index) => (
                                <tr
                                    key={month.month}
                                    className={`border-t border-gray-100 dark:border-slate-700 ${month.totalSales > 0
                                        ? 'bg-white dark:bg-slate-800'
                                        : 'bg-gray-50 dark:bg-slate-800/50 text-gray-400'
                                        }`}
                                >
                                    <td className="px-4 py-3 font-medium">
                                        {new Date(selectedYear, index).toLocaleDateString('th-TH', {
                                            month: 'long',
                                        })}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {month.ticketCount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                        {formatCurrency(month.totalSales)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-medium ${month.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {formatCurrency(month.profit)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 dark:bg-slate-700 font-semibold">
                            <tr>
                                <td className="px-4 py-3">รวมทั้งปี</td>
                                <td className="px-4 py-3 text-right">
                                    {yearTotals.ticketCount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {formatCurrency(yearTotals.totalSales)}
                                </td>
                                <td className={`px-4 py-3 text-right ${yearTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {formatCurrency(yearTotals.profit)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
