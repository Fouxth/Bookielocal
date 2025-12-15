import { useState } from 'react';
import { Category, CATEGORY_LABELS } from '@shared/schemas';

interface BatchEntryProps {
    onAddEntries: (entries: { number: string; price: number; categories: Category[] }[]) => void;
    selectedCategories: Category[];
    onClose: () => void;
}

/**
 * Parse batch input format:
 * - "123=100" -> number 123, price 100
 * - "123=100, 456=50" -> multiple entries
 * - "123,456,789=100" -> same price for multiple numbers
 * - Line breaks also work as separators
 */
function parseBatchInput(input: string): { number: string; price: number }[] {
    const results: { number: string; price: number }[] = [];

    // Split by comma or newline
    const parts = input.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    let currentPrice = 0;
    const pendingNumbers: string[] = [];

    for (const part of parts) {
        if (part.includes('=')) {
            // This part has a price
            const [numPart, pricePart] = part.split('=').map(s => s.trim());
            const price = parseInt(pricePart) || 0;

            // Add any pending numbers with current price first
            if (pendingNumbers.length > 0 && currentPrice > 0) {
                for (const num of pendingNumbers) {
                    results.push({ number: num, price: currentPrice });
                }
                pendingNumbers.length = 0;
            }

            currentPrice = price;

            if (numPart) {
                // Handle multiple numbers before = (e.g., "123,456=100")
                const nums = numPart.split(/\s+/).filter(Boolean);
                for (const num of nums) {
                    const cleanNum = num.replace(/\D/g, '');
                    if (cleanNum) {
                        results.push({ number: cleanNum, price });
                    }
                }
            }
        } else {
            // Just a number, add to pending
            const cleanNum = part.replace(/\D/g, '');
            if (cleanNum) {
                pendingNumbers.push(cleanNum);
            }
        }
    }

    // Add remaining pending numbers with current price
    if (pendingNumbers.length > 0 && currentPrice > 0) {
        for (const num of pendingNumbers) {
            results.push({ number: num, price: currentPrice });
        }
    }

    return results;
}

export default function BatchEntry({ onAddEntries, selectedCategories, onClose }: BatchEntryProps) {
    const [batchInput, setBatchInput] = useState('');
    const [error, setError] = useState('');
    const [preview, setPreview] = useState<{ number: string; price: number }[]>([]);

    const handleInputChange = (value: string) => {
        setBatchInput(value);
        setError('');

        try {
            const parsed = parseBatchInput(value);
            setPreview(parsed);
        } catch {
            setPreview([]);
        }
    };

    const handleSubmit = () => {
        if (selectedCategories.length === 0) {
            setError('กรุณาเลือกประเภทก่อน');
            return;
        }

        const entries = parseBatchInput(batchInput);

        if (entries.length === 0) {
            setError('กรุณากรอกข้อมูลให้ถูกต้อง (เช่น 123=100, 456=50)');
            return;
        }

        // Validate all numbers
        const digitLength = selectedCategories[0].startsWith('3') ? 3 : 2;
        for (const entry of entries) {
            if (entry.number.length !== digitLength) {
                setError(`เลข "${entry.number}" ต้องมี ${digitLength} หลัก`);
                return;
            }
            if (entry.price <= 0) {
                setError(`ราคาต้องมากกว่า 0`);
                return;
            }
        }

        onAddEntries(entries.map(e => ({
            number: e.number,
            price: e.price,
            categories: selectedCategories,
        })));

        setBatchInput('');
        setPreview([]);
        onClose();
    };

    return (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    📝 กรอกเลขรัว (Batch Mode)
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                    ✕
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="mb-4">
                <label className="label">
                    ประเภทที่เลือก: <span className="text-blue-600 dark:text-blue-400">{selectedCategories.map(c => CATEGORY_LABELS[c]).join(', ') || 'ยังไม่ได้เลือก'}</span>
                </label>
            </div>

            <div className="mb-4">
                <label className="label">กรอกเลขและราคา</label>
                <textarea
                    value={batchInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    className="input min-h-[120px] font-mono"
                    placeholder={`ตัวอย่าง:
123=100
456=50
789 012 345=100`}
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    รูปแบบ: เลข=ราคา คั่นด้วย comma หรือ ขึ้นบรรทัดใหม่
                </p>
            </div>

            {/* Preview */}
            {preview.length > 0 && (
                <div className="mb-4 p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        ดูตัวอย่าง ({preview.length} รายการ × {selectedCategories.length} ประเภท = {preview.length * selectedCategories.length} entries)
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {preview.slice(0, 10).map((item, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm font-mono"
                            >
                                {item.number}={item.price}
                            </span>
                        ))}
                        {preview.length > 10 && (
                            <span className="text-gray-500 dark:text-slate-400 text-sm">
                                +{preview.length - 10} อีก...
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={preview.length === 0}
                    className="btn-success flex-1"
                >
                    ✓ เพิ่ม {preview.length * selectedCategories.length} รายการ
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary"
                >
                    ยกเลิก
                </button>
            </div>
        </div>
    );
}
