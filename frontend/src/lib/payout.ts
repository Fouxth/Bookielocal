import { Ticket, LotteryResult, Category } from '@shared/schemas';

/**
 * Calculates the actual payout for a set of tickets based on the lottery result.
 */
export function computeActualPayout(tickets: Ticket[], result: LotteryResult): number {
    if (!result) return 0;

    let totalPayout = 0;

    // Extract winning numbers
    const { threeTop, twoDown, threeTod3, threeTod4 } = result;
    const twoTop = threeTop ? threeTop.slice(-2) : "";

    // Helper to check if a number matches winning numbers for a category
    const isWin = (combo: string, category: Category): boolean => {
        switch (category) {
            case '3top':
            case '3tod':
                return threeTop === combo;
            case '2top':
                return twoTop === combo;
            case '2down':
                return twoDown === combo;
            case '3down':
                // Check both 3-digit suffixes (3 ตัวล่าง 2 รางวัล)
                return (threeTod3 === combo) || (threeTod4 === combo);
            default:
                return false;
        }
    };

    for (const ticket of tickets) {
        if (ticket.deleted) continue;

        for (const entry of ticket.entries) {
            if (!entry.perComboTotals) continue;

            for (const item of entry.perComboTotals) {
                if (isWin(item.combo, entry.category)) {
                    // Actual Payout = Payout Rate * Unit Price * Quantity
                    totalPayout += item.payoutRate * item.unitPrice * item.quantity;
                }
            }
        }
    }

    return totalPayout;
}
