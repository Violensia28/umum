import { state } from './state.js';
import { ut } from './utils.js';

export const db = {
    // Sync data dari GitHub
    sync: async (appRenderCallback) => {
        const {owner, repo, path, token} = state.config; 
        if(!token) return { status: 'error', message: 'Token kosong' };
        
        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { 
                headers: {'Authorization': `token ${token}`} 
            });
            
            if(res.ok) {
                const json = await res.json();
                state.sha = json.sha;
                // Decode dan Merge
                const cloudData = JSON.parse(ut.b64Dec(json.content));
                
                // Hati-hati saat merge agar tidak menimpa data lokal yang belum disave jika konflik
                // Untuk single user, kita bisa asumsikan cloud is truth, tapi jalankan migrasi
                state.db = { ...state.db, ...cloudData };
                
                // Jalankan migrasi setiap kali sync untuk memastikan data cloud lama terupdate strukturnya
                state.initMigration();
                
                return { status: 'success' };
            } else if(res.status === 404) {
                // File belum ada, inisialisasi
                await db.push("Init DB v2");
                return { status: 'success', message: 'DB Inited' };
            } else {
                return { status: 'error', message: res.statusText };
            }
        } catch(e) {
            console.error(e);
            return { status: 'error', message: e.message };
        }
    },

    // Push data ke GitHub
    push: async (msg) => {
        const {owner, repo, path, token} = state.config;
        if(!token) return;

        // Pastikan meta updated
        state.db.meta.last_updated = new Date().toISOString();

        try {
            const body = { 
                message: msg, 
                content: ut.b64Enc(JSON.stringify(state.db)), 
                sha: state.sha 
            };
            
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { 
                method: 'PUT', 
                headers: {'Authorization': `token ${token}`}, 
                body: JSON.stringify(body) 
            });
            
            if(res.ok) {
                const json = await res.json();
                state.sha = json.content.sha; // Update SHA baru penting agar sync berikutnya tidak error
                return true;
            }
        } catch(e) {
            console.error("Push failed", e);
            return false;
        }
    }
};
