import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useTenantStore } from '../store/tenantStore';
import {
    Category,
    CATEGORY_LABELS,
    BlockedNumber,
} from '@shared/schemas';
import { downloadFile } from '../utils/export';
import { exportAllData, importData, ExportData } from '../storage/db';
import { isFirebaseInitialized } from '../storage/sync';

const CATEGORIES: Category[] = [
    '3top',
    '3down',
    '3tod',
    // '3back',
    '2top',
    // '2tod',
    '2down',
    // '2back',
];

// Storage modes constant removed


export default function Settings() {
    const settings = useAppStore((state) => state.settings);
    const blockedNumbers = useAppStore((state) => state.blockedNumbers);
    const updateSettings = useAppStore((state) => state.updateSettings);
    const createBlockedNumber = useAppStore((state) => state.createBlockedNumber);
    const updateBlockedNumber = useAppStore((state) => state.updateBlockedNumber);
    const deleteBlockedNumber = useAppStore((state) => state.deleteBlockedNumber);

    // Get tenant context
    const { tenantName, tenantSlug } = useTenantStore();

    const [activeTab, setActiveTab] = useState<'payouts' | 'blocked' | 'storage' | 'export' | 'reset'>('payouts');
    const [showAddBlocked, setShowAddBlocked] = useState(false);
    const [newBlocked, setNewBlocked] = useState({
        number: '',
        category: '3top' as Category,
        payoutOverride: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [resetStep, setResetStep] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // initialized check is enough for now, no setter needed
    const [firebaseStatus] = useState(isFirebaseInitialized());

    const handleFactoryReset = async () => {
        try {
            // Clear remote data first if connected
            const { syncManager } = await import('../storage/sync');
            await syncManager.clearRemoteData();

            // Use smart reset that preserves users
            await import('../storage/db').then(mod => mod.factoryResetData());

            // Clear specific localStorage items if needed, but KEEP auth
            localStorage.removeItem('appSettings');
            // localStorage.removeItem('darkMode'); // Optional: keep dark mode preference

            // Clear tenant context (important for multi-tenant)
            localStorage.removeItem('bookielocal-tenant');

            // Redirect to landing page (not /dashboard which gets interpreted as tenant slug!)
            window.location.href = '/';
        } catch (error) {
            console.error('Failed to reset:', error);
            setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการล้างข้อมูล' });
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    // Payout handlers
    const handlePayoutChange = async (category: Category, value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        await updateSettings({
            payouts: {
                ...settings.payouts,
                [category]: numValue,
            },
        });
    };

    // Ceiling handler
    const handleCeilingChange = async (value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        await updateSettings({
            ceilings: {
                ...settings.ceilings,
                perComboMax: numValue,
            },
        });
    };

    // Risky threshold handler
    const handleThresholdChange = async (value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return;

        await updateSettings({
            riskyThreshold: numValue,
        });
    };

    // Blocked number handlers
    const handleAddBlocked = async () => {
        if (!newBlocked.number || !newBlocked.payoutOverride) return;

        await createBlockedNumber({
            number: newBlocked.number,
            category: newBlocked.category,
            payoutOverride: parseFloat(newBlocked.payoutOverride),
            enabled: true,
        });

        setNewBlocked({ number: '', category: '3top', payoutOverride: '' });
        setShowAddBlocked(false);
        showMessage('success', 'เพิ่มเลขอั้นสำเร็จ');
    };

    const handleToggleBlocked = async (blocked: BlockedNumber) => {
        await updateBlockedNumber(blocked.id, { enabled: !blocked.enabled });
    };

    const handleDeleteBlocked = async (id: string) => {
        await deleteBlockedNumber(id);
        showMessage('success', 'ลบเลขอั้นสำเร็จ');
    };

    // Storage mode handler
    // Storage modes removed as Sync is now enforced

    // Export/Import handlers
    const handleExport = async () => {
        try {
            setIsSaving(true);
            const data = await exportAllData();
            const json = JSON.stringify(data, null, 2);
            const date = new Date().toISOString().split('T')[0];
            downloadFile(json, `bookielocal_backup_${date}.json`, 'application/json');
            showMessage('success', 'ส่งออกข้อมูลสำเร็จ');
        } catch (error) {
            showMessage('error', 'เกิดข้อผิดพลาดในการส่งออก');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsSaving(true);
            const text = await file.text();
            const data: ExportData = JSON.parse(text);
            await importData(data);
            showMessage('success', 'นำเข้าข้อมูลสำเร็จ กรุณารีเฟรชหน้า');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            showMessage('error', 'เกิดข้อผิดพลาดในการนำเข้า');
        } finally {
            setIsSaving(false);
        }
    };

    // Settings now accessible to all shop users

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                        ตั้งค่า
                    </h1>
                    <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-medium">
                        🏪 {tenantName || tenantSlug}
                    </span>
                </div>
                <p className="text-sm sm:text-base text-gray-500 dark:text-slate-400 mt-1">
                    การตั้งค่าจะมีผลเฉพาะเจ้ามือ <strong>{tenantName || tenantSlug}</strong> เท่านั้น
                </p>
            </div>

            {/* Message Toast */}
            {message && (
                <div className={`toast ${message.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                    {message.type === 'success' ? '✓' : '✗'} {message.text}
                </div>
            )}

            {/* Tabs - Scrollable on mobile */}
            <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-gray-200 dark:border-slate-700 overflow-x-auto scrollbar-hide">
                {[
                    { id: 'payouts', label: 'อัตราจ่าย', icon: '💰' },
                    { id: 'blocked', label: 'เลขอั้น', icon: '🚫' },
                    { id: 'storage', label: 'การจัดเก็บ', icon: '☁️' },
                    { id: 'export', label: 'นำเข้า/ส่งออก', icon: '📦' },
                    { id: 'reset', label: 'ล้างข้อมูล', icon: '💀' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                    >
                        <span className="hidden sm:inline">{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="card p-4 sm:p-6">
                {/* Payouts Tab */}
                {activeTab === 'payouts' && (
                    <div className="space-y-4 sm:space-y-6">
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                                อัตราจ่ายเริ่มต้น (บาทละ)
                            </h3>
                            {/* 3-digit categories - top row */}
                            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
                                {(['3top', '3tod', '3down'] as const).map((cat) => (
                                    <div key={cat}>
                                        <label className="label text-xs sm:text-sm">{CATEGORY_LABELS[cat]}</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={settings.payouts[cat]}
                                            onChange={(e) => handlePayoutChange(cat, e.target.value)}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* 2-digit categories - bottom row */}
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                {(['2top', '2down'] as const).map((cat) => (
                                    <div key={cat}>
                                        <label className="label text-xs sm:text-sm">{CATEGORY_LABELS[cat]}</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={settings.payouts[cat]}
                                            onChange={(e) => handlePayoutChange(cat, e.target.value)}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <hr className="border-gray-200 dark:border-slate-700" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <label className="label">เพดานต่อชุด (บาท)</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={settings.ceilings.perComboMax}
                                    onChange={(e) => handleCeilingChange(e.target.value)}
                                    className="input"
                                    min="0"
                                />
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    ยอดขายสูงสุดต่อชุด เมื่อเกินจะมีคำเตือน
                                </p>
                            </div>

                            <div>
                                <label className="label">เกณฑ์เลขเสี่ยง (บาท)</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={settings.riskyThreshold}
                                    onChange={(e) => handleThresholdChange(e.target.value)}
                                    className="input"
                                    min="0"
                                />
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    ยอดขายที่แสดงในรายการเลขเสี่ยง
                                </p>
                            </div>
                        </div>

                        {/* Firebase Status Section */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                            <h4 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">
                                สถานะการเชื่อมต่อ Firebase
                            </h4>
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${firebaseStatus ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                                <span className={firebaseStatus ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-500 font-medium'}>
                                    {firebaseStatus ? 'เชื่อมต่อสำเร็จ (Connected)' : 'ยังไม่เชื่อมต่อ (Not Connected)'}
                                </span>
                            </div>
                            {!firebaseStatus && (
                                <div className="mt-3 text-sm text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-lg font-mono">
                                    <p className="mb-2">⚠️ ไม่พบการเชื่อมต่อ กรุณาตรวจสอบไฟล์ .env</p>
                                    <div className="opacity-75 text-xs">
                                        VITE_FIREBASE_API_KEY=...<br />
                                        VITE_FIREBASE_PROJECT_ID=...<br />
                                        VITE_FIREBASE_AUTH_DOMAIN=...<br />
                                        ...
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                                <input
                                    type="checkbox"
                                    checked={settings.mergeDuplicates}
                                    onChange={(e) => updateSettings({ mergeDuplicates: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm sm:text-base text-gray-700 dark:text-slate-300">
                                    รวมรายการซ้ำในบิลเดียวกัน
                                </span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Blocked Numbers Tab */}
                {activeTab === 'blocked' && (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                                เลขอั้น ({blockedNumbers.length})
                            </h3>
                            <button onClick={() => setShowAddBlocked(true)} className="btn-primary btn-sm">
                                + เพิ่มเลขอั้น
                            </button>
                        </div>

                        {blockedNumbers.length > 0 ? (
                            <div className="space-y-3">
                                {blockedNumbers.map((blocked) => (
                                    <div
                                        key={blocked.id}
                                        className={`p-3 sm:p-4 rounded-xl border ${blocked.enabled
                                            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                            : 'bg-gray-50 border-gray-200 dark:bg-slate-700/50 dark:border-slate-600 opacity-50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            {/* Number Info */}
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                                <span className="font-mono text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100">
                                                    {blocked.number}
                                                </span>
                                                <span className="badge-primary text-xs">{CATEGORY_LABELS[blocked.category]}</span>
                                                <span className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                                                    จ่าย: <strong>{blocked.payoutOverride}</strong> บาท
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleToggleBlocked(blocked)}
                                                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${blocked.enabled
                                                        ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                                                        : 'bg-gray-200 text-gray-600 dark:bg-slate-600 dark:text-slate-300'
                                                        }`}
                                                >
                                                    {blocked.enabled ? 'เปิด' : 'ปิด'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBlocked(blocked.id)}
                                                    className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                >
                                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                                <div className="text-4xl mb-4">🔢</div>
                                <p>ยังไม่มีเลขอั้น</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Storage Tab */}
                {activeTab === 'storage' && (
                    <div className="space-y-4 sm:space-y-6">
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                                สถานะการบันทึกข้อมูล
                            </h3>
                            <div className={`p-4 rounded-xl border flex items-center gap-3 ${firebaseStatus
                                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                                }`}>
                                <div className={`p-2 rounded-full ${firebaseStatus ? 'bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-200' : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-600 dark:text-yellow-200'}`}>
                                    {firebaseStatus ? '☁️' : '⏳'}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-slate-100">
                                        {firebaseStatus ? 'ระบบ Sync ข้อมูลอัตโนมัติ' : 'กำลังเชื่อมต่อระบบ...'}
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-slate-400">
                                        ข้อมูลจะถูกส่งเข้าฐานข้อมูลตลอดเวลา (รองรับการใช้งานแบบ Offline)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {settings.storageMode !== 'Off' && (
                            <div>
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                                    Firebase Configuration
                                </h3>
                                <div className="space-y-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
                                        กรุณาตั้งค่า Firebase ในไฟล์ Environment Variables หรือกรอกข้อมูลด้านล่าง:
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <input
                                            type="text"
                                            placeholder="API Key"
                                            className="input"
                                            value={settings.firebaseConfig?.apiKey ?? ''}
                                            onChange={(e) =>
                                                updateSettings({
                                                    firebaseConfig: { ...settings.firebaseConfig, apiKey: e.target.value },
                                                })
                                            }
                                        />
                                        <input
                                            type="text"
                                            placeholder="Project ID"
                                            className="input"
                                            value={settings.firebaseConfig?.projectId ?? ''}
                                            onChange={(e) =>
                                                updateSettings({
                                                    firebaseConfig: { ...settings.firebaseConfig, projectId: e.target.value },
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="label">Conflict Resolution</label>
                                    <select
                                        value={settings.conflictResolution}
                                        onChange={(e) =>
                                            updateSettings({ conflictResolution: e.target.value as 'remote' | 'local' })
                                        }
                                        className="select"
                                    >
                                        <option value="remote">ใช้ข้อมูล Remote (ล่าสุดชนะ)</option>
                                        <option value="local">ใช้ข้อมูล Local</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Export/Import Tab */}
                {activeTab === 'export' && (
                    <div className="space-y-4 sm:space-y-6">
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                                ส่งออกข้อมูล
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                                ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับสำรองข้อมูล
                            </p>
                            <button onClick={handleExport} disabled={isSaving} className="btn-primary w-full sm:w-auto">
                                {isSaving ? (
                                    <>
                                        <span className="spinner"></span>
                                        กำลังส่งออก...
                                    </>
                                ) : (
                                    <>📦 ดาวน์โหลด Backup</>
                                )}
                            </button>
                        </div>

                        <hr className="border-gray-200 dark:border-slate-700" />

                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 sm:mb-4">
                                นำเข้าข้อมูล
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                                นำเข้าข้อมูลจากไฟล์ JSON ที่ได้จากการส่งออก
                            </p>
                            <div className="p-6 sm:p-8 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-center bg-gray-50 dark:bg-slate-700/30">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    className="hidden"
                                    id="import-file"
                                    disabled={isSaving}
                                />
                                <label
                                    htmlFor="import-file"
                                    className="cursor-pointer block text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                                >
                                    <div className="text-4xl mb-2">📂</div>
                                    <p className="text-sm sm:text-base">คลิกเพื่อเลือกไฟล์</p>
                                </label>
                            </div>
                            <p className="text-xs sm:text-sm text-red-600 mt-3 flex items-center gap-1">
                                <span>⚠️</span> การนำเข้าจะแทนที่ข้อมูลทั้งหมดที่มีอยู่
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Reset Tab */}
            {activeTab === 'reset' && (
                <div className="space-y-4 sm:space-y-6">
                    {/* Current Shop Info */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>🏪 เจ้ามือปัจจุบัน:</strong> {tenantName || tenantSlug}
                        </p>
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                            การล้างข้อมูลจะมีผลเฉพาะเจ้ามือนี้เท่านั้น ไม่กระทบเจ้ามืออื่น
                        </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                        <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                            💀 พื้นที่อันตราย
                        </h3>
                        <p className="text-gray-600 dark:text-slate-400 mb-6">
                            การล้างข้อมูลจะลบข้อมูลทั้งหมดของเจ้ามือ <strong className="text-red-600">{tenantName || tenantSlug}</strong>
                            <br />รวมถึงบิล หวยที่ออก และการตั้งค่าต่างๆ
                            <br />การดำเนินการนี้ไม่สามารถย้อนกลับได้
                        </p>
                        <button
                            onClick={() => setResetStep(1)}
                            className="btn-danger text-lg px-8 py-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                        >
                            ล้างข้อมูลเจ้ามือ {tenantName || tenantSlug}
                        </button>
                    </div>
                </div>
            )}


            {/* Factory Reset Modal - 3 Steps */}
            {
                resetStep > 0 && (
                    <div className="modal-overlay" onClick={() => setResetStep(0)}>
                        <div className="modal-content text-center max-w-sm" onClick={(e) => e.stopPropagation()}>
                            {resetStep === 1 && (
                                <div className="animate-fade-in">
                                    <div className="text-4xl mb-4">⚠️</div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                                        ยืนยันจะล้างข้อมูลทั้งหมดใช่หรือไหม?
                                    </h2>
                                    <p className="text-gray-500 dark:text-slate-400 mb-6">
                                        ข้อมูลทั้งหมดจะหายไปกู้คืนไม่ได้นะ
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setResetStep(0)} className="btn-secondary">
                                            ยกเลิก
                                        </button>
                                        <button onClick={() => setResetStep(2)} className="btn-danger">
                                            ใช่ ล้างเลย
                                        </button>
                                    </div>
                                </div>
                            )}

                            {resetStep === 2 && (
                                <div className="animate-fade-in">
                                    <div className="text-4xl mb-4">🤔</div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">
                                        แน่ใจนะครับคุณแม่?
                                    </h2>
                                    <p className="text-gray-500 dark:text-slate-400 mb-6">
                                        มันหายจริงๆ นะ ไม่ได้ขู่นะ
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setResetStep(0)} className="btn-secondary">
                                            ไม่ดีกว่า
                                        </button>
                                        <button onClick={() => setResetStep(3)} className="btn-danger">
                                            แน่ใจจ๊ะลูก
                                        </button>
                                    </div>
                                </div>
                            )}

                            {resetStep === 3 && (
                                <div className="animate-fade-in">
                                    <img
                                        src="/confirm_reset_meme.png"
                                        alt="Are you sure meme"
                                        className="w-full h-80 object-contain rounded-xl mb-4 bg-transparent"
                                    />
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                                        แน่ใจจริงๆ นะแม่...
                                    </h2>
                                    <p className="text-gray-500 dark:text-slate-400 mb-6 text-sm">
                                        ดูหน้าน้องสิ... เอาจริงดิ?
                                    </p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <button onClick={handleFactoryReset} className="btn-danger text-lg font-bold py-3 animate-pulse">
                                            ล้างเลยแม่! (ลาก่อน)
                                        </button>
                                        <button onClick={() => setResetStep(0)} className="btn-primary">
                                            โอ๋ๆ ไม่ล้างแล้ว
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Add Blocked Number Modal (Existing) */}
            {
                showAddBlocked && (
                    <div className="modal-overlay" onClick={() => setShowAddBlocked(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100">
                                    เพิ่มเลขอั้น
                                </h2>
                            </div>
                            <div className="modal-body space-y-4">
                                <div>
                                    <label className="label">หมายเลข</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={newBlocked.number}
                                        onChange={(e) =>
                                            setNewBlocked({ ...newBlocked, number: e.target.value.replace(/\D/g, '') })
                                        }
                                        className="input font-mono text-xl text-center"
                                        placeholder="123"
                                        maxLength={3}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="label">ประเภท</label>
                                    <select
                                        value={newBlocked.category}
                                        onChange={(e) =>
                                            setNewBlocked({ ...newBlocked, category: e.target.value as Category })
                                        }
                                        className="select"
                                    >
                                        {CATEGORIES.map((cat) => (
                                            <option key={cat} value={cat}>
                                                {CATEGORY_LABELS[cat]}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">อัตราจ่าย Override (บาทละ)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={newBlocked.payoutOverride}
                                        onChange={(e) => setNewBlocked({ ...newBlocked, payoutOverride: e.target.value })}
                                        className="input"
                                        placeholder="100"
                                        min="0"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setShowAddBlocked(false)} className="btn-secondary flex-1 sm:flex-none">
                                    ยกเลิก
                                </button>
                                <button onClick={handleAddBlocked} className="btn-primary flex-1 sm:flex-none">
                                    เพิ่มเลขอั้น
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
