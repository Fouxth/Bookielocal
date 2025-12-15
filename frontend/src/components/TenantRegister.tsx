/**
 * Admin: Create New Shop
 * 
 * Only accessible by admin/owner. Creates a new tenant/shop.
 * URL: /admin/create-shop (protected, not linked from public pages)
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenantStore, generateSlug } from '../store/tenantStore';

export default function TenantRegister() {
    const [shopName, setShopName] = useState('');
    const [slug, setSlug] = useState('');
    const [shopPassword, setShopPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { createTenant } = useTenantStore();

    // Auto-generate slug from shop name
    const handleShopNameChange = (name: string) => {
        setShopName(name);
        if (!slug || slug === generateSlug(shopName)) {
            setSlug(generateSlug(name));
        }
    };

    const handleCreateShop = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        // Validations
        if (!shopName.trim()) {
            setError('กรุณากรอกชื่อเจ้ามือ');
            return;
        }
        if (!slug.trim() || slug.length < 3) {
            setError('รหัสเจ้ามือต้องมีอย่างน้อย 3 ตัวอักษร');
            return;
        }
        if (!/^[a-z0-9-]+$/.test(slug)) {
            setError('รหัสเจ้ามือใช้ได้เฉพาะ a-z, 0-9 และ - เท่านั้น');
            return;
        }
        if (!shopPassword || shopPassword.length < 4) {
            setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
            return;
        }
        if (shopPassword !== confirmPassword) {
            setError('รหัสผ่านไม่ตรงกัน');
            return;
        }

        setIsLoading(true);

        try {
            const tenant = await createTenant(shopName, slug, shopPassword);

            if (tenant) {
                setSuccessMessage(`สร้างเจ้ามือ "${tenant.name}" สำเร็จ! รหัสเจ้ามือ: ${tenant.slug}`);
                // Clear form
                setShopName('');
                setSlug('');
                setShopPassword('');
                setConfirmPassword('');
            } else {
                // Get the latest error from store
                const latestError = useTenantStore.getState().error;
                setError(latestError || 'ไม่สามารถสร้างเจ้ามือได้');
            }
        } catch (err) {
            console.error('Create shop failed:', err);
            setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl mb-4">
                        <span className="text-4xl">🔧</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
                    <p className="text-slate-400">สร้างเจ้ามือใหม่สำหรับลูกค้า</p>
                </div>

                {/* Form Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20">
                    <form onSubmit={handleCreateShop} className="space-y-5">
                        {/* Success Message */}
                        {successMessage && (
                            <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4">
                                <p className="text-green-400 text-sm">✓ {successMessage}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                ชื่อเจ้ามือ
                            </label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => handleShopNameChange(e.target.value)}
                                placeholder="เช่น เจ้ามือลุงพล"
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                รหัสเจ้ามือ (สำหรับ URL)
                            </label>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-slate-500 text-sm hidden sm:inline">bookielocal.vercel.app → </span>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    placeholder="lungpon"
                                    className="flex-1 min-w-[150px] px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                                />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">ใช้ a-z, 0-9 และ - เท่านั้น</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                รหัสผ่านเจ้ามือ
                            </label>
                            <input
                                type="password"
                                value={shopPassword}
                                onChange={(e) => setShopPassword(e.target.value)}
                                placeholder="อย่างน้อย 4 ตัวอักษร"
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                            />
                            <p className="mt-1 text-xs text-slate-500">รหัสนี้ใช้สำหรับเข้าเจ้ามือ (ลูกค้าต้องใส่)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                ยืนยันรหัสผ่าน
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="กรอกรหัสผ่านอีกครั้ง"
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4">
                                <p className="text-red-400 text-sm">✕ {error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    กำลังสร้าง...
                                </span>
                            ) : (
                                '🆕 สร้างเจ้ามือใหม่'
                            )}
                        </button>
                    </form>
                </div>

                {/* Back Link */}
                <div className="text-center mt-6">
                    <Link to="/" className="text-slate-400 hover:text-white transition">
                        ← กลับหน้าหลัก
                    </Link>
                </div>
            </div>
        </div>
    );
}
