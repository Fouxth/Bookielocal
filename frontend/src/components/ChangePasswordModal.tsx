import { useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface Props {
    onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const changePassword = useAuthStore((state) => state.changePassword);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('รหัสผ่านไม่ตรงกัน');
            return;
        }

        setIsLoading(true);
        const success = await changePassword(newPassword);

        if (success) {
            onClose();
        } else {
            setError('ไม่สามารถเปลี่ยนรหัสผ่านได้');
        }

        setIsLoading(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                        เปลี่ยนรหัสผ่าน
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        กรุณาเปลี่ยนรหัสผ่านเพื่อความปลอดภัย
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body space-y-4">
                        {error && (
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="newPassword" className="label">
                                รหัสผ่านใหม่
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="input"
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="label">
                                ยืนยันรหัสผ่าน
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input"
                                placeholder="กรอกรหัสผ่านอีกครั้ง"
                                required
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="submit" disabled={isLoading} className="btn-primary">
                            {isLoading ? (
                                <>
                                    <span className="spinner"></span>
                                    กำลังบันทึก...
                                </>
                            ) : (
                                'บันทึก'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
