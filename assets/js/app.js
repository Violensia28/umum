import { state } from './state.js';
import { db } from './db.js';
import { ui } from './ui.js';
import { ut } from './utils.js';
import { ai } from './modules/ai.js';
import { wo } from './modules/wo.js';
import { report } from './modules/report.js';
import { qr } from './modules/qr.js';

const app = {
    init: async () => {
        try {
            // Setup default tanggal laporan
            const startEl = document.getElementById('report-start');
            const endEl = document.getElementById('report-end');
            if(startEl && endEl && typeof dayjs !== 'undefined') {
                startEl.value = dayjs().startOf('month').format('YYYY-MM-DD');
                endEl.value = dayjs().endOf('month').format('YYYY-MM-DD');
            }

            // Cek Login & Sync
            if(state.config.token) {
                const res = await db.sync();
                if(res.status === 'success') console.log("Cloud Connected");
            } else {
                ui.showModal('modal-settings');
            }

            // Load UI Awal
            ui.populateDropdowns();
            ui.switchTab('dashboard');

        } catch (err) {
            console.error("Startup Error:", err);
        }
    },

    // --- SETTINGS & SYNC ---
    saveSettings: () => {
        ['owner', 'repo', 'token', 'gemini'].forEach(key => {
            const val = document.getElementById(`conf-${key}`).value;
            state.config[key] = val;
            localStorage.setItem(`gh_${key === 'gemini' ? 'gemini_key' : key}`, val);
        });
        ui.closeModal('modal-settings');
        app.syncData();
    },

    syncData: async () => {
        const btn = document.querySelector('button[onclick="app.syncData()"] i');
        if(btn) btn.classList.add('fa-spin');
        
        const res = await db.sync();
        
        if(btn) btn.classList.remove('fa-spin');
        
        if(res.status === 'success') {
            ui.switchTab('dashboard'); // Refresh tampilan
            Swal.fire({ icon: 'success', title: 'Data Sinkron', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        } else {
            Swal.fire('Gagal Sync', res.message, 'error');
        }
    },

    backupData: () => {
        const str = JSON.stringify(state.db, null, 2);
        const blob = new Blob([str], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TechPartner_Backup_${dayjs().format('YYYYMMDD')}.json`;
        a.click();
    },

    restoreData: (input) => {
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if(confirm("Timpa data saat ini dengan backup?")) {
                    state.db = json;
                    app.syncData(); // Push ke cloud
                    location.reload();
                }
            } catch (err) { alert("File rusak!"); }
        };
        reader.readAsText(file);
    },

    // --- ASSET ACTIONS ---
    showAssetModal: () => {
        document.getElementById('assetForm').reset();
        document.getElementById('asset-id').value = '';
        ui.populateDropdowns();
        ui.toggleIssueField('Normal');
        ui.showModal('modal-asset');
    },

    editAsset: (id) => {
        const a = state.db.assets.find(x => x.id === id);
        if(!a) return;
        document.getElementById('asset-id').value = a.id;
        document.getElementById('asset-location').value = a.location_id;
        document.getElementById('asset-type').value = a.type_id;
        document.getElementById('asset-brand').value = a.brand;
        document.getElementById('asset-model').value = a.model;
        document.getElementById('asset-cond').value = a.cond;
        document.getElementById('asset-issue').value = a.issue;
        document.getElementById('asset-install').value = a.install;
        document.getElementById('asset-service').value = a.service;
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
        if(idx >= 0) state.db.assets[idx] = item;
        else state.db.assets.push(item);

        ui.closeModal('modal-asset');
        ui.renderAssets();
        ui.renderDashboard();
        await db.push(`Update Asset: ${item.brand}`);
    },

    // --- WO ACTIONS ---
    showWOModal: () => {
        document.getElementById('woForm').reset();
        ui.populateDropdowns();
        ui.showModal('modal-wo');
    },

    saveWO: async (e) => {
        e.preventDefault();
        const assetId = document.getElementById('wo-asset-id').value;
        const title = document.getElementById('wo-title').value;
        const prio = document.getElementById('wo-priority').value;
        const type = document.getElementById('wo-type').value;
        const desc = document.getElementById('wo-desc').value;

        wo.create(assetId, title, prio, desc, type);
        ui.closeModal('modal-wo');
        ui.renderWO();
        ui.switchTab('wo');
    },

    finishWO: (id) => {
        state.ui.currentWOId = id;
        ui.showModal('modal-finish-wo');
    },

    // --- OTHER ACTIONS ---
    saveActivity: async (e) => {
        e.preventDefault();
        const file = document.getElementById('act-photo').files[0];
        const img = file ? await ut.compress(file) : null;
        const item = {
            id: ut.id(),
            title: document.getElementById('act-title').value,
            time: document.getElementById('act-time').value,
            tag: document.getElementById('act-tag').value,
            desc: document.getElementById('act-desc').value,
            img: img,
            date: new Date().toISOString()
        };
        state.db.activities.unshift(item);
        ui.closeModal('modal-activity');
        ui.renderActivities();
        await db.push(`Log: ${item.title}`);
    },

    saveFinance: async (e) => {
        e.preventDefault();
        const file = document.getElementById('fin-photo').files[0];
        const img = file ? await ut.compress(file) : null;
        const item = {
            id: ut.id(),
            item: document.getElementById('fin-item').value,
            cost: parseInt(document.getElementById('fin-cost').value),
            date: document.getElementById('fin-date').value,
            img: img
        };
        state.db.finances.unshift(item);
        ui.closeModal('modal-finance');
        ui.renderFinance();
        ui.renderDashboard();
        await db.push(`Finance: ${item.item}`);
    },

    // Expose Module Functions to HTML
    printQR: () => qr.print(),
    downloadAssetReport: () => report.assetPDF(),
    downloadWorkReport: () => report.woPDF(),
    
    // Bulk Placeholder
    bulkDelete: () => Swal.fire('Info', 'Fitur bulk delete akan hadir di update berikutnya.', 'info'),
    bulkUpdateStatus: () => Swal.fire('Info', 'Fitur bulk update akan hadir di update berikutnya.', 'info')
};

// EXPOSE APP TO WINDOW (WAJIB UNTUK HTML ONCLICK)
window.app = app;
document.addEventListener('DOMContentLoaded', app.init);
