/**
 * Number Expansion Logic
 * 
 * Handles the expansion of raw lottery numbers into their concrete combinations
 * based on the category type.
 */

import { Category, CATEGORY_DIGIT_LENGTH } from '@shared/schemas';

/**
 * Get all unique permutations of an array of characters
 */
function getUniquePermutations(chars: string[]): string[][] {
    const results: string[][] = [];
    const seen = new Set<string>();

    function permute(arr: string[], current: string[] = []): void {
        if (arr.length === 0) {
            const key = current.join('');
            if (!seen.has(key)) {
                seen.add(key);
                results.push([...current]);
            }
            return;
        }

        for (let i = 0; i < arr.length; i++) {
            const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
            permute(remaining, [...current, arr[i]]);
        }
    }

    permute(chars);
    return results;
}

/**
 * Validates that the raw number is numeric and has the correct length for the category
 */
export function validateNumber(raw: string, category: Category): void {
    // Check if numeric
    if (!/^\d+$/.test(raw)) {
        throw new Error(`Invalid number: "${raw}" must contain only digits`);
    }

    const expectedLength = CATEGORY_DIGIT_LENGTH[category];
    if (raw.length !== expectedLength) {
        throw new Error(
            `Invalid number length: "${raw}" has ${raw.length} digits, but category "${category}" requires ${expectedLength} digits`
        );
    }
}

/**
 * Expands a raw lottery number into all concrete combinations based on category
 * 
 * @param raw - The raw number string (2 or 3 digits)
 * @param category - The category type
 * @returns Array of expanded number combinations
 * 
 * @example
 * expandNumber("123", "3top") // ["123"]
 * expandNumber("123", "3tod") // ["123", "132", "213", "231", "312", "321"]
 * expandNumber("112", "3tod") // ["112", "121", "211"]
 * expandNumber("12", "2tod")  // ["12", "21"]
 * expandNumber("11", "2tod")  // ["11"]
 */
export function expandNumber(raw: string, category: Category): string[] {
    // Validate input
    validateNumber(raw, category);

    // Handle 3-digit tod category (permutations)
    if (category === '3tod') {
        const chars = raw.split('');
        const permutations = getUniquePermutations(chars);
        return permutations.map(p => p.join('')).sort();
    }

    // Handle 2-digit tod category (swap)
    if (category === '2tod') {
        const swapped = raw[1] + raw[0];
        if (raw === swapped) {
            return [raw];
        }
        return [raw, swapped].sort();
    }

    // For top/down categories, return the number as-is
    return [raw];
}

/**
 * Get the expected number of expansions for a given number and category
 * Useful for UI display and validation
 */
export function getExpansionCount(raw: string, category: Category): number {
    if (category === '3tod') {
        const unique = new Set(raw.split(''));
        if (unique.size === 1) return 1; // All same digits (111)
        if (unique.size === 2) return 3; // Two same digits (112, 122)
        return 6; // All different digits (123)
    }

    if (category === '2tod') {
        return raw[0] === raw[1] ? 1 : 2;
    }

    return 1;
}

/**
 * Check if a category supports number expansion
 */
export function isExpandableCategory(category: Category): boolean {
    return ['3tod', '2tod'].includes(category);
}

/**
 * Get human-readable description of the expansion
 */
export function getExpansionDescription(raw: string, category: Category): string {
    const count = getExpansionCount(raw, category);
    if (count === 1) {
        return raw;
    }
    const expanded = expandNumber(raw, category);
    return expanded.join(', ');
}
