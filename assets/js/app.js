import { state } from './state.js';
import { db } from './db.js';
import { ui } from './ui.js';
import { ut } from './utils.js';
import { ai } from './modules/ai.js';
import { wo } from './modules/wo.js'; // PENTING: Import modul Work Order

const app = {
    // --- INITIALIZATION ---
    init: async () => {
        // 1. Setup Tanggal Laporan Default (Minggu ini)
        const s = dayjs().startOf('week').add(1,'day').format('YYYY-MM-DD');
        const e = dayjs().endOf('week').add(1,'day').format('YYYY-MM-DD');
        const startEl = document.getElementById('report-start');
        const endEl = document.getElementById('report-end');
        if(startEl) startEl.value = s;
        if(endEl) endEl.value = e;

        // 2. Cek Koneksi Cloud (GitHub)
        if(state.config.token) {
            const res = await db.sync();
            if(res.status === 'success') {
                console.log("Cloud Sync Success");
            } else {
                console.log("Sync Warning:", res.message);
            }
        } else {
            // Jika belum ada token, minta user setting
            ui.showModal('modal-settings');
        }

        // 3. Jalankan Migrasi Data (Jika ada data versi lama)
        state.initMigration();
        
        // 4. Render Semua View (Aset, WO, Activity, Finance)
        ui.renderAssets();
        ui.renderWO();       // Render Work Order (Baru)
        ui.renderActivities();
        ui.renderFinance();
    },

    // --- WORK ORDER ACTIONS (TAHAP 2) ---
    
    // Tampilkan Modal Buat WO Baru
    showWOModal: () => {
        document.getElementById('woForm').reset();
        ui.populateAssetSelectForWO(); // Isi dropdown aset
        ui.showModal('modal-wo');
    },

    // Simpan WO Baru
    saveWO: (e) => {
        e.preventDefault();
        
        // Ambil value dari form
        const assetId = document.getElementById('wo-asset-id').value;
        const title = document.getElementById('wo-title').value;
        const priority = document.getElementById('wo-priority').value;
        const desc = document.getElementById('wo-desc').value;
        const type = document.getElementById('wo-type').value;

        // Validasi
        if(!assetId) return Swal.fire('Error', 'Pilih aset terlebih dahulu!', 'warning');

        // Panggil logic pembuatan WO
        wo.create(assetId, title, priority, desc, type);
        
        // Refresh UI
        ui.closeModal('modal-wo');
        ui.renderWO();
        ui.switchTab('wo'); // Pindah otomatis ke tab WO
        
        Swal.fire({
            icon: 'success',
            title: 'Work Order Dibuat',
            text: 'Tiket berhasil dibuat dan status OPEN.',
            timer: 1500,
            showConfirmButton: false
        });
    },

    // Update Status WO (Open -> Progress)
    updateWOStatus: (id, status) => {
        wo.updateStatus(id, status);
        ui.renderWO();
    },

    // Tampilkan Modal Selesaikan WO
    showFinishWOModal: (id) => {
        // Simpan ID WO yang sedang diproses ke state sementara
        state.ui.currentWOId = id;
        // Reset form notes
        document.getElementById('wo-finish-notes').value = '';
        ui.showModal('modal-finish-wo');
    },

    // Finalisasi WO (Progress -> Done)
    finishWO: (e) => {
        e.preventDefault();
        const id = state.ui.currentWOId;
        const notes = document.getElementById('wo-finish-notes').value;
        
        if(!notes) return Swal.fire('Info', 'Mohon isi catatan penyelesaian.', 'warning');

        // Update status ke DONE & Trigger Logika PM Otomatis (di wo.js)
        wo.updateStatus(id, 'DONE', notes);
        
        ui.closeModal('modal-finish-wo');
        ui.renderWO();
        ui.renderAssets(); // Refresh aset agar tanggal servis berubah (jika ada PM update)
        
        Swal.fire('Selesai', 'Pekerjaan selesai! Data aset telah diperbarui.', 'success');
    },

    // --- ASSET ACTIONS ---

    showAssetModal: () => {
        document.getElementById('assetForm').reset();
        document.getElementById('asset-id').value = '';
        
        // Populate Dropdowns
        ui.populateLocationSelect();
        ui.populateTypeSelect();
        
        ui.toggleIssueField('Normal');
        ui.showModal('modal-asset');
    },

    editAsset: (id) => {
        const a = state.db.assets.find(x => x.id === id);
        if(!a) return;
        
        document.getElementById('asset-id').value = a.id;
        
        // Populate & Set Selected
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
            location_id: document.getElementById('asset-location').value, // Menggunakan ID Lokasi
            type_id: document.getElementById('asset-type').value,         // Menggunakan ID Tipe
            brand: document.getElementById('asset-brand').value,
            model: document.getElementById('asset-model').value,
            cond: document.getElementById('asset-cond').value,
            issue: document.getElementById('asset-issue').value,
            install: document.getElementById('asset-install').value,
            service: document.getElementById('asset-service').value,
        };
        
        if(!item.location_id || !item.type_id) {
            return Swal.fire('Error', 'Lokasi dan Tipe wajib dipilih.', 'warning');
        }

        const idx = state.db.assets.findIndex(x => x.id === id);
        if(idx >= 0) {
            // Update (Merge agar field lain seperti next_pm_date tidak hilang)
            state.db.assets[idx] = { ...state.db.assets[idx], ...item };
        } else {
            // New
            state.db.assets.push(item);
        }
        
        ui.closeModal('modal-asset');
        ui.renderAssets();
        
        const locName = state.getLocationName(item.location_id);
        db.push(`Asset Update: ${locName}`);
    },

    // --- BULK ACTIONS ---
    toggleSelect: (id) => {
        if(state.ui.selected.has(id)) state.ui.selected.delete(id); 
        else state.ui.selected.add(id);
        ui.renderAssets(); 
        ui.updateBulkCount();
    },

    bulkDelete: async () => {
        if(!confirm(`Hapus ${state.ui.selected.size} item terpilih?`)) return;
        state.db.assets = state.db.assets.filter(a => !state.ui.selected.has(a.id));
        state.ui.multiSelect = false; // Reset mode
        state.ui.selected.clear();
        ui.renderAssets(); 
        document.getElementById('bulk-actions').classList.add('translate-y-full'); // Hide toolbar
        db.push('Bulk Delete Assets');
    },

    bulkUpdateStatus: async (val) => {
        state.db.assets.forEach(a => { 
            if(state.ui.selected.has(a.id)) { 
                a.cond = val; 
                if(val==='Normal') a.issue=''; 
            } 
        });
        state.ui.multiSelect = false;
        state.ui.selected.clear();
        ui.renderAssets(); 
        document.getElementById('bulk-actions').classList.add('translate-y-full');
        db.push(`Bulk Status: ${val}`);
    },

    // --- ACTIVITY & FINANCE ---
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

    // --- SYSTEM & SETTINGS ---
    syncData: async () => {
        const badge = document.getElementById('sync-badge');
        badge.classList.remove('bg-success', 'bg-danger');
        badge.classList.add('bg-warning', 'animate-pulse');
        
        const res = await db.sync();
        
        badge.classList.remove('bg-warning', 'animate-pulse');
        if(res.status === 'success') {
            badge.classList.add('bg-success');
            // Re-render semua agar data baru muncul
            ui.renderAssets(); ui.renderWO(); ui.renderActivities(); ui.renderFinance();
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
        app.syncData(); // Coba sync langsung setelah save
    },

    // --- PLACEHOLDERS UNTUK EXPORT (TAHAP 3) ---
    downloadAssetReport: () => alert("Fitur Export V6 sedang disiapkan untuk Tahap 3!"),
    downloadWorkReport: () => alert("Fitur Export V6 sedang disiapkan untuk Tahap 3!"),
    downloadFinanceReport: () => alert("Fitur Export V6 sedang disiapkan untuk Tahap 3!")
};

// --- EXPOSE GLOBAL (Agar onclick HTML berfungsi) ---
window.app = app;
window.ui = ui;
window.ut = ut;
window.ai = ai;

// Start App saat DOM Ready
document.addEventListener('DOMContentLoaded', app.init);

export { app };
