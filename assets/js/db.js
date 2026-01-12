import { state } from './state.js';
import { ut } from './utils.js';

/**
 * db.js - Modul Koneksi Database (GitHub API)
 * Menangani sinkronisasi data (Pull/Push) ke repository GitHub.
 * Menggunakan helper dari utils.js untuk keamanan data Base64.
 */
export const db = {
    // Helper URL
    url: () => `https://api.github.com/repos/${state.config.owner}/${state.config.repo}/contents/database.json`,

    // 1. SINKRONISASI (Pull dari Cloud)
    sync: async () => {
        // Cek konfigurasi
        if (!state.config.owner || !state.config.repo || !state.config.token) {
            return { status: 'error', message: 'Konfigurasi GitHub belum lengkap.' };
        }

        try {
            const res = await fetch(db.url(), {
                headers: { 
                    'Authorization': `token ${state.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            // Jika file belum ada (404), inisialisasi baru
            if (res.status === 404) {
                console.log("Database belum ada, inisialisasi baru...");
                await db.push("Init Database TechPartner 6.0");
                return { status: 'success', message: 'Database baru dibuat.' };
            }

            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            
            // GUNAKAN ut.b64Dec (Fungsi yang baru diperbaiki di utils.js)
            // Ini mencegah error saat membaca karakter Emoji/UTF-8 dari GitHub
            const content = JSON.parse(ut.b64Dec(data.content));
            
            // Simpan SHA untuk izin update berikutnya
            state.db.sha = data.sha;
            
            // Merge Data Cloud ke State Lokal
            state.db.meta = content.meta || state.db.meta;
            state.db.assets = content.assets || [];
            state.db.work_orders = content.work_orders || [];
            state.db.activities = content.activities || [];
            state.db.finances = content.finances || [];
            
            state.db.meta.last_sync = new Date().toISOString();
            
            return { status: 'success', message: 'Data tersinkronisasi.' };

        } catch (err) {
            console.error("Sync Failed:", err);
            return { status: 'error', message: err.message };
        }
    },

    // 2. PUSH (Simpan ke Cloud)
    push: async (commitMsg = "Update Data") => {
        if (!state.config.token) {
            console.warn("Offline Mode: Data disimpan di memori browser saja.");
            return; 
        }

        try {
            const content = {
                meta: state.db.meta,
                assets: state.db.assets,
                work_orders: state.db.work_orders,
                activities: state.db.activities,
                finances: state.db.finances
            };

            // GUNAKAN ut.b64Enc (Encode aman)
            const b64 = ut.b64Enc(JSON.stringify(content, null, 2));
            
            const payload = {
                message: `TechPartner: ${commitMsg}`,
                content: b64,
                sha: state.db.sha
            };

            const res = await fetch(db.url(), {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${state.config.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                state.db.sha = data.content.sha; // Update SHA baru
                console.log("Cloud Save OK:", commitMsg);
            } else {
                console.warn("Cloud Save Failed:", res.status);
            }

        } catch (err) {
            console.warn("Network Error during Save:", err);
        }
    }
};
