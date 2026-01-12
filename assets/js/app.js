import { state } from './state.js';
import { db } from './db.js';
import { ui } from './ui.js';
import { ut } from './utils.js';
import { ai } from './modules/ai.js';
import { wo } from './modules/wo.js';
import { report } from './modules/report.js';
import { qr } from './modules/qr.js';

/**
 * TechPartner 6.0 - Main Application Controller
 * Menghubungkan logika bisnis (Modules) dengan antarmuka (UI)
 */
const app = {
    // --- 1. INITIALIZATION ---
    init: async () => {
        // A. Setup filter tanggal default untuk laporan
        const s = dayjs().startOf('week').add(1,'day').format('YYYY-MM-DD');
        const e = dayjs().endOf('week').add(1,'day').format('YYYY-MM-DD');
        const startEl = document.getElementById('report-start');
        const endEl = document.getElementById('report-end');
        if(startEl) startEl.value = s;
        if(endEl) endEl.value = e;

        // B. Sinkronisasi Awal dengan Cloud
        if(state.config.token) {
            const res = await db.sync();
            if(res.status === 'success') {
                console.log("Cloud Database Terhubung.");
            }
        } else {
            // Jika token kosong, paksa buka pengaturan
            ui.showModal('modal-settings');
        }

        // C. Jalankan Migrasi Struktur Data
        state.initMigration();
        
        // D. Tampilkan Dashboard Utama (Default Tab Tahap 4)
        ui.switchTab('dashboard');
        
        // E. Inisialisasi Dropdown Master Data
        ui.populateLocationSelect();
        ui.populateTypeSelect();
        ui.populateAssetSelectForWO();
    },

    // --- 2. WORK ORDER ACTIONS ---
    showWOModal: () => {
        document.getElementById('woForm').reset();
        ui.populateAssetSelectForWO();
        ui.showModal('modal-wo');
    },

    saveWO: (e) => {
        e.preventDefault();
        const assetId = document.getElementById('wo-asset-id').value;
        const title = document.getElementById('wo-title').value;
        const priority = document.getElementById('wo-priority').value;
        const desc = document.getElementById('wo-desc').value;
        const type = document.getElementById('wo-type').value;

        if(!assetId) return Swal.fire('Error', 'Pilih aset terlebih dahulu!', 'warning');

        wo.create(assetId, title, priority, desc, type);
        
        ui.closeModal('modal-wo');
        ui.renderWO();
        ui.switchTab('wo');
        Swal.fire('Sukses', 'Tiket Work Order berhasil diterbitkan.', 'success');
    },

    updateWOStatus: (id, status) => {
        wo.updateStatus(id, status);
        ui.renderWO();
        // Update dashboard karena status WO berubah
        ui.renderDashboard();
    },
    
    showFinishWOModal: (id) => {
        state.ui.currentWOId = id;
        document.getElementById('wo-finish-notes').value = '';
        ui.showModal('modal-finish-wo');
    },
    
    finishWO: async (e) => {
        e.preventDefault();
        const id = state.ui.currentWOId;
        const notes = document.getElementById('wo-finish-notes').value;
        
        if(!notes) return Swal.fire('Info', 'Mohon isi catatan penyelesaian.', 'warning');

        // Handle foto bukti jika ada
        const fileInput = document.getElementById('wo-finish-photo');
        if(fileInput && fileInput.files.length > 0) {
            await wo.addPhoto(id, 'after', fileInput.files[0]);
        }

        wo.updateStatus(id, 'DONE', notes);
        
        ui.closeModal('modal-finish-wo');
        ui.renderWO();
        ui.renderAssets();
        ui.renderDashboard(); // Refresh statistik dashboard
        
        Swal.fire('Selesai', 'Pekerjaan ditutup. Data aset telah diperbarui.', 'success');
    },

    // --- 3. ASSET ACTIONS ---
    showAssetModal: () => { 
        document.getElementById('assetForm').reset(); 
        document.getElementById('asset-id').value = ''; 
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
            location_id: document.getElementById('asset-location').value, 
            type_id: document.getElementById('asset-type').value, 
            brand: document.getElementById('asset-brand').value, 
            model: document.getElementById('asset-model').value, 
            cond: document.getElementById('asset-cond').value, 
            issue: document.getElementById('asset-issue').value, 
            install: document.getElementById('asset-install').value, 
            service: document.getElementById('asset-service').value, 
        }; 
        
        const idx = state.db.assets.findIndex(x => x.id === id); 
        if(idx >= 0) state.db.assets[idx] = { ...state.db.assets[idx], ...item }; 
        else state.db.assets.push(item); 
        
        ui.closeModal('modal-asset'); 
        ui.renderAssets(); 
        ui.renderDashboard(); // Update chart kondisi aset
        
        const locName = state.getLocationName(item.location_id); 
        db.push(`Asset Update: ${locName}`); 
    },

    // --- 4. QR & REPORT ACTIONS ---
    showQR: (id) => qr.show(id),
    printQR: () => qr.print(),
    downloadAssetReport: () => report.assetPDF(),
    downloadWorkReport: () => report.woPDF(),
    downloadFinanceReport: () => report.financePDF(),

    // --- 5. LOG & FINANCE ---
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
        db.push(`Activity: ${item.title}`); 
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
        ui.renderDashboard(); // Update angka pengeluaran di dashboard
        btn.innerText="Simpan"; btn.disabled=false; 
        db.push(`Finance: ${item.item}`); 
    },

    // --- 6. SYSTEM & CLOUD ---
    syncData: async () => {
        const badge = document.getElementById('sync-badge');
        badge.classList.remove('bg-success', 'bg-danger');
        badge.classList.add('bg-warning', 'animate-pulse');
        
        const res = await db.sync();
        
        badge.classList.remove('bg-warning', 'animate-pulse');
        if(res.status === 'success') {
            badge.classList.add('bg-success');
            // Refresh tampilan tab yang sedang aktif
            const activeTab = document.querySelector('.tab-nav button.border-accent').id.replace('tab-', '');
            ui.switchTab(activeTab);
            
            Swal.fire({ icon: 'success', title: 'Data Cloud Sinkron', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
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

    backupData: () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.db));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", `TechPartner_Backup_${dayjs().format('YYYYMMDD')}.json`);
        dl.click();
    },

    restoreData: (input) => {
        if (!input.files[0]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if(confirm("Tindakan ini akan menghapus data lokal dan menimpanya dengan backup. Lanjutkan?")) {
                    state.db = json;
                    app.syncData();
                    location.reload();
                }
            } catch(err) {
                Swal.fire('Error', 'File backup tidak valid.', 'error');
            }
        };
        reader.readAsText(input.files[0]);
    }
};

// Expose app ke window agar event onclick di HTML bisa memanggil app.xxx
window.app = app;
window.ui = ui;
window.ut = ut;
window.ai = ai;

// Mulai inisialisasi saat DOM siap
document.addEventListener('DOMContentLoaded', app.init);

export { app };
