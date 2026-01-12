import { state } from './state.js';
import { ut } from './utils.js';
import { app } from './app.js';

/**
 * ui.js - Modul Antarmuka TechPartner 6.0
 * Mengelola semua proses rendering data ke dalam DOM (HTML).
 */
export const ui = {
    // --- 1. NAVIGASI & MANAJEMEN TAB ---
    switchTab: (t) => {
        const tabs = ['dashboard', 'assets', 'wo', 'activity', 'finance'];
        
        // Sembunyikan semua view dan reset gaya tombol tab
        tabs.forEach(x => { 
            const view = document.getElementById(`view-${x}`);
            const btn = document.getElementById(`tab-${x}`);
            
            if (view) view.classList.add('hidden'); 
            if (btn) {
                btn.classList.remove('border-accent', 'text-primary', 'font-bold'); 
                btn.classList.add('border-transparent', 'text-slate-500');
            }
        });
        
        // Aktifkan view dan tombol tab yang dipilih
        const activeView = document.getElementById(`view-${t}`);
        const activeBtn = document.getElementById(`tab-${t}`);
        
        if (activeView) activeView.classList.remove('hidden'); 
        if (activeBtn) {
            activeBtn.classList.add('border-accent', 'text-primary', 'font-bold'); 
            activeBtn.classList.remove('border-transparent', 'text-slate-500');
        }

        // Trigger render data spesifik untuk tab tersebut
        switch(t) {
            case 'dashboard': ui.renderDashboard(); break;
            case 'assets': ui.renderAssets(); break;
            case 'wo': ui.renderWO(); break;
            case 'activity': ui.renderActivities(); break;
            case 'finance': ui.renderFinance(); break;
        }
    },

    showModal: (id) => { 
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
    },
    
    closeModal: (id) => { 
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    },

    // --- 2. DASHBOARD ANALYTICS (TAHAP 4) ---
    renderDashboard: () => {
        // Kalkulasi Statistik
        const stats = {
            total: state.db.assets.length,
            maint: state.db.assets.filter(a => a.cond === 'Perlu Servis' || ut.isOverdue(a.service)).length,
            wo: (state.db.work_orders || []).filter(w => w.status === 'OPEN' || w.status === 'PROGRESS').length,
            budget: (state.db.finances || []).reduce((acc, c) => acc + (c.cost || 0), 0)
        };

        // Update Elemen Teks dengan pemeriksaan keamanan (Guard Clauses)
        const uiMap = {
            'dash-total-assets': stats.total,
            'dash-maintenance': stats.maint,
            'dash-wo-active': stats.wo,
            'dash-budget': ut.fmtRp(stats.budget)
        };

        Object.keys(uiMap).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = uiMap[id];
        });

        // Inisialisasi Grafik
        ui.initDashboardCharts();
    },

    initDashboardCharts: () => {
        const canvas = document.getElementById('chart-asset-health');
        // Jika elemen canvas tidak ada atau library Chart.js tidak ter-load, hentikan.
        if (!canvas || typeof Chart === 'undefined') return;

        // Bersihkan instance chart lama agar tidak terjadi memory leak atau error tumpang tindih
        if (window.tpChartHealth) window.tpChartHealth.destroy();

        const normal = state.db.assets.filter(a => a.cond === 'Normal').length;
        const rusak = state.db.assets.filter(a => a.cond === 'Rusak').length;
        const servis = state.db.assets.filter(a => a.cond === 'Perlu Servis').length;

        // Jika tidak ada data, jangan gambar apapun
        if (normal === 0 && rusak === 0 && servis === 0) return;

        window.tpChartHealth = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'Rusak', 'Servis'],
                datasets: [{
                    data: [normal, rusak, servis],
                    backgroundColor: ['#059669', '#dc2626', '#d97706'],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                cutout: '78%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: true, 
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } }
                    } 
                }
            }
        });
    },

    // --- 3. INVENTARIS ASET RENDERER ---
    renderAssets: () => {
        const list = document.getElementById('asset-list');
        if (!list) return;

        const term = document.getElementById('searchAsset')?.value.toLowerCase() || "";
        const filtered = state.db.assets.filter(a => {
            const locName = state.getLocationName(a.location_id).toLowerCase();
            const brandName = (a.brand || "").toLowerCase();
            return locName.includes(term) || brandName.includes(term);
        });

        if (filtered.length === 0) {
            list.innerHTML = '<div class="col-span-full text-center py-20 text-slate-300">Aset tidak ditemukan.</div>';
            return;
        }

        list.innerHTML = filtered.map(a => {
            const isOverdue = ut.isOverdue(a.service);
            const statusClass = a.cond === 'Rusak' ? 'status-rusak' : (a.cond === 'Perlu Servis' || isOverdue ? 'status-servis' : 'status-normal');
            
            return `
            <div class="asset-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative ${statusClass}">
                <div class="flex justify-between items-start mb-3">
                    <span class="px-2 py-1 bg-slate-100 text-[10px] font-bold rounded uppercase text-slate-500">${state.getTypeName(a.type_id)}</span>
                    <div class="flex items-center gap-1">
                        ${isOverdue && a.cond === 'Normal' ? '<span class="w-2 h-2 rounded-full bg-ai animate-pulse" title="Jadwal Servis Terlewati"></span>' : ''}
                        <span class="text-[10px] font-black uppercase ${a.cond==='Normal'?'text-success':'text-danger'}">${a.cond}</span>
                    </div>
                </div>
                
                <h4 class="font-bold text-slate-800 text-lg leading-tight mb-1">${state.getLocationName(a.location_id)}</h4>
                <p class="text-xs text-slate-400 mb-4 font-medium">${a.brand || '-'} ${a.model || ''}</p>
                
                <div class="flex justify-between items-center border-t border-slate-50 pt-4 mt-2">
                    <div class="text-[10px] font-bold text-slate-400">
                        <i class="fa-regular fa-calendar-check mr-1"></i> ${a.service ? dayjs(a.service).format('DD MMM YYYY') : 'N/A'}
                    </div>
                    <div class="flex gap-4">
                        <button onclick="app.showQR('${a.id}')" class="text-slate-300 hover:text-primary transition" title="Generate QR"><i class="fa-solid fa-qrcode"></i></button>
                        <button onclick="app.editAsset('${a.id}')" class="text-slate-300 hover:text-accent transition" title="Edit Data"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // --- 4. WORK ORDER RENDERER ---
    renderWO: () => {
        const list = document.getElementById('wo-list');
        if (!list) return;

        const wos = state.db.work_orders || [];
        if (wos.length === 0) {
            list.innerHTML = '<div class="text-center py-20 text-slate-300 border-2 border-dashed border-slate-100 rounded-3xl">Tidak ada antrean pekerjaan aktif.</div>';
            return;
        }

        list.innerHTML = wos.map(w => {
            const asset = state.db.assets.find(a => a.id === w.asset_id);
            const priorityColors = {
                'Critical': 'border-l-purple-600 bg-purple-50/30',
                'High': 'border-l-red-500',
                'Med': 'border-l-warning',
                'Low': 'border-l-accent'
            };

            return `
            <div class="bg-white p-5 rounded-2xl border border-slate-100 border-l-4 ${priorityColors[w.priority] || 'border-l-slate-300'} shadow-sm transition hover:shadow-md">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-[10px] font-bold text-slate-400 font-mono tracking-tighter">${w.no} • ${dayjs(w.created_at).format('DD/MM')}</span>
                    <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${w.status==='DONE'?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}">${w.status}</span>
                </div>
                <div class="font-bold text-slate-800 text-base leading-tight">${w.title}</div>
                <div class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-location-dot mr-1"></i> ${state.getLocationName(asset?.location_id)}</div>
                
                <div class="mt-4 flex gap-2">
                    ${w.status !== 'DONE' ? `
                        <button onclick="app.showFinishWOModal('${w.id}')" class="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-slate-800 transition">Selesaikan Tugas</button>
                    ` : `
                        <div class="text-[10px] text-emerald-600 font-bold italic py-2">
                            <i class="fa-solid fa-check-double mr-1"></i> Pekerjaan diselesaikan pada ${dayjs(w.completed_at).format('DD MMM YYYY')}
                        </div>
                    `}
                </div>
            </div>`;
        }).join('');
    },

    // --- 5. LOG & FINANCE RENDERER ---
    renderActivities: () => {
        const list = document.getElementById('activity-list');
        if (!list) return;

        const activities = state.db.activities || [];
        if (activities.length === 0) {
            list.innerHTML = '<p class="text-center py-10 text-slate-300">Belum ada aktivitas tercatat.</p>';
            return;
        }

        list.innerHTML = activities.map(a => `
            <div class="relative pl-8 pb-8 border-l-2 border-slate-100 last:border-0 last:pb-0">
                <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-accent shadow-sm"></div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${dayjs(a.date).format('DD MMMM YYYY')}</div>
                <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div class="font-bold text-slate-800 text-sm mb-1">${a.title}</div>
                    <p class="text-xs text-slate-500 leading-relaxed">${a.desc}</p>
                </div>
            </div>`).join('');
    },

    renderFinance: () => {
        const list = document.getElementById('finance-list');
        if (!list) return;

        const finances = state.db.finances || [];
        const total = finances.reduce((acc, c) => acc + (c.cost || 0), 0);
        
        const totalEl = document.getElementById('finance-total');
        if (totalEl) totalEl.innerText = ut.fmtRp(total);

        if (finances.length === 0) {
            list.innerHTML = '<div class="text-center py-20 text-slate-300">Belum ada catatan pengeluaran.</div>';
            return;
        }

        list.innerHTML = finances.map(f => `
            <div class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm hover:border-emerald-200 transition">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${dayjs(f.date).format('DD MMM YYYY')}</span>
                    <span class="text-sm font-bold text-slate-700">${f.item}</span>
                </div>
                <div class="text-sm font-mono font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">${ut.fmtRp(f.cost)}</div>
            </div>`).join('');
    },

    // --- 6. MASTER DATA POPULATORS ---
    populateLocationSelect: (selectedId = null) => {
        const el = document.getElementById('asset-location');
        if (!el) return;
        el.innerHTML = '<option value="" disabled selected>Pilih Lokasi...</option>' + 
            state.db.master.locations.map(l => `<option value="${l.id}" ${l.id===selectedId?'selected':''}>${l.name}</option>`).join('');
    },

    populateTypeSelect: (selectedId = null) => {
        const el = document.getElementById('asset-type');
        if (!el) return;
        el.innerHTML = '<option value="" disabled selected>Pilih Tipe Aset...</option>' + 
            state.db.master.asset_types.map(t => `<option value="${t.id}" ${t.id===selectedId?'selected':''}>${t.name}</option>`).join('');
    },

    populateAssetSelectForWO: () => {
        const el = document.getElementById('wo-asset-id');
        if (!el) return;
        el.innerHTML = '<option value="" disabled selected>Pilih Aset...</option>' + 
            state.db.assets.map(a => `<option value="${a.id}">${state.getLocationName(a.location_id)} - ${a.brand || 'N/A'}</option>`).join('');
    },

    // --- 7. UTILITY RENDERERS ---
    toggleIssueField: (val) => {
        const el = document.getElementById('issue-container');
        if (el) el.classList.toggle('hidden', val === 'Normal');
    },

    updateBulkCount: () => {
        const el = document.getElementById('selected-count');
        if (el) el.innerText = state.ui.selected.size;
    }
};
