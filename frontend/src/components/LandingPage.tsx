/**
 * Landing Page - Shop Login
 * 
 * Users enter their shop slug and password to login.
 * No public registration - shops are created by admin only.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantStore } from '../store/tenantStore';

export default function LandingPage() {
    const [slug, setSlug] = useState('');
    const [password, setPassword] = useState('');
    const [step, setStep] = useState<'slug' | 'password'>('slug');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const { checkTenantExists, verifyTenantPassword } = useTenantStore();

    const handleCheckShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug.trim()) {
            setError('กรุณากรอกรหัสเจ้ามือ');
            return;
        }

        setIsLoading(true);
        setError('');

        const exists = await checkTenantExists(slug.toLowerCase().trim());

        if (exists) {
            setStep('password');
        } else {
            setError('ไม่พบเจ้ามือนี้ในระบบ');
        }

        setIsLoading(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('กรุณากรอกรหัสผ่าน');
            return;
        }

        setIsLoading(true);
        setError('');

        const success = await verifyTenantPassword(slug.toLowerCase().trim(), password);

        if (success) {
            // Redirect directly to the app (no separate login page needed)
            navigate(`/${slug.toLowerCase().trim()}/entry`);
        } else {
            // Error is set by verifyTenantPassword
            setError('รหัสผ่านไม่ถูกต้อง');
        }

        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl mb-4">
                        <span className="text-4xl">📝</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">BookieLocal</h1>
                    <p className="text-slate-400">ระบบจัดการหวยออนไลน์</p>
                </div>

                {/* Main Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20">
                    {step === 'slug' && (
                        <form onSubmit={handleCheckShop} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    User เจ้ามือ
                                </label>
                                <input
                                    type="text"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="เช่น lungpon, shop123"
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    disabled={isLoading}
                                    autoFocus
                                />
                                {error && (
                                    <p className="mt-2 text-sm text-red-400">{error}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        กำลังตรวจสอบ...
                                    </span>
                                ) : (
                                    'ถัดไป →'
                                )}
                            </button>
                        </form>
                    )}

                    {step === 'password' && (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-2">
                                <p className="text-green-400 text-sm">
                                    ✓ พบเจ้ามือ <strong>{slug}</strong>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    รหัสผ่านเจ้ามือ
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="กรอกรหัสผ่าน"
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    disabled={isLoading}
                                    autoFocus
                                />
                                {error && (
                                    <p className="mt-2 text-sm text-red-400">{error}</p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep('slug');
                                        setPassword('');
                                        setError('');
                                    }}
                                    className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all"
                                >
                                    ← ย้อนกลับ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่เจ้ามือ'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    © 2026 BookieLocal - Multi-Tenant Edition
                    <br />
                    <span className="text-xs">ติดต่อใครไม่รู้เพื่อสร้างเจ้ามือใหม่</span>
                </p>
            </div>
        </div>
    );
}
