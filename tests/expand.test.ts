/**
 * Unit tests for number expansion logic
 */

import { describe, it, expect } from 'vitest';
import { expandNumber, validateNumber, getExpansionCount } from '../frontend/src/lib/expand';

describe('expandNumber', () => {
    describe('3top/3down categories', () => {
        it('should return the number as-is for 3top', () => {
            expect(expandNumber('123', '3top')).toEqual(['123']);
            expect(expandNumber('000', '3top')).toEqual(['000']);
            expect(expandNumber('999', '3top')).toEqual(['999']);
        });

        it('should return the number as-is for 3down', () => {
            expect(expandNumber('456', '3down')).toEqual(['456']);
        });
    });

    describe('3tod/3back categories', () => {
        it('should expand to 6 permutations for distinct digits', () => {
            const result = expandNumber('123', '3tod');
            expect(result).toHaveLength(6);
            expect(result).toContain('123');
            expect(result).toContain('132');
            expect(result).toContain('213');
            expect(result).toContain('231');
            expect(result).toContain('312');
            expect(result).toContain('321');
        });

        it('should expand to 3 permutations when two digits are same', () => {
            const result = expandNumber('112', '3tod');
            expect(result).toHaveLength(3);
            expect(result).toContain('112');
            expect(result).toContain('121');
            expect(result).toContain('211');
        });

        it('should expand to 3 permutations for 122', () => {
            const result = expandNumber('122', '3tod');
            expect(result).toHaveLength(3);
            expect(result).toContain('122');
            expect(result).toContain('212');
            expect(result).toContain('221');
        });

        it('should return 1 permutation when all digits are same', () => {
            const result = expandNumber('111', '3tod');
            expect(result).toHaveLength(1);
            expect(result).toContain('111');
        });

        it('should work the same for 3back', () => {
            const result = expandNumber('123', '3back');
            expect(result).toHaveLength(6);
            expect(result).toContain('123');
            expect(result).toContain('321');
        });

        it('should return sorted results', () => {
            const result = expandNumber('321', '3tod');
            expect(result).toEqual(['123', '132', '213', '231', '312', '321']);
        });
    });

    describe('2top/2down categories', () => {
        it('should return the number as-is for 2top', () => {
            expect(expandNumber('12', '2top')).toEqual(['12']);
            expect(expandNumber('00', '2top')).toEqual(['00']);
        });

        it('should return the number as-is for 2down', () => {
            expect(expandNumber('45', '2down')).toEqual(['45']);
        });
    });

    describe('2tod/2back categories', () => {
        it('should expand to 2 permutations for distinct digits', () => {
            const result = expandNumber('12', '2tod');
            expect(result).toHaveLength(2);
            expect(result).toContain('12');
            expect(result).toContain('21');
        });

        it('should return 1 result for same digits', () => {
            const result = expandNumber('11', '2tod');
            expect(result).toHaveLength(1);
            expect(result).toContain('11');
        });

        it('should work the same for 2back', () => {
            const result = expandNumber('34', '2back');
            expect(result).toHaveLength(2);
            expect(result).toContain('34');
            expect(result).toContain('43');
        });

        it('should return sorted results', () => {
            const result = expandNumber('21', '2tod');
            expect(result).toEqual(['12', '21']);
        });
    });

    describe('validation', () => {
        it('should throw error for non-numeric input', () => {
            expect(() => expandNumber('abc', '3top')).toThrow('must contain only digits');
            expect(() => expandNumber('12a', '3top')).toThrow('must contain only digits');
        });

        it('should throw error for wrong length', () => {
            expect(() => expandNumber('12', '3top')).toThrow('requires 3 digits');
            expect(() => expandNumber('1234', '3top')).toThrow('requires 3 digits');
            expect(() => expandNumber('1', '2top')).toThrow('requires 2 digits');
            expect(() => expandNumber('123', '2top')).toThrow('requires 2 digits');
        });

        it('should handle edge cases', () => {
            expect(expandNumber('00', '2top')).toEqual(['00']);
            expect(expandNumber('000', '3top')).toEqual(['000']);
        });
    });
});

describe('validateNumber', () => {
    it('should not throw for valid inputs', () => {
        expect(() => validateNumber('123', '3top')).not.toThrow();
        expect(() => validateNumber('12', '2top')).not.toThrow();
    });

    it('should throw for invalid inputs', () => {
        expect(() => validateNumber('abc', '3top')).toThrow();
        expect(() => validateNumber('12', '3top')).toThrow();
    });
});

describe('getExpansionCount', () => {
    it('should return 6 for 3tod with distinct digits', () => {
        expect(getExpansionCount('123', '3tod')).toBe(6);
    });

    it('should return 3 for 3tod with two same digits', () => {
        expect(getExpansionCount('112', '3tod')).toBe(3);
        expect(getExpansionCount('121', '3tod')).toBe(3);
        expect(getExpansionCount('211', '3tod')).toBe(3);
    });

    it('should return 1 for 3tod with all same digits', () => {
        expect(getExpansionCount('111', '3tod')).toBe(1);
    });

    it('should return 2 for 2tod with distinct digits', () => {
        expect(getExpansionCount('12', '2tod')).toBe(2);
    });

    it('should return 1 for 2tod with same digits', () => {
        expect(getExpansionCount('11', '2tod')).toBe(1);
    });

    it('should return 1 for non-expanding categories', () => {
        expect(getExpansionCount('123', '3top')).toBe(1);
        expect(getExpansionCount('12', '2top')).toBe(1);
    });
});
