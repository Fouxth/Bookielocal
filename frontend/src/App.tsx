import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { useTenantStore } from './store/tenantStore';
import Layout from './components/Layout';
import TicketEntry from './components/TicketEntry';
import Dashboard from './components/Dashboard';
import Tickets from './components/Tickets';
import Agents from './components/Agents';
import Settings from './components/Settings';
import LotteryCheck from './components/LotteryCheck';
import MonthlyReport from './components/MonthlyReport';
import LandingPage from './components/LandingPage';
import TenantRegister from './components/TenantRegister';

/**
 * Tenant Route Wrapper
 * Ensures tenant is verified before rendering routes
 * If tenant not set, redirect back to landing page
 */
function TenantRouteWrapper({ children }: { children: React.ReactNode }) {
    const { tenantSlug: urlSlug } = useParams<{ tenantSlug: string }>();
    const { tenantSlug, tenantId, setTenant, isLoading } = useTenantStore();
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const initTenant = async () => {
            // If URL has a slug and it's different from current, set it
            if (urlSlug && urlSlug !== tenantSlug) {
                setTenant(urlSlug, urlSlug);
            }
            setIsInitializing(false);
        };
        initTenant();
    }, [urlSlug, tenantSlug, setTenant]);

    if (isInitializing || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                    <p className="text-slate-400">กำลังโหลดข้อมูลเจ้ามือ...</p>
                </div>
            </div>
        );
    }

    // If no tenant is set or verified, redirect to landing
    if (!tenantId) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function TenantApp() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const loadAll = useAppStore((state) => state.loadAll);

    useEffect(() => {
        // Load data when entering tenant app
        loadAll();
    }, [loadAll]);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    const toggleDarkMode = () => setDarkMode(!darkMode);
    const basePath = `/${tenantSlug}`;

    return (
        <TenantRouteWrapper>
            <Layout darkMode={darkMode} toggleDarkMode={toggleDarkMode}>
                <Routes>
                    <Route path="/" element={<Navigate to={`${basePath}/entry`} replace />} />
                    <Route path="/entry" element={<TicketEntry />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/tickets" element={<Tickets />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/lottery-check" element={<LotteryCheck />} />
                    <Route path="/report" element={<MonthlyReport />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </Layout>
        </TenantRouteWrapper>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/4dxv" element={<TenantRegister />} />

                {/* Tenant-specific Routes */}
                <Route path="/:tenantSlug/*" element={<TenantApp />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
