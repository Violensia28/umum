import { state } from './state.js';
import { ut } from './utils.js';
import { app } from './app.js'; // Untuk memanggil fungsi app.toggleSelect, app.editAsset dll

export const ui = {
    // --- TABS & MODALS ---
    switchTab: (t) => {
        ['assets','activity','finance'].forEach(x => { 
            document.getElementById(`view-${x}`).classList.add('hidden'); 
            const tabBtn = document.getElementById(`tab-${x}`);
            tabBtn.classList.remove('border-accent', 'text-primary'); 
            tabBtn.classList.add('border-transparent', 'text-slate-500'); 
        });
        document.getElementById(`view-${t}`).classList.remove('hidden'); 
        const activeBtn = document.getElementById(`tab-${t}`);
        activeBtn.classList.add('border-accent', 'text-primary'); 
        activeBtn.classList.remove('border-transparent', 'text-slate-500');
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

    // --- RENDER ASSETS ---
    renderAssets: () => {
        const term = document.getElementById('searchAsset').value.toLowerCase();
        const list = document.getElementById('asset-list');
        
        // Filter cerdas: cari di nama lokasi (hasil resolve ID), brand, model, atau issue
        const filtered = state.db.assets.filter(a => {
            const locName = state.getLocationName(a.location_id).toLowerCase();
            return locName.includes(term) || 
                   (a.brand && a.brand.toLowerCase().includes(term)) || 
                   (a.issue && a.issue.toLowerCase().includes(term));
        });

        // Update Stats
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

            // Tentukan icon berdasarkan tipe
            let iconClass = 'fa-box';
            if(a.type_id === 'type_ac') iconClass = 'fa-wind';
            if(a.type_id === 'type_light') iconClass = 'fa-lightbulb';
            if(a.type_id === 'type_ups' || a.type_id === 'type_genset') iconClass = 'fa-bolt';
            if(a.type_id === 'type_network') iconClass = 'fa-network-wired';

            return `
            <div class="asset-card bg-white p-5 rounded-xl shadow-sm border border-slate-100 relative group ${isSel?'selected':''} ${a.cond==='Rusak'?'status-rusak':a.cond==='Perlu Servis'?'status-servis':isOverdue?'status-overdue':'status-normal'}" onclick="${state.ui.multiSelect?`app.toggleSelect('${a.id}')`:''}">
                ${state.ui.multiSelect ? `<div class="absolute top-3 right-3"><input type="checkbox" ${isSel?'checked':''} class="w-5 h-5 accent-accent"></div>` : ''}
                
                <div class="flex justify-between items-start mb-3">
                    <div class="bg-slate-100 p-2 rounded-lg text-slate-500">
                        <i class="fa-solid ${iconClass} text-xl"></i>
                    </div>
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

    // --- FORM HELPERS ---
    // Render opsi lokasi di form Add/Edit
    populateLocationSelect: (selectedId = null) => {
        const el = document.getElementById('asset-location');
        if(!el) return;
        el.innerHTML = '<option value="">-- Pilih Lokasi --</option>';
        
        // Group by Site (Parent)
        // Ini implementasi sederhana Tahap 1, belum fully recursive tree UI
        const sites = state.db.master.locations.filter(l => l.type === 'SITE');
        
        sites.forEach(site => {
            const optGroup = document.createElement('optgroup');
            optGroup.label = site.name;
            
            // Cari ruangan di bawah site ini (langsung atau via gedung/lantai - simplified for now)
            // Di tahap 1, kita tampilkan semua non-site sebagai anak, atau filter berdasarkan parent logic jika data sudah rapi.
            // Untuk migrasi awal, semua ROOM parent-nya mungkin default 'site_utama'.
            // Kita tampilkan semua lokasi tipe ROOM saja biar mudah dipilih.
            state.db.master.locations.filter(l => l.type !== 'SITE').forEach(loc => {
                // Idealnya cek parent_id, tapi untuk awal tampilkan semua ROOM
                 // Jika nanti sudah rapi, filter: if(loc.parent_id === site.id)
                const op = document.createElement('option');
                op.value = loc.id;
                op.text = loc.name;
                if(loc.id === selectedId) op.selected = true;
                el.add(op); // Tambah ke select langsung (atau ke optGroup jika logic parent benar)
            });
            // el.add(optGroup); // Gunakan jika grouping sudah benar
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

    toggleIssueField: (val) => { 
        document.getElementById('issue-container').classList.toggle('hidden', val==='Normal'); 
    },
    
    updateBulkCount: () => {
        document.getElementById('selected-count').innerText = state.ui.selected.size;
    },

    // Render Activity & Finance (Masih mirip lama, tapi dipisah function)
    renderActivities: () => {
        const list = document.getElementById('activity-list');
        const acts = state.db.activities || [];
        if(acts.length === 0) {
            document.getElementById('empty-activity').classList.remove('hidden'); 
            list.innerHTML=''; 
            return;
        }
        document.getElementById('empty-activity').classList.add('hidden');
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

    renderFinance: () => {
        const list = document.getElementById('finance-list');
        const fins = state.db.finances || [];
        document.getElementById('finance-total').innerText = ut.fmtRp(fins.reduce((acc,c)=>acc+(c.cost||0),0));
        
        if(fins.length === 0) {
            document.getElementById('empty-finance').classList.remove('hidden'); 
            list.innerHTML=''; 
            return;
        }
        document.getElementById('empty-finance').classList.add('hidden');
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
