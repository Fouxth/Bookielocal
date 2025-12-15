import { useState, useEffect } from 'react';

interface NumpadEntryProps {
    value: string;
    onChange: (value: string) => void;
    maxLength: number;
    placeholder?: string;
    onSubmit?: () => void;
}

export default function NumpadEntry({
    value,
    onChange,
    maxLength,
    placeholder,
    onSubmit,
}: NumpadEntryProps) {
    const [isNumpadVisible, setIsNumpadVisible] = useState(false);

    const handleKeyPress = (key: string) => {
        if (key === 'clear') {
            onChange('');
            playBeep('clear');
        } else if (key === 'back') {
            onChange(value.slice(0, -1));
            playBeep('back');
        } else if (key === 'enter') {
            if (value.length === maxLength && onSubmit) {
                playBeep('success');
                onSubmit();
            }
        } else {
            if (value.length < maxLength) {
                const newValue = value + key;
                onChange(newValue);

                // Play success beep when complete
                if (newValue.length === maxLength) {
                    playBeep('complete');
                } else {
                    playBeep('tap');
                }
            }
        }
    };

    const playBeep = (type: 'tap' | 'complete' | 'success' | 'back' | 'clear') => {
        if (typeof window === 'undefined' || !window.AudioContext) return;

        try {
            const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            switch (type) {
                case 'tap':
                    oscillator.frequency.value = 800;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.05);
                    break;
                case 'complete':
                    oscillator.frequency.value = 1000;
                    gainNode.gain.value = 0.15;
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.1);
                    break;
                case 'success':
                    oscillator.frequency.value = 1200;
                    gainNode.gain.value = 0.15;
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.15);
                    break;
                case 'back':
                case 'clear':
                    oscillator.frequency.value = 400;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(audioContext.currentTime + 0.05);
                    break;
            }
        } catch {
            // Audio not supported, silent fail
        }
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isNumpadVisible) return;

            if (e.key >= '0' && e.key <= '9') {
                handleKeyPress(e.key);
            } else if (e.key === 'Backspace') {
                handleKeyPress('back');
            } else if (e.key === 'Escape') {
                handleKeyPress('clear');
            } else if (e.key === 'Enter') {
                handleKeyPress('enter');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isNumpadVisible, value, maxLength]);

    const numpadKeys = [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        ['clear', '0', 'back'],
    ];

    return (
        <div className="space-y-3">
            {/* Display */}
            <div
                onClick={() => setIsNumpadVisible(!isNumpadVisible)}
                className="number-input cursor-pointer text-center text-3xl font-bold tracking-[0.5em] min-h-[3.5rem] flex items-center justify-center"
            >
                {value || <span className="text-gray-400 tracking-normal text-lg">{placeholder || 'กดเพื่อกรอกเลข'}</span>}
            </div>

            {/* Numpad */}
            {isNumpadVisible && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 shadow-lg border border-gray-200 dark:border-slate-700 animate-slide-down">
                    <div className="grid grid-cols-3 gap-2">
                        {numpadKeys.flat().map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => handleKeyPress(key)}
                                className={`
                                    h-14 rounded-xl text-xl font-bold transition-all active:scale-95
                                    ${key === 'clear'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                                        : key === 'back'
                                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                                            : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 shadow-sm'
                                    }
                                `}
                            >
                                {key === 'clear' ? 'C' : key === 'back' ? '←' : key}
                            </button>
                        ))}
                    </div>

                    {/* Enter button */}
                    <button
                        type="button"
                        onClick={() => handleKeyPress('enter')}
                        disabled={value.length !== maxLength}
                        className={`
                            w-full h-12 mt-2 rounded-xl text-lg font-bold transition-all
                            ${value.length === maxLength
                                ? 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                                : 'bg-gray-200 dark:bg-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                            }
                        `}
                    >
                        ✓ ยืนยัน ({value.length}/{maxLength})
                    </button>
                </div>
            )}
        </div>
    );
}
