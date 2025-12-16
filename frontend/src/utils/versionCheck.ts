// Clear site data when app version changes
// This ensures users get fresh data after a new deployment

const APP_VERSION_KEY = 'app_version';
const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || Date.now().toString();

export async function checkVersionAndClear(): Promise<boolean> {
    const storedVersion = localStorage.getItem(APP_VERSION_KEY);

    if (storedVersion !== CURRENT_VERSION) {
        console.log(`[Version] Version changed from ${storedVersion} to ${CURRENT_VERSION}, clearing site data...`);

        try {
            // Clear localStorage (except version key)
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key !== APP_VERSION_KEY) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Clear sessionStorage
            sessionStorage.clear();

            // Clear all IndexedDB databases
            const databases = await indexedDB.databases?.() || [];
            for (const db of databases) {
                if (db.name) {
                    console.log(`[Version] Deleting IndexedDB: ${db.name}`);
                    indexedDB.deleteDatabase(db.name);
                }
            }

            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    console.log(`[Version] Deleting cache: ${cacheName}`);
                    await caches.delete(cacheName);
                }
            }

            // Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    console.log('[Version] Unregistering service worker');
                    await registration.unregister();
                }
            }

            // Store new version
            localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);

            console.log('[Version] Site data cleared successfully');
            return true; // Data was cleared
        } catch (error) {
            console.error('[Version] Failed to clear site data:', error);
            localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);
            return false;
        }
    }

    return false; // No clearing needed
}
