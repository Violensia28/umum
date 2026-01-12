import { state } from './state.js';

/**
 * db.js - Modul Koneksi Database (GitHub API)
 * Menangani sinkronisasi data (Pull/Push) ke repository GitHub.
 * Mengubah TechPartner 6.0 menjadi "Serverless App".
 */
export const db = {
    // Helper URL
    url: () => `https://api.github.com/repos/${state.config.owner}/${state.config.repo}/contents/database.json`,

    // 1. SINKRONISASI (Pull dari Cloud)
    // Dipanggil saat app.init() atau tombol Sync ditekan
    sync: async () => {
        // Cek kelengkapan config
        if (!state.config.owner || !state.config.repo || !state.config.token) {
            return { status: 'error', message: 'Token/Repo belum disetting.' };
        }

        try {
            // Fetch data dari GitHub API
            const res = await fetch(db.url(), {
                headers: { 
                    'Authorization': `token ${state.config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store' // Anti-cache agar selalu dapat data terbaru
            });

            // Jika file belum ada (404), kita buat baru nanti
            if (res.status === 404) {
                console.log("Database belum ada, inisialisasi baru...");
                await db.push("Init Database TechPartner 6.0");
                return { status: 'success', message: 'Database baru dibuat.' };
            }

            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            const data = await res.json();
            
            // Dekode konten Base64 dari GitHub (Support UTF-8/Emoji)
            const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
            
            // PENTING: Simpan SHA (Checksum) untuk izin update berikutnya
            state.db.sha = data.sha;
            
            // Update State Lokal dengan Data dari Cloud
            // Kita gunakan teknik merge aman agar field lokal tidak tertimpa null
            state.db.meta = content.meta || state.db.meta;
            state.db.assets = content.assets || [];
            state.db.work_orders = content.work_orders || [];
            state.db.activities = content.activities || [];
            state.db.finances = content.finances || [];
            
            // Update timestamp sync terakhir
            state.db.meta.last_sync = new Date().toISOString();
            
            return { status: 'success', message: 'Data tersinkronisasi.' };

        } catch (err) {
            console.error("Sync Failed:", err);
            return { status: 'error', message: err.message };
        }
    },

    // 2. PUSH (Simpan ke Cloud)
    // Dipanggil setiap kali ada aksi (Simpan Aset, WO Selesai, dll)
    push: async (commitMsg = "Update Data") => {
        // Jika tidak ada token, anggap mode offline (hanya simpan di memori)
        if (!state.config.token) {
            console.warn("Offline Mode: Data disimpan di memori browser saja.");
            return; 
        }

        try {
            // Siapkan payload data
            const content = {
                meta: state.db.meta,
                assets: state.db.assets,
                work_orders: state.db.work_orders,
                activities: state.db.activities,
                finances: state.db.finances
            };

            // Encode ke Base64 (Handling karakter UTF-8/Emoji agar tidak error di GitHub)
            const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
            
            const payload = {
                message: `TechPartner: ${commitMsg}`,
                content: b64,
                sha: state.db.sha // Wajib menyertakan SHA terakhir untuk update
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
                state.db.sha = data.content.sha; // Update SHA baru untuk transaksi berikutnya
                console.log("Cloud Save OK:", commitMsg);
            } else {
                console.warn("Cloud Save Failed:", res.status);
            }

        } catch (err) {
            console.warn("Network Error during Save:", err);
            // Di sini bisa ditambahkan logika antrean offline (Queue) untuk V2
        }
    }
};
