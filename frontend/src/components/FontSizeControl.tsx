import { useState, useEffect } from 'react';

type FontSize = 'small' | 'medium' | 'large';

const FONT_SIZE_KEY = 'bookielocal-font-size';

const ROOT_FONT_SIZES: Record<FontSize, string> = {
    small: '14px',
    medium: '18px',
    large: '22px',
};

export function useFontSize() {
    const [fontSize, setFontSize] = useState<FontSize>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) || 'medium';
        }
        return 'medium';
    });

    useEffect(() => {
        localStorage.setItem(FONT_SIZE_KEY, fontSize);
        document.documentElement.style.fontSize = ROOT_FONT_SIZES[fontSize];
    }, [fontSize]);

    return { fontSize, setFontSize };
}

interface FontSizeControlProps {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
}

export default function FontSizeControl({ fontSize, setFontSize }: FontSizeControlProps) {
    const sizes: { value: FontSize; label: string }[] = [
        { value: 'small', label: 'A-' },
        { value: 'medium', label: 'A' },
        { value: 'large', label: 'A+' },
    ];

    return (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            {sizes.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => setFontSize(value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${fontSize === value
                        ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    title={value === 'small' ? 'ฟอนต์เล็ก' : value === 'medium' ? 'ฟอนต์กลาง' : 'ฟอนต์ใหญ่'}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
