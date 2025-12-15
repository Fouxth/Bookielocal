/**
 * Authentication Store
 * 
 * Manages user authentication state and actions.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@shared/schemas';
import * as db from '../storage/db';
import { verifyPassword } from '../utils/crypto';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    changePassword: (newPassword: string) => Promise<boolean>;
    checkAuth: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            login: async (username: string, password: string) => {
                set({ isLoading: true, error: null });

                try {
                    // Case-insensitive username lookup
                    const user = await db.getUserByUsername(username.toLowerCase());

                    if (!user) {
                        set({ error: 'Invalid username or password', isLoading: false });
                        return false;
                    }

                    const isValid = await verifyPassword(password, user.passwordHash);

                    if (!isValid) {
                        set({ error: 'Invalid username or password', isLoading: false });
                        return false;
                    }

                    set({
                        user,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });

                    return true;
                } catch (error) {
                    set({
                        error: 'Login failed. Please try again.',
                        isLoading: false,
                    });
                    return false;
                }
            },

            logout: () => {
                set({
                    user: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            changePassword: async (newPassword: string) => {
                const { user } = get();
                if (!user) return false;

                try {
                    await db.updateUserPassword(user.id, newPassword);

                    // Update local state
                    set({
                        user: {
                            ...user,
                            mustChangePassword: false,
                        },
                    });

                    return true;
                } catch (error) {
                    set({ error: 'Failed to change password' });
                    return false;
                }
            },

            checkAuth: async () => {
                const { user } = get();

                if (user) {
                    // Verify user still exists in DB
                    const dbUser = await db.getUser(user.id);
                    if (dbUser) {
                        set({ isAuthenticated: true, isLoading: false });
                        return;
                    }
                }

                set({ user: null, isAuthenticated: false, isLoading: false });
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'bookielocal-auth',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

/**
 * Check if current user is admin
 */
export function useIsAdmin(): boolean {
    const user = useAuthStore((state) => state.user);
    return user?.role === 'admin';
}

/**
 * Get current user ID
 */
export function useUserId(): string | null {
    const user = useAuthStore((state) => state.user);
    return user?.id ?? null;
}

/**
 * Get current username
 */
export function useUsername(): string | null {
    const user = useAuthStore((state) => state.user);
    return user?.username ?? null;
}
