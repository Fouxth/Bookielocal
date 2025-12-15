import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useTenantStore } from '../store/tenantStore';
import FontSizeControl, { useFontSize } from './FontSizeControl';

interface LayoutProps {
    children: React.ReactNode;
    darkMode: boolean;
    toggleDarkMode: () => void;
}

// Base nav items (paths will be prefixed with tenant slug)
const navItems = [
    { path: '/entry', label: 'ออกบิล', icon: '📝' },
    { path: '/dashboard', label: 'สรุปยอด', icon: '📊' },
    { path: '/tickets', label: 'รายการบิล', icon: '🎫' },
    { path: '/lottery-check', label: 'ตรวจหวย', icon: '🎯' },
    { path: '/report', label: 'รายงาน', icon: '📈' },
    { path: '/agents', label: 'เจ้าที่ส่ง', icon: '👤' },
];

export default function Layout({ children, darkMode, toggleDarkMode }: LayoutProps) {
    const navigate = useNavigate();
    const syncStatus = useAppStore((state) => state.syncStatus);
    const syncNow = useAppStore((state) => state.syncNow);
    const { fontSize, setFontSize } = useFontSize();
    const { tenantSlug, tenantName, clearTenant, checkSession, error } = useTenantStore();

    // Helper to prefix path with tenant slug
    const getTenantPath = (path: string) => tenantSlug ? `/${tenantSlug}${path}` : path;

    // Check session validity on mount and periodically
    useEffect(() => {
        const validateSession = async () => {
            const isValid = await checkSession();
            if (!isValid && error?.includes('เซสชัน')) {
                // Session was invalidated, redirect to login
                navigate('/');
            }
        };

        // Check on mount
        validateSession();

        // Check every 30 seconds
        const intervalId = setInterval(validateSession, 30000);

        return () => clearInterval(intervalId);
    }, [checkSession, error, navigate]);

    // Initialize sidebar state (default closed)
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        clearTenant();
        navigate('/');  // Go back to landing page
    };

    const closeSidebar = () => {
        if (window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col z-50 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Logo */}
                <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold text-gradient">BookieLocal</h1>
                        {tenantName && (
                            <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-0.5">
                                🏪 {tenantName}
                            </p>
                        )}
                    </div>
                    {/* Close button - Mobile only (or Desktop if prefer inline close) */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 -mr-2 text-gray-500"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-2 lg:py-4 overflow-y-auto scrollbar-thin">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={getTenantPath(item.path)}
                            onClick={closeSidebar}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                            }
                        >
                            <span className="text-lg lg:text-xl">{item.icon}</span>
                            <span className="text-sm lg:text-base">{item.label}</span>
                        </NavLink>
                    ))}

                    {/* Settings - visible to everyone in shop */}
                    <NavLink
                        to={getTenantPath('/settings')}
                        onClick={closeSidebar}
                        className={({ isActive }) =>
                            `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                        }
                    >
                        <span className="text-lg lg:text-xl">⚙️</span>
                        <span className="text-sm lg:text-base">ตั้งค่า</span>
                    </NavLink>
                </nav>

                {/* Sync Status */}
                <div className="px-4 py-2 lg:py-3 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs lg:text-sm">
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${syncStatus.isOnline ? 'bg-green-500' : 'bg-red-500'
                                    }`}
                            />
                            <span className="text-gray-600 dark:text-slate-400">
                                {syncStatus.isOnline ? 'Online' : 'Offline'}
                            </span>
                        </div>
                        {syncStatus.pending > 0 && (
                            <span className="badge-warning text-xs">{syncStatus.pending} pending</span>
                        )}
                    </div>
                    {syncStatus.isOnline && syncStatus.pending > 0 && (
                        <button
                            onClick={syncNow}
                            disabled={syncStatus.isSyncing}
                            className="mt-2 w-full btn-sm btn-secondary text-xs"
                        >
                            {syncStatus.isSyncing ? (
                                <>
                                    <span className="spinner w-3 h-3"></span>
                                    Syncing...
                                </>
                            ) : (
                                'Sync Now'
                            )}
                        </button>
                    )}
                </div>

                {/* User Info */}
                <div className="p-3 lg:p-4 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 lg:gap-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm lg:text-base">
                            {tenantName?.[0]?.toUpperCase() ?? '🏪'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-slate-100 truncate text-sm lg:text-base">
                                {tenantName || tenantSlug || 'เจ้ามือ'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                                เจ้ามือ
                            </p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                            title="ออกจากระบบ"
                        >
                            <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                />
                            </svg>
                        </button>
                    </div>
                    {/* Switch Shop Button */}
                    {/* <button
                        onClick={handleSwitchShop}
                        className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        🔄 เปลี่ยนเจ้ามือ
                    </button> */}
                </div>
            </aside>

            {/* Main Content */}
            <main
                className={`min-h-screen pb-20 lg:pb-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
                    }`}
            >
                {/* Header */}
                <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border-b border-gray-200 dark:border-slate-700 safe-area-top">
                    <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between">
                        {/* Hamburger Button (Visible on both Mobile and Desktop now) */}
                        <button
                            onClick={toggleSidebar}
                            className="p-2 -ml-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>

                        <div className="flex-1 lg:flex-none">
                            {/* Logo for mobile or when sidebar is closed on desktop */}
                            <h1 className={`lg:hidden text-lg font-bold text-gradient text-center ${!sidebarOpen ? 'lg:block lg:ml-4' : ''}`}>
                                BookieLocal
                            </h1>
                        </div>

                        <div className="flex items-center gap-2 lg:gap-3">
                            {/* Font size control - hidden on mobile */}
                            <div className="hidden sm:block">
                                <FontSizeControl fontSize={fontSize} setFontSize={setFontSize} />
                            </div>
                            {/* Dark mode toggle */}
                            <button
                                onClick={toggleDarkMode}
                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
                                title={darkMode ? 'เปิดโหมดสว่าง' : 'เปิดโหมดมืด'}
                            >
                                {darkMode ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 lg:p-6">{children}</div>
            </main>

            {/* Bottom Navigation - Mobile Only */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 lg:hidden z-40 safe-area-bottom">
                <div className="flex justify-around py-2">
                    {navItems.slice(0, 5).map((item) => (
                        <NavLink
                            key={item.path}
                            to={getTenantPath(item.path)}
                            className={({ isActive }) =>
                                `flex flex-col items-center px-3 py-1.5 rounded-lg transition-colors ${isActive
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-slate-400'
                                }`
                            }
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
