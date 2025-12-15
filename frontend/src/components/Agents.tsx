import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useIsAdmin } from '../store/authStore';
import { Agent } from '@shared/schemas';

export default function Agents() {
    const agents = useAppStore((state) => state.agents);
    const tickets = useAppStore((state) => state.tickets);
    const createAgent = useAppStore((state) => state.createAgent);
    const updateAgent = useAppStore((state) => state.updateAgent);
    const deleteAgent = useAppStore((state) => state.deleteAgent);
    const isAdmin = useIsAdmin();

    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState<Agent | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Agent | null>(null);
    const [newName, setNewName] = useState('');
    const [editName, setEditName] = useState('');

    const handleCreate = async () => {
        if (!newName.trim()) return;
        await createAgent(newName.trim());
        setNewName('');
        setShowCreate(false);
    };

    const handleUpdate = async () => {
        if (!showEdit || !editName.trim()) return;
        await updateAgent(showEdit.id, editName.trim());
        setShowEdit(null);
        setEditName('');
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) return;
        await deleteAgent(showDeleteConfirm.id);
        setShowDeleteConfirm(null);
    };

    const getAgentStats = (agentId: string) => {
        const agentTickets = tickets.filter((t) => t.agentId === agentId && !t.deleted);
        const totalSales = agentTickets.reduce((sum, t) => sum + t.billTotal, 0);
        return { ticketCount: agentTickets.length, totalSales };
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        เจ้าที่ส่ง
                    </h1>
                    <p className="text-gray-500 dark:text-slate-400">
                        จัดการรายชื่อเจ้าที่ส่ง
                    </p>
                </div>
                {isAdmin && (
                    <button onClick={() => setShowCreate(true)} className="btn-primary">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        เพิ่มเจ้าใหม่
                    </button>
                )}
            </div>

            {/* Agents Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {agents.map((agent) => {
                    const stats = getAgentStats(agent.id);
                    return (
                        <div key={agent.id} className="card p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                                        {agent.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-slate-100">
                                            {agent.name}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-slate-400 mt-1">
                                            <span>{stats.ticketCount} บิล</span>
                                            <span>•</span>
                                            <span>฿{stats.totalSales.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                                setShowEdit(agent);
                                                setEditName(agent.name);
                                            }}
                                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                            title="แก้ไข"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteConfirm(agent)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="ลบ"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {agents.length === 0 && (
                    <div className="col-span-2 card p-12 text-center">
                        <div className="text-4xl mb-4">👤</div>
                        <p className="text-gray-500 dark:text-slate-400">ยังไม่มีเจ้าที่ส่ง</p>
                        {isAdmin && (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="btn-primary mt-4"
                            >
                                เพิ่มเจ้าแรก
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                เพิ่มเจ้าที่ส่งใหม่
                            </h2>
                        </div>
                        <div className="modal-body">
                            <label className="label">ชื่อเจ้า</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="input"
                                placeholder="กรอกชื่อเจ้าที่ส่ง"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowCreate(false)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={handleCreate} className="btn-primary">
                                เพิ่ม
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEdit && (
                <div className="modal-overlay" onClick={() => setShowEdit(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                แก้ไขชื่อเจ้า
                            </h2>
                        </div>
                        <div className="modal-body">
                            <label className="label">ชื่อเจ้า</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="input"
                                placeholder="กรอกชื่อใหม่"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                            />
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowEdit(null)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={handleUpdate} className="btn-primary">
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                                ยืนยันการลบ
                            </h2>
                        </div>
                        <div className="modal-body">
                            <p className="text-gray-600 dark:text-slate-400">
                                ต้องการลบเจ้า <strong>{showDeleteConfirm.name}</strong> หรือไม่?
                            </p>
                            <p className="text-sm text-red-600 mt-2">
                                การลบเจ้าจะไม่ลบบิลที่เกี่ยวข้อง แต่จะแสดงเป็น "Unknown"
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">
                                ยกเลิก
                            </button>
                            <button onClick={handleDelete} className="btn-danger">
                                ลบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
