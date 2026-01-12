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
 * Dilengkapi dengan pengamanan terhadap error elemen null dan kendala jaringan.
 */
const app = {
    // --- 1. INITIALIZATION ---
    init: async () => {
        try {
            // A. Setup filter tanggal default untuk laporan (Minggu berjalan)
            const s = dayjs().startOf('week').add(1,'day').format('YYYY-MM-DD');
            const e = dayjs().endOf('week').add(1,'day').format('YYYY-MM-DD');
            
            const startEl = document.getElementById('report-start');
            const endEl = document.getElementById('report-end');
            if(startEl) startEl.value = s;
            if(endEl) endEl.value = e;

            // B. Sinkronisasi Cloud dengan Mekanisme Timeout
            if(state.config.token) {
                // Mencegah aplikasi "hang" jika GitHub API atau CORS bermasalah
                const syncPromise = db.sync();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Koneksi Cloud lambat.")), 8000)
                );

                await Promise.race([syncPromise, timeoutPromise])
                    .then(res => {
                        if(res && res.status === 'success') console.log("Cloud Database Terhubung.");
                    })
                    .catch(err => {
                        console.warn("Mode Offline Aktif:", err.message);
                    });
            } else {
                // Tampilkan pengaturan jika konfigurasi belum lengkap
                ui.showModal('modal-settings');
            }

            // C. Jalankan Migrasi Struktur Data (V1 ke V2)
            state.initMigration();
            
            // D. Aktifkan Tampilan Dashboard secara Aman
            // switchTab akan memicu renderDashboard yang sudah memiliki guard-clauses
            ui.switchTab('dashboard');
            
            // E. Inisialisasi Data Dropdown untuk Form
            ui.populateLocationSelect();
            ui.populateTypeSelect();
            ui.populateAssetSelectForWO();

        } catch (fatalError) {
            console.error("Critical Startup Error:", fatalError);
            // Memberikan feedback visual jika terjadi error fatal saat startup
            Swal.fire({
                title: 'Sistem Bermasalah',
                text: 'Beberapa komponen gagal dimuat. Pastikan koneksi stabil.',
                icon: 'error',
                confirmButtonText: 'Refresh Halaman'
            }).then(() => {
                // Seringkali refresh membantu membersihkan cache module yang korup
                if (fatalError.message.includes('null')) location.reload();
            });
        }
    },

    // --- 2. WORK ORDER ACTIONS ---
    showWOModal: () => {
        const form = document.getElementById('woForm');
        if(form) form.reset();
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

        if(!assetId) return Swal.fire('Peringatan', 'Pilih aset yang bermasalah terlebih dahulu!', 'warning');

        wo.create(assetId, title, priority, desc, type);
        
        ui.closeModal('modal-wo');
        ui.renderWO();
        ui.switchTab('wo');
        Swal.fire('Sukses', 'Tiket Work Order berhasil diterbitkan.', 'success');
    },

    updateWOStatus: (id, status) => {
        wo.updateStatus(id, status);
        ui.renderWO();
        ui.renderDashboard(); // Refresh angka WO Aktif di dashboard
    },
    
    showFinishWOModal: (id) => {
        state.ui.currentWOId = id;
        const noteEl = document.getElementById('wo-finish-notes');
        if(noteEl) noteEl.value = '';
        ui.showModal('modal-finish-wo');
    },
    
    finishWO: async (e) => {
        e.preventDefault();
        const id = state.ui.currentWOId;
        const notes = document.getElementById('wo-finish-notes').value;
        
        if(!notes) return Swal.fire('Info', 'Mohon isi catatan penyelesaian.', 'warning');

        // Lampirkan bukti foto jika tersedia
        const fileInput = document.getElementById('wo-finish-photo');
        if(fileInput && fileInput.files.length > 0) {
            await wo.addPhoto(id, 'after', fileInput.files[0]);
        }

        wo.updateStatus(id, 'DONE', notes);
        
        ui.closeModal('modal-finish-wo');
        ui.renderWO();
        ui.renderAssets();
        ui.renderDashboard(); // Refresh statistik kesehatan aset
        
        Swal.fire('Tuntas', 'Pekerjaan ditutup. Data aset telah diperbarui.', 'success');
    },

    // --- 3. ASSET ACTIONS ---
    showAssetModal: () => { 
        const form = document.getElementById('assetForm');
        if(form) form.reset();
        const idInput = document.getElementById('asset-id');
        if(idInput) idInput.value = ''; 
        ui.populateLocationSelect(); 
        ui.populateTypeSelect(); 
        ui.toggleIssueField('Normal'); 
        ui.showModal('modal-asset'); 
    },

    editAsset: (id) => { 
        const a = state.db.assets.find(x => x.id === id); 
        if(!a) return; 
        
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
        
        setVal('asset-id', a.id);
        ui.populateLocationSelect(a.location_id); 
        ui.populateTypeSelect(a.type_id); 
        setVal('asset-brand', a.brand); 
        setVal('asset-model', a.model); 
        setVal('asset-cond', a.cond); 
        setVal('asset-issue', a.issue); 
        setVal('asset-install', a.install); 
        setVal('asset-service', a.service); 
        
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
        ui.renderDashboard(); 
        
        const locName = state.getLocationName(item.location_id); 
        db.push(`Update Aset: ${locName}`); 
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
        const originalText = btn.innerText;
        btn.innerText = "Mengompres..."; btn.disabled = true; 
        
        try {
            const file = document.getElementById('act-photo').files[0];
            const photo = file ? await ut.compress(file) : null; 
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
            db.push(`Kegiatan: ${item.title}`); 
        } catch (err) {
            Swal.fire('Error', 'Gagal memproses gambar.', 'error');
        } finally {
            btn.innerText = originalText; btn.disabled = false; 
        }
    },

    saveFinance: async (e) => { 
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]'); 
        const originalText = btn.innerText;
        btn.innerText = "Menyimpan..."; btn.disabled = true; 
        
        try {
            const file = document.getElementById('fin-photo').files[0];
            const photo = file ? await ut.compress(file) : null; 
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
            ui.renderDashboard(); 
            db.push(`Belanja: ${item.item}`); 
        } catch (err) {
            Swal.fire('Error', 'Gagal menyimpan data keuangan.', 'error');
        } finally {
            btn.innerText = originalText; btn.disabled = false; 
        }
    },

    // --- 6. SYSTEM & CLOUD ---
    syncData: async () => {
        const badge = document.getElementById('sync-badge');
        if(!badge) return;

        badge.classList.remove('bg-success', 'bg-danger');
        badge.classList.add('bg-warning', 'animate-pulse');
        
        try {
            const res = await db.sync();
            badge.classList.remove('bg-warning', 'animate-pulse');
            
            if(res && res.status === 'success') {
                badge.classList.add('bg-success');
                // Segarkan tab yang aktif agar data terbaru muncul
                const activeTabEl = document.querySelector('.tab-nav button.border-accent');
                if(activeTabEl) {
                    const activeTab = activeTabEl.id.replace('tab-', '');
                    ui.switchTab(activeTab);
                }
                Swal.fire({ icon: 'success', title: 'Data Sinkron', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
            } else {
                throw new Error(res ? res.message : "Response kosong");
            }
        } catch (error) {
            badge.classList.remove('bg-warning', 'animate-pulse');
            badge.classList.add('bg-danger');
            Swal.fire('Sync Error', 'Gagal sinkronisasi ke GitHub. Cek Token atau Koneksi.', 'error');
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
        dl.setAttribute("download", `TechPartner_Backup_${dayjs().format('YYYYMMDD_HHmm')}.json`);
        dl.click();
    },

    restoreData: (input) => {
        if (!input.files[0]) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if(confirm("Tindakan ini akan menghapus data saat ini dan menggantinya dengan backup. Lanjutkan?")) {
                    state.db = json;
                    app.syncData();
                    location.reload();
                }
            } catch(err) {
                Swal.fire('Format Salah', 'File backup tidak valid.', 'error');
            }
        };
        reader.readAsText(input.files[0]);
    }
};

// Expose ke window agar elemen HTML (onclick) bisa mengenali fungsi app.xxx
window.app = app;
window.ui = ui;
window.ut = ut;
window.ai = ai;

// Mulai aplikasi saat struktur DOM selesai dimuat
document.addEventListener('DOMContentLoaded', app.init);

export { app };
