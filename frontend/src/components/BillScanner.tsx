import { useState, useRef, useCallback } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { Category, CATEGORY_LABELS } from '@shared/schemas';

interface ScannedEntry {
    number: string;
    price: number;
    category: Category;
}

interface BillScannerProps {
    onEntriesScanned: (entries: ScannedEntry[]) => void;
    onClose: () => void;
}

export default function BillScanner({ onEntriesScanned, onClose }: BillScannerProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [scannedEntries, setScannedEntries] = useState<ScannedEntry[]>([]);
    const [rawText, setRawText] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parse Thai lottery bill text
    const parseBillText = useCallback((text: string): ScannedEntry[] => {
        const entries: ScannedEntry[] = [];
        const lines = text.split('\n').filter((line) => line.trim());

        // Pattern: number followed by price
        // e.g., "123 50", "45 100", "789 = 200"
        const patterns = [
            /(\d{2,3})\s*[=:@]?\s*(\d+)/g, // 123 50, 123=50, 123:50
            /(\d{2,3})\s+บ\s*(\d+)/g, // 123 บ 50 (Thai baht symbol)
        ];

        for (const line of lines) {
            for (const pattern of patterns) {
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    const number = match[1];
                    const price = parseInt(match[2], 10);

                    if (number && price > 0 && price < 100000) {
                        // Determine category based on number length
                        let category: Category = '3top';
                        if (number.length === 2) {
                            category = '2top';
                        } else if (number.length === 3) {
                            category = '3top';
                        }

                        entries.push({ number, price, category });
                    }
                }
            }
        }

        return entries;
    }, []);

    // Handle image selection
    const handleImageSelect = useCallback(
        async (file: File) => {
            setError('');
            setScannedEntries([]);
            setRawText('');

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);

            // Process with Tesseract
            setIsProcessing(true);
            setProgress(0);

            try {
                const worker = await createWorker('tha+eng', 1, {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setProgress(Math.round(m.progress * 100));
                        }
                    },
                });

                await worker.setParameters({
                    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                });

                const { data: { text } } = await worker.recognize(file);

                setRawText(text);
                const entries = parseBillText(text);
                setScannedEntries(entries);

                await worker.terminate();

                if (entries.length === 0) {
                    setError('ไม่พบเลขหวยในรูปภาพ ลองถ่ายใหม่ให้ชัดขึ้น');
                }
            } catch (err) {
                console.error('OCR error:', err);
                setError('เกิดข้อผิดพลาดในการอ่านภาพ');
            } finally {
                setIsProcessing(false);
            }
        },
        [parseBillText]
    );

    // Handle file input change
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageSelect(file);
        }
    };

    // Remove entry from list
    const removeEntry = (index: number) => {
        setScannedEntries((prev) => prev.filter((_, i) => i !== index));
    };

    // Update entry
    const updateEntry = (index: number, field: keyof ScannedEntry, value: string | number) => {
        setScannedEntries((prev) =>
            prev.map((entry, i) =>
                i === index ? { ...entry, [field]: value } : entry
            )
        );
    };

    // Submit entries
    const handleSubmit = () => {
        if (scannedEntries.length > 0) {
            onEntriesScanned(scannedEntries);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                            📷 สแกนบิลกระดาษ
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Upload Section */}
                    <div className="space-y-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessing}
                                className="btn-primary flex-1"
                            >
                                📤 เลือกรูป / ถ่ายภาพ
                            </button>
                        </div>

                        {/* Preview */}
                        {previewImage && (
                            <div className="relative">
                                <img
                                    src={previewImage}
                                    alt="Bill preview"
                                    className="w-full rounded-lg max-h-48 object-contain bg-gray-100 dark:bg-slate-700"
                                />
                            </div>
                        )}

                        {/* Processing */}
                        {isProcessing && (
                            <div className="text-center py-4">
                                <div className="spinner border-blue-600 w-8 h-8 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-600 dark:text-slate-400">
                                    กำลังอ่านข้อความ... {progress}%
                                </p>
                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Raw Text (debugging) */}
                        {rawText && (
                            <details className="text-sm">
                                <summary className="cursor-pointer text-gray-500 dark:text-slate-400">
                                    ดูข้อความที่อ่านได้
                                </summary>
                                <pre className="mt-2 p-2 bg-gray-100 dark:bg-slate-700 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                                    {rawText}
                                </pre>
                            </details>
                        )}

                        {/* Scanned Entries */}
                        {scannedEntries.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                                    รายการที่พบ ({scannedEntries.length})
                                </h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {scannedEntries.map((entry, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg"
                                        >
                                            <input
                                                type="text"
                                                value={entry.number}
                                                onChange={(e) => updateEntry(index, 'number', e.target.value.replace(/\D/g, ''))}
                                                className="input w-20 text-center font-mono"
                                            />
                                            <select
                                                value={entry.category}
                                                onChange={(e) => updateEntry(index, 'category', e.target.value as Category)}
                                                className="select text-sm"
                                            >
                                                {(['3top', '3tod', '3down', '2top', '2down'] as Category[]).map((cat) => (
                                                    <option key={cat} value={cat}>
                                                        {CATEGORY_LABELS[cat]}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={entry.price}
                                                onChange={(e) => updateEntry(index, 'price', parseInt(e.target.value, 10) || 0)}
                                                className="input w-24 text-center"
                                            />
                                            <span className="text-sm text-gray-500">บาท</span>
                                            <button
                                                onClick={() => removeEntry(index)}
                                                className="p-1 text-red-500 hover:text-red-700"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSubmit}
                                        className="btn-success flex-1"
                                    >
                                        ✓ เพิ่มรายการทั้งหมด
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="btn-secondary"
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
