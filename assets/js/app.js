import { state } from './state.js';
import { db } from './db.js';
import { ui } from './ui.js';
import { ut } from './utils.js';
import { ai } from './modules/ai.js';

// --- MAIN APP LOGIC ---
const app = {
    init: async () => {
        // Init tanggal laporan
        const s = dayjs().startOf('week').add(1,'day').format('YYYY-MM-DD');
        const e = dayjs().endOf('week').add(1,'day').format('YYYY-MM-DD');
        const startEl = document.getElementById('report-start');
        const endEl = document.getElementById('report-end');
        if(startEl) startEl.value = s;
        if(endEl) endEl.value = e;

        // Coba sync jika token ada
        if(state.config.token) {
            const res = await db.sync();
            if(res.status === 'success') {
                console.log("Cloud Sync Success");
            } else {
                console.log("Offline or Sync Failed:", res.message);
                // Jika offline, state.db mungkin kosong jika baru reload. 
                // Di tahap PWA nanti kita load dari localStorage/IndexedDB.
            }
        } else {
            ui.showModal('modal-settings');
        }

        // Jalankan migrasi jika perlu (local check)
        state.initMigration();
        
        // Render Awal
        ui.renderAssets();
        ui.renderActivities();
        ui.renderFinance();
    },

    // --- ACTIONS EXPOSED TO HTML ---
    syncData: async () => {
        const badge = document.getElementById('sync-badge');
        badge.classList.remove('bg-success', 'bg-danger');
        badge.classList.add('bg-warning', 'animate-pulse');
        
        const res = await db.sync();
        
        badge.classList.remove('bg-warning', 'animate-pulse');
        if(res.status === 'success') {
            badge.classList.add('bg-success');
            ui.renderAssets(); ui.renderActivities(); ui.renderFinance();
            Swal.fire({ icon: 'success', title: 'Data Terupdate', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        } else {
            badge.classList.add('bg-danger');
            Swal.fire('Sync Error', res.message, 'error');
        }
    },

    saveSettings: () => {
        state.config.owner = document.getElementById('conf-owner').value;
        state.config.repo = document.getElementById('conf-repo').value;
        state.config.token = document.getElementById('conf-token').value;
        state.config.gemini = document.getElementById('conf-gemini').value;
        
        localStorage.setItem('gh_owner', state.config.owner);
        localStorage.setItem('gh_repo', state.config.repo);
        localStorage.setItem('gh_token', state.config.token);
        localStorage.setItem('gemini_key', state.config.gemini);
        
        ui.closeModal('modal-settings');
        app.syncData();
    },

    // --- ASSET ACTIONS ---
    showAssetModal: () => {
        document.getElementById('assetForm').reset();
        document.getElementById('asset-id').value = '';
        
        // Populate Selects
        ui.populateLocationSelect();
        ui.populateTypeSelect();
        
        ui.toggleIssueField('Normal');
        ui.showModal('modal-asset');
    },

    editAsset: (id) => {
        const a = state.db.assets.find(x => x.id === id);
        if(!a) return;
        
        document.getElementById('asset-id').value = a.id;
        
        ui.populateLocationSelect(a.location_id);
        ui.populateTypeSelect(a.type_id);
        
        document.getElementById('asset-brand').value = a.brand || '';
        document.getElementById('asset-model').value = a.model || '';
        document.getElementById('asset-cond').value = a.cond;
        document.getElementById('asset-issue').value = a.issue || '';
        document.getElementById('asset-install').value = a.install || '';
        document.getElementById('asset-service').value = a.service || '';
        
        ui.toggleIssueField(a.cond);
        ui.showModal('modal-asset');
    },

    saveAsset: async (e) => {
        e.preventDefault();
        const id = document.getElementById('asset-id').value || ut.id();
        
        const item = {
            id,
            location_id: document.getElementById('asset-location').value, // Ambil ID Lokasi
            type_id: document.getElementById('asset-type').value,         // Ambil ID Tipe
            brand: document.getElementById('asset-brand').value,
            model: document.getElementById('asset-model').value,
            cond: document.getElementById('asset-cond').value,
            issue: document.getElementById('asset-issue').value,
            install: document.getElementById('asset-install').value,
            service: document.getElementById('asset-service').value,
            // Simpan nama lokasi/tipe untuk fallback/search mudah (denormalisasi opsional, tapi kita pakai relasi ID sekarang)
        };
        
        // Validasi dasar
        if(!item.location_id || !item.type_id) {
            return Swal.fire('Error', 'Lokasi dan Tipe Aset harus dipilih!', 'warning');
        }

        const idx = state.db.assets.findIndex(x => x.id === id);
        if(idx >= 0) state.db.assets[idx] = { ...state.db.assets[idx], ...item }; // Merge maintain fields lain
        else state.db.assets.push(item);
        
        ui.closeModal('modal-asset');
        ui.renderAssets();
        
        const locName = state.getLocationName(item.location_id);
        db.push(`Asset: ${locName}`);
    },

    toggleSelect: (id) => {
        if(state.ui.selected.has(id)) state.ui.selected.delete(id); 
        else state.ui.selected.add(id);
        ui.renderAssets(); 
        ui.updateBulkCount();
    },

    bulkDelete: async () => {
        if(!confirm(`Hapus ${state.ui.selected.size} item terpilih?`)) return;
        state.db.assets = state.db.assets.filter(a => !state.ui.selected.has(a.id));
        ui.toggleMultiSelect(); 
        ui.renderAssets(); 
        db.push('Bulk Del');
    },

    bulkUpdateStatus: async (val) => {
        state.db.assets.forEach(a => { 
            if(state.ui.selected.has(a.id)) { 
                a.cond = val; 
                if(val==='Normal') a.issue=''; 
            } 
        });
        ui.toggleMultiSelect(); 
        ui.renderAssets(); 
        db.push('Bulk Upd');
    },

    // --- ACTIVITY & FINANCE (Simpel Pass-through) ---
    saveActivity: async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]'); 
        btn.innerText="Processing..."; btn.disabled=true;
        
        const photo = await ut.compress(document.getElementById('act-photo').files[0]);
        const item = { 
            id: ut.id(), 
            title: document.getElementById('act-title').value, 
            time: document.getElementById('act-time').value, 
            tag: document.getElementById('act-tag').value, 
            desc: document.getElementById('act-desc').value, 
            img: photo, 
            date: dayjs().format('YYYY-MM-DD') 
        };
        
        state.db.activities.unshift(item); 
        ui.closeModal('modal-activity'); 
        ui.renderActivities(); 
        btn.innerText="Simpan Log"; btn.disabled=false; 
        db.push(`Log: ${item.title}`);
    },

    saveFinance: async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]'); 
        btn.innerText="Processing..."; btn.disabled=true;
        
        const photo = await ut.compress(document.getElementById('fin-photo').files[0]);
        const item = { 
            id: ut.id(), 
            item: document.getElementById('fin-item').value, 
            cost: parseInt(document.getElementById('fin-cost').value), 
            date: document.getElementById('fin-date').value, 
            img: photo 
        };
        
        state.db.finances.unshift(item); 
        ui.closeModal('modal-finance'); 
        ui.renderFinance(); 
        btn.innerText="Simpan"; btn.disabled=false; 
        db.push(`Fin: ${item.item}`);
    },

    // --- EXPORTS (Placeholder untuk Tahap 2) ---
    downloadAssetReport: (type) => alert("Fitur Export sedang diupdate ke Versi 6.0!"),
    downloadWorkReport: (type) => alert("Fitur Export sedang diupdate ke Versi 6.0!"),
    downloadFinanceReport: (type) => alert("Fitur Export sedang diupdate ke Versi 6.0!"),
};

// --- EXPOSE TO WINDOW ---
// Penting! Agar onclick="app.syncData()" di HTML bisa jalan
window.app = app;
window.ui = ui;
window.ut = ut;
window.ai = ai;

// START APP
document.addEventListener('DOMContentLoaded', app.init);

// Export untuk modul lain jika perlu (meski window global sudah cukup)
export { app };
