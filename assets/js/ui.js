import { state } from './state.js';
import { ut } from './utils.js';
import { app } from './app.js'; // Import app agar bisa dipanggil di onclick string

export const ui = {
    // --- TABS & MODALS NAVIGATION ---
    switchTab: (t) => {
        // Sembunyikan semua view
        ['assets','wo','activity','finance'].forEach(x => { 
            const view = document.getElementById(`view-${x}`);
            if(view) view.classList.add('hidden'); 
            
            const tabBtn = document.getElementById(`tab-${x}`);
            if(tabBtn) {
                tabBtn.classList.remove('border-accent', 'text-primary'); 
                tabBtn.classList.add('border-transparent', 'text-slate-500');
            }
        });
        
        // Tampilkan view yang dipilih
        const activeView = document.getElementById(`view-${t}`);
        if(activeView) activeView.classList.remove('hidden'); 
        
        const activeBtn = document.getElementById(`tab-${t}`);
        if(activeBtn) {
            activeBtn.classList.add('border-accent', 'text-primary'); 
            activeBtn.classList.remove('border-transparent', 'text-slate-500');
        }

        // Render ulang data saat tab dibuka agar fresh
        if(t === 'assets') ui.renderAssets();
        if(t === 'wo') ui.renderWO();
        if(t === 'activity') ui.renderActivities();
        if(t === 'finance') ui.renderFinance();
    },

    showModal: (id) => { 
        const el = document.getElementById(id);
        if(el) {
            el.classList.remove('hidden'); 
            el.classList.add('flex');
        }
    },
    
    closeModal: (id) => { 
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('hidden'); 
            el.classList.remove('flex');
        }
    },

    // --- RENDER ASSETS (TAMPILAN ASET) ---
    renderAssets: () => {
        const term = document.getElementById('searchAsset').value.toLowerCase();
        const list = document.getElementById('asset-list');
        
        if(!list) return;

        // Filter: Cari di Nama Lokasi, Brand, atau Masalah
        const filtered = state.db.assets.filter(a => {
            const locName = state.getLocationName(a.location_id).toLowerCase();
            return locName.includes(term) || 
                   (a.brand && a.brand.toLowerCase().includes(term)) || 
                   (a.issue && a.issue.toLowerCase().includes(term));
        });

        // Update Statistik Dashboard
        document.getElementById('stat-total').innerText = state.db.assets.length;
        document.getElementById('stat-overdue').innerText = state.db.assets.filter(a => ut.isOverdue(a.service)).length;
        document.getElementById('stat-normal').innerText = state.db.assets.filter(a=>a.cond==='Normal').length;
        document.getElementById('stat-issue').innerText = state.db.assets.filter(a=>a.cond==='Rusak').length;
        document.getElementById('stat-maintenance').innerText = state.db.assets.filter(a=>a.cond==='Perlu Servis').length;

        list.innerHTML = filtered.map(a => {
            const isOverdue = ut.isOverdue(a.service);
            const isSel = state.ui.selected.has(a.id);
            const locName = state.getLocationName(a.location_id);
            const typeName = state.getTypeName(a.type_id);

            // Icon Mapping
            let iconClass = 'fa-box';
            if(a.type_id === 'type_ac') iconClass = 'fa-wind';
            if(a.type_id === 'type_light') iconClass = 'fa-lightbulb';
            if(a.type_id === 'type_ups' || a.type_id === 'type_genset') iconClass = 'fa-bolt';
            if(a.type_id === 'type_network') iconClass = 'fa-network-wired';

            return `
            <div class="asset-card bg-white p-5 rounded-xl shadow-sm border border-slate-100 relative group ${isSel?'selected':''} ${a.cond==='Rusak'?'status-rusak':a.cond==='Perlu Servis'?'status-servis':isOverdue?'status-overdue':'status-normal'}" onclick="${state.ui.multiSelect?`app.toggleSelect('${a.id}')`:''}">
                ${state.ui.multiSelect ? `<div class="absolute top-3 right-3"><input type="checkbox" ${isSel?'checked':''} class="w-5 h-5 accent-accent"></div>` : ''}
                
                <div class="flex justify-between items-start mb-3">
                    <div class="bg-slate-100 p-2 rounded-lg text-slate-500"><i class="fa-solid ${iconClass} text-xl"></i></div>
                    <div class="flex flex-col items-end">
                        ${isOverdue && a.cond==='Normal' ? '<span class="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase mb-1">Telat Servis</span>' : ''}
                        ${a.cond!=='Normal' ? `<span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${a.cond==='Rusak'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${a.cond}</span>` : ''}
                    </div>
                </div>
                
                <h4 class="font-bold text-slate-800 text-lg leading-tight mb-1">${locName}</h4>
                <div class="text-xs font-bold text-accent mb-1">${typeName}</div>
                <p class="text-sm text-slate-500 mb-3">${a.brand||'-'} ${a.model||''}</p>
                
                ${a.issue ? `<div class="bg-red-50 text-red-600 text-xs p-2 rounded border border-red-100 mb-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i> ${a.issue}</div>` : ''}
                
                <div class="flex items-center gap-2 text-xs text-slate-400 border-t pt-3">
                    <i class="fa-regular fa-calendar-check"></i>
                    <span>Svc: ${a.service ? dayjs(a.service).format('DD MMM YYYY') : 'Belum'}</span>
                </div>
                
                ${!state.ui.multiSelect ? `<button onclick="app.editAsset('${a.id}')" class="absolute bottom-3 right-3 text-accent hover:text-blue-700"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
            </div>`;
        }).join('');
    },

    // --- RENDER WORK ORDER (BARU TAHAP 2) ---
    renderWO: () => {
        const list = document.getElementById('wo-list');
        if(!list) return; // Guard clause jika elemen tidak ditemukan

        let data = state.db.work_orders || [];
        
        // Sorting: Prioritas (Critical > High > Med > Low)
        data.sort((a,b) => {
            const score = { 'Critical': 4, 'High': 3, 'Med': 2, 'Low': 1 };
            // Jika score sama, urutkan berdasarkan yang terbaru (created_at desc)
            if (score[b.priority] === score[a.priority]) {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            return score[b.priority] - score[a.priority];
        });

        if(data.length === 0) {
            list.innerHTML = '<div class="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">Belum ada Work Order aktif.<br><span class="text-xs">Klik "Buat WO" untuk memulai.</span></div>';
            return;
        }

        list.innerHTML = data.map(w => {
            const asset = state.db.assets.find(a => a.id === w.asset_id) || { brand: 'Unknown' };
            const locName = state.getLocationName(asset.location_id);

            // Warna Status Badge
            const statusColor = { 
                'OPEN': 'bg-blue-100 text-blue-700', 
                'PROGRESS': 'bg-yellow-100 text-yellow-700', 
                'DONE': 'bg-green-100 text-green-700', 
                'VERIFIED': 'bg-slate-100 text-slate-700' 
            }[w.status] || 'bg-gray-100 text-gray-700';

            // Warna Border Prioritas
            const priorityStyle = { 
                'Critical': 'border-l-purple-600 bg-purple-50', 
                'High': 'border-l-red-500', 
                'Med': 'border-l-yellow-500', 
                'Low': 'border-l-blue-500' 
            }[w.priority] || 'border-l-gray-300';

            return `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 border-l-4 ${priorityStyle} relative mb-4 transition hover:shadow-md">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-bold text-slate-400 font-mono">${w.no} • ${dayjs(w.created_at).format('DD MMM')}</span>
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${statusColor}">${w.status}</span>
                </div>
                
                <h4 class="font-bold text-slate-800 text-lg mb-1 leading-snug">${w.title}</h4>
                <div class="text-xs text-slate-500 mb-3 flex items-center gap-1">
                    <i class="fa-solid fa-location-dot"></i> ${locName} • <span class="font-semibold">${asset.brand}</span>
                </div>
                
                <p class="text-sm text-slate-600 bg-white/50 p-2 rounded border border-slate-100 mb-3 italic">
                    "${w.desc}"
                </p>

                <div class="flex gap-2 border-t pt-3">
                    ${w.status === 'OPEN' ? 
                        `<button onclick="app.updateWOStatus('${w.id}', 'PROGRESS')" class="flex-1 py-2 bg-accent text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition">Mulai Kerja</button>` : ''}
                    
                    ${w.status === 'PROGRESS' ? 
                        `<button onclick="app.showFinishWOModal('${w.id}')" class="flex-1 py-2 bg-success text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition">Selesai</button>` : ''}
                    
                    ${w.status === 'DONE' ? 
                        `<button class="flex-1 py-2 bg-slate-100 text-slate-400 rounded-lg text-xs font-bold cursor-not-allowed"><i class="fa-solid fa-check-double mr-1"></i> Menunggu Verif</button>` : ''}
                        
                    ${w.status === 'VERIFIED' ? 
                        `<button class="flex-1 py-2 bg-slate-50 text-slate-400 rounded-lg text-xs font-bold cursor-default">Verified</button>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    // Filter WO (Client side filter sederhana)
    filterWO: (status) => {
        // Implementasi sederhana: render ulang semua, lalu hide yang tidak sesuai via CSS/JS di memori
        // Tapi cara paling bersih adalah panggil renderWO() dengan parameter filter, 
        // namun untuk saat ini kita manipulasi DOM langsung agar cepat.
        
        const list = document.getElementById('wo-list');
        const cards = list.children; // Ambil semua elemen card
        
        for (let card of cards) {
            // Kita cari text status di dalam card
            // Cara ini agak 'hacky' tapi cepat tanpa ubah state logic
            const statusText = card.querySelector('.uppercase').innerText; 
            
            if (status === 'All' || statusText === status) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        }
    },

    // --- FORM HELPERS (POPULATE SELECT) ---
    populateLocationSelect: (selectedId = null) => {
        const el = document.getElementById('asset-location');
        if(!el) return;
        el.innerHTML = '<option value="">-- Pilih Lokasi --</option>';
        
        // Ambil lokasi tipe 'SITE' untuk grouping (opsional) atau flat list
        // Kita tampilkan semua lokasi selain SITE (jadi gedung/ruangan muncul)
        state.db.master.locations.filter(l => l.type !== 'SITE').forEach(loc => {
            const op = document.createElement('option');
            op.value = loc.id; 
            op.text = loc.name;
            if(loc.id === selectedId) op.selected = true;
            el.add(op);
        });
    },

    populateTypeSelect: (selectedId = null) => {
        const el = document.getElementById('asset-type');
        if(!el) return;
        el.innerHTML = '';
        state.db.master.asset_types.forEach(t => {
            const op = document.createElement('option');
            op.value = t.id; 
            op.text = t.name;
            if(t.id === selectedId) op.selected = true;
            el.add(op);
        });
    },

    // Populate Asset untuk Dropdown Form WO
    populateAssetSelectForWO: () => {
        const el = document.getElementById('wo-asset-id');
        if(!el) return;
        el.innerHTML = '';
        
        if (state.db.assets.length === 0) {
            el.innerHTML = '<option value="">Belum ada aset</option>';
            return;
        }

        state.db.assets.forEach(a => {
            const locName = state.getLocationName(a.location_id);
            const op = document.createElement('option');
            op.value = a.id;
            // Tampilan: Lokasi - Merk Model
            op.text = `${locName} | ${a.brand} ${a.model}`; 
            el.add(op);
        });
    },

    // --- UTILS ---
    toggleIssueField: (val) => {
        const el = document.getElementById('issue-container');
        if (el) el.classList.toggle('hidden', val==='Normal'); 
    },
    
    updateBulkCount: () => {
        const el = document.getElementById('selected-count');
        if (el) el.innerText = state.ui.selected.size;
    },

    // --- RENDER ACTIVITY (LOG HARIAN) ---
    renderActivities: () => {
        const list = document.getElementById('activity-list');
        if (!list) return;
        
        const acts = state.db.activities || [];
        if(acts.length === 0) { 
            document.getElementById('empty-activity')?.classList.remove('hidden'); 
            list.innerHTML=''; 
            return; 
        }
        
        document.getElementById('empty-activity')?.classList.add('hidden');
        list.innerHTML = acts.map(a => `
            <div class="relative pl-8 pb-8 border-l-2 border-slate-200 last:border-0 last:pb-0">
                <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-accent"></div>
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${dayjs(a.date).format('DD MMM YYYY')} • ${a.time}</span>
                            <h4 class="font-bold text-slate-800 text-lg">${a.title}</h4>
                        </div>
                        <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">${a.tag}</span>
                    </div>
                    <p class="text-sm text-slate-600 whitespace-pre-line mb-3">${a.desc}</p>
                    ${a.img ? `<img src="${a.img}" class="h-24 rounded border cursor-pointer hover:opacity-90" onclick="window.open(this.src)">` : ''}
                </div>
            </div>`).join('');
    },

    // --- RENDER FINANCE ---
    renderFinance: () => {
        const list = document.getElementById('finance-list');
        if (!list) return;

        const fins = state.db.finances || [];
        const totalEl = document.getElementById('finance-total');
        if (totalEl) totalEl.innerText = ut.fmtRp(fins.reduce((acc,c)=>acc+(c.cost||0),0));
        
        if(fins.length === 0) { 
            document.getElementById('empty-finance')?.classList.remove('hidden'); 
            list.innerHTML=''; 
            return; 
        }
        
        document.getElementById('empty-finance')?.classList.add('hidden');
        list.innerHTML = fins.map(f => `
            <div class="bg-white p-4 rounded-xl border border-slate-200 flex gap-4 items-center shadow-sm">
                <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                    ${f.img ? `<img src="${f.img}" class="w-full h-full object-cover rounded-full cursor-pointer" onclick="window.open(this.src)">` : '<i class="fa-solid fa-receipt"></i>'}
                </div>
                <div class="flex-1">
                    <div class="flex justify-between">
                        <h4 class="font-bold text-slate-800">${f.item}</h4>
                        <span class="font-mono font-bold text-emerald-600">${ut.fmtRp(f.cost)}</span>
                    </div>
                    <div class="text-xs text-slate-400">${dayjs(f.date).format('DD MMM YYYY')}</div>
                </div>
            </div>`).join('');
    }
};
