/**
 * Tenant Store
 * 
 * Manages multi-tenant state for the application.
 * Each tenant has their own isolated data in Firebase and IndexedDB.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    collection,
    doc,
    setDoc,
    updateDoc,
    query,
    where,
    getDocs,
} from 'firebase/firestore';
import { getFirestoreInstance, setCurrentTenant } from '../storage/sync';
import { setDbTenant } from '../storage/db';
import { v4 as uuidv4 } from 'uuid';

export interface Tenant {
    slug: string;  // slug is the document ID
    name: string;
    passwordHash: string;  // bcrypt hashed password for shop login
    createdAt: string;
    createdBy?: string;  // admin who created this shop
    activeSessionId?: string;  // Currently active session (for single session enforcement)
}

interface TenantState {
    // Current tenant info
    tenantId: string | null;  // same as slug
    tenantSlug: string | null;
    tenantName: string | null;
    sessionId: string | null;  // This browser's session ID
    isLoading: boolean;
    error: string | null;

    // Actions
    checkTenantExists: (slug: string) => Promise<boolean>;
    verifyTenantPassword: (slug: string, password: string) => Promise<boolean>;
    setTenant: (slug: string, name: string) => void;
    createTenant: (name: string, slug: string, password: string) => Promise<Tenant | null>;
    clearTenant: () => void;
    getTenantPath: () => string;
    checkSession: () => Promise<boolean>;  // Verify session is still valid
}

export const useTenantStore = create<TenantState>()(
    persist(
        (set, get) => ({
            tenantId: null,
            tenantSlug: null,
            tenantName: null,
            sessionId: null,
            isLoading: false,
            error: null,

            checkTenantExists: async (slug: string) => {
                try {
                    const firestore = getFirestoreInstance();
                    if (!firestore) {
                        return false;
                    }

                    // slug is the document ID
                    const tenantSnap = await getDocs(query(collection(firestore, 'tenants'), where('slug', '==', slug.toLowerCase())));

                    return !tenantSnap.empty;
                } catch (error) {
                    console.error('Failed to check tenant:', error);
                    return false;
                }
            },

            verifyTenantPassword: async (slug: string, password: string) => {
                set({ isLoading: true, error: null });

                try {
                    const firestore = getFirestoreInstance();
                    if (!firestore) {
                        set({ error: 'ไม่สามารถเชื่อมต่อได้', isLoading: false });
                        return false;
                    }

                    // Get tenant by slug (slug is document ID)
                    const tenantSnap = await getDocs(query(collection(firestore, 'tenants'), where('slug', '==', slug.toLowerCase())));

                    if (tenantSnap.empty) {
                        set({ error: 'ไม่พบเจ้ามือนี้', isLoading: false });
                        return false;
                    }

                    const tenantDoc = tenantSnap.docs[0];
                    const tenantData = tenantDoc.data() as Tenant;

                    // Verify password using bcrypt
                    const { verifyPassword } = await import('../utils/crypto');
                    const isValid = await verifyPassword(password, tenantData.passwordHash);

                    if (!isValid) {
                        set({ error: 'รหัสผ่านไม่ถูกต้อง', isLoading: false });
                        return false;
                    }

                    // Generate new session ID for single session enforcement
                    const newSessionId = uuidv4();

                    // Save session ID to Firebase (this invalidates other sessions)
                    await updateDoc(tenantDoc.ref, {
                        activeSessionId: newSessionId,
                    });

                    // Set current tenant
                    setCurrentTenant(tenantData.slug);
                    setDbTenant(tenantData.slug);
                    set({
                        tenantId: tenantData.slug,
                        tenantSlug: tenantData.slug,
                        tenantName: tenantData.name,
                        sessionId: newSessionId,
                        isLoading: false,
                        error: null,
                    });

                    return true;
                } catch (error) {
                    console.error('Failed to verify tenant password:', error);
                    set({ error: 'เกิดข้อผิดพลาด', isLoading: false });
                    return false;
                }
            },

            setTenant: (slug: string, name: string) => {
                setCurrentTenant(slug);
                setDbTenant(slug);
                set({
                    tenantId: slug,
                    tenantSlug: slug,
                    tenantName: name,
                    error: null,
                });
            },

            createTenant: async (name: string, slug: string, password: string) => {
                set({ isLoading: true, error: null });

                try {
                    const firestore = getFirestoreInstance();
                    if (!firestore) {
                        set({ error: 'ไม่สามารถเชื่อมต่อ Firebase ได้', isLoading: false });
                        return null;
                    }

                    const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');

                    // Check if slug already exists
                    const existingTenant = await getDocs(query(collection(firestore, 'tenants'), where('slug', '==', normalizedSlug)));

                    if (!existingTenant.empty) {
                        set({ error: 'ชื่อเจ้ามือนี้ถูกใช้แล้ว', isLoading: false });
                        return null;
                    }

                    // Hash password
                    const { hashPassword } = await import('../utils/crypto');
                    const passwordHash = await hashPassword(password);

                    // Create new tenant (use slug as document ID)
                    const tenant: Tenant = {
                        slug: normalizedSlug,
                        name,
                        passwordHash,
                        createdAt: new Date().toISOString(),
                    };

                    // Use slug as document ID for easy lookup
                    await setDoc(doc(firestore, 'tenants', normalizedSlug), tenant);

                    // Set current tenant
                    setCurrentTenant(normalizedSlug);
                    setDbTenant(normalizedSlug);
                    set({
                        tenantId: normalizedSlug,
                        tenantSlug: normalizedSlug,
                        tenantName: name,
                        isLoading: false,
                        error: null,
                    });

                    return tenant;
                } catch (error) {
                    console.error('Failed to create tenant:', error);
                    set({
                        error: 'เกิดข้อผิดพลาดในการสร้างเจ้ามือ',
                        isLoading: false,
                    });
                    return null;
                }
            },

            clearTenant: () => {
                setCurrentTenant(null); // Clear tenant from sync layer
                setDbTenant(null); // Clear tenant from IndexedDB
                set({
                    tenantId: null,
                    tenantSlug: null,
                    tenantName: null,
                    sessionId: null,
                    error: null,
                });
            },

            // Check if current session is still valid (single session enforcement)
            checkSession: async () => {
                const { tenantSlug, sessionId } = get();
                if (!tenantSlug || !sessionId) {
                    return false;
                }

                try {
                    const firestore = getFirestoreInstance();
                    if (!firestore) return false;

                    const tenantSnap = await getDocs(
                        query(collection(firestore, 'tenants'), where('slug', '==', tenantSlug))
                    );

                    if (tenantSnap.empty) return false;

                    const tenantData = tenantSnap.docs[0].data() as Tenant;

                    // If session IDs don't match, another browser has logged in
                    if (tenantData.activeSessionId !== sessionId) {
                        console.warn('Session invalidated - logged in from another browser');
                        // Clear local state
                        setCurrentTenant(null);
                        setDbTenant(null);
                        set({
                            tenantId: null,
                            tenantSlug: null,
                            tenantName: null,
                            sessionId: null,
                            error: 'เซสชันหมดอายุ - มีการเข้าสู่ระบบจากอีกเบราว์เซอร์',
                        });
                        return false;
                    }

                    return true;
                } catch (error) {
                    console.error('Failed to check session:', error);
                    return false;
                }
            },

            getTenantPath: () => {
                const { tenantId } = get();
                if (!tenantId) {
                    return ''; // No tenant - use root (for backwards compatibility)
                }
                return `tenants/${tenantId}`;
            },
        }),
        {
            name: 'bookielocal-tenant',
            partialize: (state) => ({
                tenantId: state.tenantId,
                tenantSlug: state.tenantSlug,
                tenantName: state.tenantName,
                sessionId: state.sessionId,
            }),
            // Sync tenant context to sync layer when rehydrating
            onRehydrateStorage: () => (state) => {
                if (state?.tenantSlug) {
                    console.log('Rehydrating tenant context:', state.tenantSlug);
                    setCurrentTenant(state.tenantSlug);
                    setDbTenant(state.tenantSlug);
                }
            },
        }
    )
);

/**
 * Get current tenant slug from URL
 */
export function getTenantSlugFromPath(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z0-9-]+)\//);
    return match ? match[1] : null;
}

/**
 * Generate a URL-safe slug from a name
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9ก-๙\s-]/g, '') // Keep Thai chars for now
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);
}
