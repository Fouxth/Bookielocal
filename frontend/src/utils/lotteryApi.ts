/**
 * Lottery API Utility
 * 
 * Fetches lottery results from rayriffy API
 * API: https://lotto.api.rayriffy.com/lotto/{DDMMYYYY}
 */

export interface LotteryApiResponse {
    status: 'success' | 'fail';
    response: {
        date: string;
        endpoint: string;
        prizes: LotteryPrize[];
        runningNumbers: LotteryRunningNumber[];
    };
}

export interface LotteryPrize {
    id: string;
    name: string;
    reward: string;
    amount: number;
    number: string[];
}

export interface LotteryRunningNumber {
    id: string;
    name: string;
    reward: string;
    amount: number;
    number: string[];
}

export interface ParsedLotteryResult {
    date: string;              // เช่น "1 ธันวาคม 2568"
    prizeFirst: string;        // รางวัลที่ 1 (6 หลัก)
    threeTop: string;          // 3 ตัวหน้า (ตัดจาก prizeFirst)
    threeDown: string[];       // 3 ตัวท้าย (runningNumberBackThree)
    twoDown: string;           // 2 ตัวท้าย
    threeFront: string[];      // 3 ตัวหน้า (runningNumberFrontThree)
    nearFirst: string[];       // ข้างเคียงรางวัลที่ 1
}

/**
 * Convert date from YYYY-MM-DD to DDMMYYYY (Buddhist Era)
 * e.g., 2024-12-01 -> 01122567
 */
export function formatDateForApi(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    const buddhistYear = parseInt(year) + 543;
    return `${day}${month}${buddhistYear}`;
}

/**
 * Convert Buddhist date string to ISO format
 * e.g., "01122567" -> "2024-12-01"
 */
export function parseBuddhistDate(buddhistDate: string): string {
    if (buddhistDate.length !== 8) return '';
    const day = buddhistDate.substring(0, 2);
    const month = buddhistDate.substring(2, 4);
    const buddhistYear = parseInt(buddhistDate.substring(4, 8));
    const gregorianYear = buddhistYear - 543;
    return `${gregorianYear}-${month}-${day}`;
}

/**
 * Fetch lottery results from API
 */
export async function fetchLotteryResults(isoDate: string): Promise<ParsedLotteryResult | null> {
    try {
        const apiDate = formatDateForApi(isoDate);
        const response = await fetch(`https://lotto.api.rayriffy.com/lotto/${apiDate}`, {
            cache: 'no-store'
        });

        if (!response.ok) {
            console.error('Lottery API error:', response.status);
            return null;
        }

        const data: LotteryApiResponse = await response.json();

        if (data.status !== 'success' || !data.response) {
            console.log('No lottery results for this date');
            return null;
        }

        return parseLotteryResponse(data.response);
    } catch (error) {
        console.error('Failed to fetch lottery results:', error);
        return null;
    }
}

/**
 * Parse API response to our format
 */
function parseLotteryResponse(response: LotteryApiResponse['response']): ParsedLotteryResult {
    // Find prizes
    const prizeFirst = response.prizes.find(p => p.id === 'prizeFirst');
    const prizeFirstNear = response.prizes.find(p => p.id === 'prizeFirstNear');

    // Find running numbers
    const frontThree = response.runningNumbers.find(r => r.id === 'runningNumberFrontThree');
    const backThree = response.runningNumbers.find(r => r.id === 'runningNumberBackThree');
    const backTwo = response.runningNumbers.find(r => r.id === 'runningNumberBackTwo');

    const firstNumber = prizeFirst?.number[0] || '';

    return {
        date: response.date,
        prizeFirst: firstNumber,
        threeTop: firstNumber.substring(3), // Last 3 digits of prize first
        threeDown: backThree?.number || [],
        twoDown: backTwo?.number[0] || '',
        threeFront: frontThree?.number || [],
        nearFirst: prizeFirstNear?.number || [],
    };
}

/**
 * Check if a number wins any prize
 */
export function checkWinningNumber(
    number: string,
    category: string,
    result: ParsedLotteryResult
): { isWinner: boolean; prize: string } {
    const num = number.trim();

    switch (category) {
        case '3top':
            // Check if matches last 3 digits of prize first
            if (result.prizeFirst.endsWith(num)) {
                return { isWinner: true, prize: 'รางวัลที่ 1 (3 ตัวบน)' };
            }
            break;

        case '3tod':
            // Check permutations against last 3 digits
            const last3 = result.prizeFirst.substring(3);
            if (isPermutation(num, last3)) {
                return { isWinner: true, prize: 'รางวัลโต๊ด 3 ตัวบน' };
            }
            break;

        case '3down':
            // Check against back three running numbers
            if (result.threeDown.includes(num)) {
                return { isWinner: true, prize: 'รางวัล 3 ตัวล่าง' };
            }
            break;

        case '2top':
            // Check last 2 digits of prize first
            if (result.prizeFirst.endsWith(num)) {
                return { isWinner: true, prize: 'รางวัล 2 ตัวบน' };
            }
            break;

        case '2down':
            // Check against back two
            if (result.twoDown === num) {
                return { isWinner: true, prize: 'รางวัล 2 ตัวล่าง' };
            }
            break;
    }

    return { isWinner: false, prize: '' };
}

/**
 * Check if two numbers are permutations of each other
 */
function isPermutation(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return a.split('').sort().join('') === b.split('').sort().join('');
}
