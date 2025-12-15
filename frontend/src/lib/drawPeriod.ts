/**
 * Draw Period Utilities
 * Helper functions for Thai government lottery draw periods
 */

export interface DrawPeriod {
    id: string;        // e.g., "2025-01-01", "2025-01-16"
    label: string;     // e.g., "1 ม.ค. 68"
    period: '1' | '16';
    month: number;
    year: number;
}

/**
 * Generate draw period options for the last N months
 */
export function getDrawPeriodOptions(monthsBack: number = 12): DrawPeriod[] {
    const options: DrawPeriod[] = [];
    const now = new Date();

    for (let i = 0; i < monthsBack; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();

        // วันที่ 16
        options.push({
            id: `${year}-${String(month + 1).padStart(2, '0')}-16`,
            label: `16 ${getThaiMonthShort(month)} ${(year + 543) % 100}`,
            period: '16',
            month: month + 1,
            year,
        });

        // วันที่ 1
        options.push({
            id: `${year}-${String(month + 1).padStart(2, '0')}-01`,
            label: `1 ${getThaiMonthShort(month)} ${(year + 543) % 100}`,
            period: '1',
            month: month + 1,
            year,
        });
    }

    // Sort by date descending
    return options.sort((a, b) => b.id.localeCompare(a.id));
}

/**
 * Get current draw period based on today's date
 */
export function getCurrentDrawPeriod(): DrawPeriod {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth();
    const year = now.getFullYear();

    if (day >= 18) {
        // งวดวันที่ 1 ของเดือนถัดไป
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        return {
            id: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`,
            label: `1 ${getThaiMonthShort(nextMonth)} ${(nextYear + 543) % 100}`,
            period: '1',
            month: nextMonth + 1,
            year: nextYear,
        };
    } else if (day <= 1) {
        // งวดวันที่ 1 ของเดือนนี้
        return {
            id: `${year}-${String(month + 1).padStart(2, '0')}-01`,
            label: `1 ${getThaiMonthShort(month)} ${(year + 543) % 100}`,
            period: '1',
            month: month + 1,
            year,
        };
    } else {
        // งวดวันที่ 16 ของเดือนนี้
        return {
            id: `${year}-${String(month + 1).padStart(2, '0')}-16`,
            label: `16 ${getThaiMonthShort(month)} ${(year + 543) % 100}`,
            period: '16',
            month: month + 1,
            year,
        };
    }
}

/**
 * Check if a ticket date belongs to a draw period
 * Draw period 1: วันที่ 18 ของเดือนก่อน ถึง วันที่ 1 ของเดือน
 * Draw period 16: วันที่ 2 ถึง วันที่ 17 ของเดือน
 */
export function isDateInDrawPeriod(ticketDate: string, drawPeriodId: string): boolean {
    const tDate = new Date(ticketDate);
    const tDay = tDate.getDate();
    const tMonth = tDate.getMonth();
    const tYear = tDate.getFullYear();

    const dpDate = new Date(drawPeriodId);
    const dpDay = dpDate.getDate();
    const dpMonth = dpDate.getMonth();
    const dpYear = dpDate.getFullYear();

    if (dpDay === 1) {
        // งวดวันที่ 1: บิลวันที่ 18 ของเดือนก่อน ถึง วันที่ 1 ของเดือนนี้
        const prevMonth = dpMonth === 0 ? 11 : dpMonth - 1;
        const prevYear = dpMonth === 0 ? dpYear - 1 : dpYear;

        // บิลในช่วง 18-31 ของเดือนก่อน
        if (tYear === prevYear && tMonth === prevMonth && tDay >= 18) {
            return true;
        }
        // บิลในวันที่ 1 ของเดือนเป้าหมาย
        if (tYear === dpYear && tMonth === dpMonth && tDay === 1) {
            return true;
        }
    } else if (dpDay === 16) {
        // งวดวันที่ 16: บิลวันที่ 2-17 ของเดือนนี้
        if (tYear === dpYear && tMonth === dpMonth && tDay >= 2 && tDay <= 17) {
            return true;
        }
    }

    return false;
}

/**
 * Get Thai month name (short)
 */
function getThaiMonthShort(month: number): string {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return months[month] || '';
}
