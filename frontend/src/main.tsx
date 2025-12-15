import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { seedDemoData } from './storage/db';
import { initializeFirebase } from './storage/sync';

// Initialize Firebase from environment variables (for public pages like /register)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize if config is available
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    initializeFirebase(firebaseConfig);
    console.log('[Main] Firebase initialized from env variables');
}

// Seed demo data on first load
seedDemoData().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
