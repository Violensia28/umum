import { state } from './state.js';
import { db } from './db.js';
import { ui } from './ui.js';
import { ut } from './utils.js';
import { ai } from './modules/ai.js';
import { wo } from './modules/wo.js';
import { report } from './modules/report.js'; // IMPORT BARU: Module Laporan
import { qr } from './modules/qr.js';         // IMPORT BARU: Module QR Code

const app = {
    // --- 1. INITIALIZATION ---
    init: async () => {
        // Set tanggal filter laporan default (Minggu ini)
        const s = dayjs().startOf('week').add(1,'day').format('YYYY-MM-DD');
        const e = dayjs().endOf('week').add(1,'day').format('YYYY-MM-DD');
        const startEl = document.getElementById('report-start');
        const endEl = document.getElementById('report-end');
        if(startEl) startEl.value = s;
        if(endEl) endEl.value = e;

        // Cek Koneksi Cloud (GitHub)
        if(state.config.token) {
            const res = await db.sync();
            if(res.status === 'success') console.log("Cloud Sync Success");
        } else {
            ui.showModal('modal-settings'); // Minta token jika belum ada
        }

        // Jalankan Migrasi Data (jika update dari versi lama)
        state.initMigration();
        
        // Render Semua Tampilan
        ui.renderAssets();
        ui.renderWO();
        ui.renderActivities();
        ui.renderFinance();
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
        Swal.fire('Sukses', 'Tiket Work Order dibuat.', 'success');
    },

    updateWOStatus: (id, status) => {
        wo.updateStatus(id, status);
        ui.renderWO();
    },
    
    showFinishWOModal: (id) => {
        state.ui.currentWOId = id; // Simpan ID sementara
        document.getElementById('wo-finish-notes').value = '';
        document.getElementById('wo-finish-photo').value = ''; // Reset input file
        ui.showModal('modal-finish-wo');
    },
    
    finishWO: async (e) => {
        e.preventDefault();
        const id = state.ui.currentWOId;
        const notes = document.getElementById('wo-finish-notes').value;
        
        if(!notes) return Swal.fire('Info', 'Mohon isi catatan penyelesaian.', 'warning');

        // Handle Upload Bukti Foto (Before/After)
        const fileInput = document.getElementById('wo-finish-photo');
        if(fileInput && fileInput.files.length > 0) {
            // Simpan sebagai foto 'after'
            await wo.addPhoto(id, 'after', fileInput.files[0]);
        }

        // Update status DONE & Trigger Logic PM
        wo.updateStatus(id, 'DONE', notes);
        
        ui.closeModal('modal-finish-wo');
        ui.renderWO();
        ui.renderAssets(); // Update karena tanggal servis aset berubah
        Swal.fire('Selesai', 'Pekerjaan selesai & Data aset terupdate.', 'success');
    },

    // --- 3. QR CODE ACTIONS (BARU) ---
    showQR: (id) => qr.show(id),
    printQR: () => qr.print(),

    // --- 4. BACKUP & RESTORE (BARU) ---
    backupData: () => {
        // Buat file JSON dari state.db
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.db));
        const downloadAnchorNode = document.createElement('a');
        const fileName = `TechPartner_Backup_${dayjs().format('YYYY-MM-DD_HHmm')}.json`;
        
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    restoreData: (input) => {
        if (!input.files[0]) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                
                // Validasi sederhana
                if(!json.meta || !json.assets) throw new Error("Format file salah");

                Swal.fire({
                    title: 'Restore Data?',
                    text: "Data saat ini akan ditimpa dengan data backup! Pastikan Anda yakin.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Ya, Restore!'
                }).then((result) => {
                    if (result.isConfirmed) {
                        state.db = json;
                        state.initMigration(); // Pastikan struktur data sesuai versi terbaru
                        app.syncData(); // Langsung sync ke cloud agar aman
                        
                        Swal.fire('Berhasil!', 'Data telah dipulihkan.', 'success')
                        .then(() => location.reload());
                    }
                });

            } catch(err) {
                Swal.fire('Error', 'File Backup Rusak atau Tidak Valid.', 'error');
            }
        };
        reader.readAsText(input.files[0]);
    },

    // --- 5. REPORT ACTIONS (BARU) ---
    downloadAssetReport: () => report.assetPDF(),
    downloadWorkReport: () => report.woPDF(),
    downloadFinanceReport: () => report.financePDF(),

    // --- 6. STANDARD ASSET ACTIONS ---
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
        const locName = state.getLocationName(item.location_id); 
        db.push(`Asset: ${locName}`); 
    },

    // --- 7. BULK ACTIONS ---
    toggleSelect: (id) => { 
        if(state.ui.selected.has(id)) state.ui.selected.delete(id); 
        else state.ui.selected.add(id); 
        ui.renderAssets(); 
        ui.updateBulkCount(); 
    },

    bulkDelete: async () => { 
        if(!confirm(`Hapus ${state.ui.selected.size} item terpilih?`)) return; 
        state.db.assets = state.db.assets.filter(a => !state.ui.selected.has(a.id)); 
        state.ui.multiSelect = false; 
        ui.renderAssets(); 
        document.getElementById('bulk-actions').classList.add('translate-y-full'); 
        db.push('Bulk Del'); 
    },

    bulkUpdateStatus: async (val) => { 
        state.db.assets.forEach(a => { 
            if(state.ui.selected.has(a.id)) { 
                a.cond = val; 
                if(val==='Normal') a.issue=''; 
            } 
        }); 
        state.ui.multiSelect = false; 
        ui.renderAssets(); 
        document.getElementById('bulk-actions').classList.add('translate-y-full'); 
        db.push('Bulk Upd'); 
    },

    // --- 8. ACTIVITY & FINANCE ---
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

    // --- 9. SYNC & SETTINGS ---
    syncData: async () => {
        const badge = document.getElementById('sync-badge');
        badge.classList.remove('bg-success', 'bg-danger');
        badge.classList.add('bg-warning', 'animate-pulse');
        
        const res = await db.sync();
        
        badge.classList.remove('bg-warning', 'animate-pulse');
        if(res.status === 'success') {
            badge.classList.add('bg-success');
            ui.renderAssets(); 
            ui.renderWO(); 
            ui.renderActivities(); 
            ui.renderFinance();
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
    }
};

// Expose ke Window agar onclick di HTML bisa akses 'app.xxx'
window.app = app;
window.ui = ui;
window.ut = ut;
window.ai = ai;

// Mulai Aplikasi
document.addEventListener('DOMContentLoaded', app.init);

export { app };
