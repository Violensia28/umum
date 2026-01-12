import { state } from './state.js';
import { ut } from './utils.js';
import { app } from './app.js';

export const ui = {
    // --- TABS & MODALS ---
    switchTab: (t) => {
        ['dashboard', 'assets', 'wo', 'activity', 'finance'].forEach(x => { 
            const view = document.getElementById(`view-${x}`);
            if(view) view.classList.add('hidden'); 
            
            const tabBtn = document.getElementById(`tab-${x}`);
            if(tabBtn) {
                tabBtn.classList.remove('border-accent', 'text-primary'); 
                tabBtn.classList.add('border-transparent', 'text-slate-500');
            }
        });
        
        const activeView = document.getElementById(`view-${t}`);
        if(activeView) activeView.classList.remove('hidden'); 
        
        const activeBtn = document.getElementById(`tab-${t}`);
        if(activeBtn) {
            activeBtn.classList.add('border-accent', 'text-primary'); 
            activeBtn.classList.remove('border-transparent', 'text-slate-500');
        }

        // Trigger render sesuai tab
        if(t === 'dashboard') ui.renderDashboard();
        if(t === 'assets') ui.renderAssets();
        if(t === 'wo') ui.renderWO();
        if(t === 'activity') ui.renderActivities();
        if(t === 'finance') ui.renderFinance();
    },

    showModal: (id) => { 
        const el = document.getElementById(id);
        if(el) { el.classList.remove('hidden'); el.classList.add('flex'); }
    },
    
    closeModal: (id) => { 
        const el = document.getElementById(id);
        if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    },

    // --- RENDER DASHBOARD (BARU TAHAP 4) ---
    renderDashboard: () => {
        // Update Angka Statistik Dashboard
        const totalAssets = state.db.assets.length;
        const maintDue = state.db.assets.filter(a => a.cond === 'Perlu Servis' || ut.isOverdue(a.service)).length;
        const activeWO = (state.db.work_orders || []).filter(w => w.status === 'OPEN' || w.status === 'PROGRESS').length;
        const totalBudget = (state.db.finances || []).reduce((acc, c) => acc + (c.cost || 0), 0);

        // Guard clause: pastikan elemen ada sebelum diisi
        const elTotal = document.getElementById('dash-total-assets');
        const elMaint = document.getElementById('dash-maintenance');
        const elWO = document.getElementById('dash-wo-active');
        const elBudget = document.getElementById('dash-budget');

        if(elTotal) elTotal.innerText = totalAssets;
        if(elMaint) elMaint.innerText = maintDue;
        if(elWO) elWO.innerText = activeWO;
        if(elBudget) elBudget.innerText = ut.fmtRp(totalBudget);

        // Inisialisasi Grafik (Jika library Chart.js sudah siap)
        ui.initCharts();
    },

    initCharts: () => {
        const ctxHealth = document.getElementById('chart-asset-health');
        if(!ctxHealth || typeof Chart === 'undefined') return;

        // Cek jika chart sudah ada, hancurkan dulu agar tidak tumpang tindih
        if (window.myChartHealth) window.myChartHealth.destroy();

        const normal = state.db.assets.filter(a => a.cond === 'Normal').length;
        const rusak = state.db.assets.filter(a => a.cond === 'Rusak').length;
        const servis = state.db.assets.filter(a => a.cond === 'Perlu Servis').length;

        window.myChartHealth = new Chart(ctxHealth, {
            type: 'doughnut',
            data: {
                labels: ['Normal', 'Rusak', 'Servis'],
                datasets: [{
                    data: [normal, rusak, servis],
                    backgroundColor: ['#059669', '#dc2626', '#d97706'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
        });
    },

    // --- RENDER ASSETS (DIPERBAIKI) ---
    renderAssets: () => {
        const term = document.getElementById('searchAsset')?.value.toLowerCase() || "";
        const list = document.getElementById('asset-list');
        if(!list) return;

        const filtered = state.db.assets.filter(a => {
            const locName = state.getLocationName(a.location_id).toLowerCase();
            return locName.includes(term) || (a.brand && a.brand.toLowerCase().includes(term));
        });

        // HAPUS BAGIAN UPDATE STAT-TOTAL DI SINI (Karena sudah pindah ke Dashboard)
        // Jika tetap ingin ada statistik kecil di tab aset, tambahkan null-check
        const statTotal = document.getElementById('stat-total');
        if(statTotal) statTotal.innerText = state.db.assets.length;

        list.innerHTML = filtered.map(a => {
            const isOverdue = ut.isOverdue(a.service);
            const locName = state.getLocationName(a.location_id);
            const typeName = state.getTypeName(a.type_id);

            return `
            <div class="asset-card bg-white p-5 rounded-xl shadow-sm border border-slate-100 relative ${a.cond==='Rusak'?'status-rusak':a.cond==='Perlu Servis'?'status-servis':isOverdue?'status-overdue':'status-normal'}">
                <div class="flex justify-between mb-3">
                    <span class="px-2 py-1 bg-slate-100 text-[10px] font-bold rounded">${typeName}</span>
                    <span class="text-[10px] font-bold uppercase ${a.cond==='Rusak'?'text-danger':a.cond==='Perlu Servis'?'text-warning':'text-success'}">${a.cond}</span>
                </div>
                <h4 class="font-bold text-slate-800 text-lg leading-tight mb-1">${locName}</h4>
                <p class="text-sm text-slate-500 mb-4">${a.brand||'-'} ${a.model||''}</p>
                <div class="flex justify-between items-center border-t pt-3">
                    <div class="text-[10px] text-slate-400"><i class="fa-regular fa-calendar mr-1"></i> ${a.service || 'No Date'}</div>
                    <div class="flex gap-2">
                         <button onclick="app.showQR('${a.id}')" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-qrcode"></i></button>
                         <button onclick="app.editAsset('${a.id}')" class="text-accent hover:text-blue-700"><i class="fa-solid fa-pen-to-square"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // --- LAINNYA ---
    renderWO: () => {
        const list = document.getElementById('wo-list');
        if(!list) return;
        const data = state.db.work_orders || [];
        if(data.length === 0) { list.innerHTML = '<div class="text-center py-10 text-slate-400">Tidak ada WO aktif.</div>'; return; }
        list.innerHTML = data.map(w => `<div class="bg-white p-4 rounded-xl border border-slate-100 border-l-4 ${w.priority==='Critical'?'border-l-purple-600':w.priority==='High'?'border-l-red-500':'border-l-blue-500'}">
            <div class="flex justify-between text-[10px] font-bold mb-1"><span class="text-slate-400">${w.no}</span><span class="px-2 py-0.5 bg-slate-100 rounded">${w.status}</span></div>
            <div class="font-bold text-slate-800">${w.title}</div>
            <div class="text-xs text-slate-500 mt-1">${w.desc}</div>
            ${w.status !== 'DONE' ? `<button onclick="app.showFinishWOModal('${w.id}')" class="mt-3 w-full py-2 bg-slate-800 text-white rounded-lg text-[10px] font-bold">Update Status</button>` : ''}
        </div>`).join('');
    },

    renderActivities: () => {
        const list = document.getElementById('activity-list');
        if(!list) return;
        list.innerHTML = (state.db.activities || []).map(a => `<div class="relative pl-6 pb-6 border-l border-slate-200"><div class="absolute -left-1 top-0 w-2 h-2 rounded-full bg-accent"></div><div class="text-[10px] font-bold text-slate-400">${a.date}</div><div class="font-bold text-slate-800">${a.title}</div><div class="text-xs text-slate-500">${a.desc}</div></div>`).join('');
    },

    renderFinance: () => {
        const list = document.getElementById('finance-list');
        if(!list) return;
        const total = (state.db.finances || []).reduce((acc, c) => acc + (c.cost || 0), 0);
        document.getElementById('finance-total').innerText = ut.fmtRp(total);
        list.innerHTML = (state.db.finances || []).map(f => `<div class="bg-white p-3 rounded-xl border flex justify-between items-center"><div class="text-sm font-bold text-slate-700">${f.item}</div><div class="text-sm font-mono font-bold text-emerald-600">${ut.fmtRp(f.cost)}</div></div>`).join('');
    },

    populateLocationSelect: () => {
        const el = document.getElementById('asset-location');
        if(!el) return;
        el.innerHTML = state.db.master.locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
    },

    populateTypeSelect: () => {
        const el = document.getElementById('asset-type');
        if(!el) return;
        el.innerHTML = state.db.master.asset_types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    },

    populateAssetSelectForWO: () => {
        const el = document.getElementById('wo-asset-id');
        if(!el) return;
        el.innerHTML = state.db.assets.map(a => `<option value="${a.id}">${state.getLocationName(a.location_id)} - ${a.brand}</option>`).join('');
    }
};
