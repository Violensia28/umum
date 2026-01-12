import { state } from '../state.js';
import { ut } from '../utils.js';
import { db } from '../db.js';

export const wo = {
    // Buat WO Baru
    create: (assetId, title, priority, desc, type = 'Repair') => {
        const item = {
            id: 'wo_' + ut.id(),
            no: `WO/${dayjs().format('YYMM')}/${state.db.work_orders.length + 1}`,
            asset_id: assetId,
            title: title,
            desc: desc,
            priority: priority, // 'Low', 'Med', 'High', 'Critical'
            type: type,         // 'Repair', 'Maintenance', 'Installation'
            status: 'OPEN',     // 'OPEN', 'PROGRESS', 'DONE', 'VERIFIED'
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: null,
            tech_notes: '',
            photos: { before: [], after: [] }
        };
        
        state.db.work_orders.unshift(item);
        db.push(`New WO: ${title}`);
        return item;
    },

    // Update Status WO
    updateStatus: (woId, newStatus, notes = null) => {
        const w = state.db.work_orders.find(x => x.id === woId);
        if(!w) return;

        w.status = newStatus;
        w.updated_at = new Date().toISOString();
        if(notes) w.tech_notes = notes;

        // LOGIKA PM ENGINE (Jantungnya Tahap 2)
        // Jika Status jadi DONE, update data aset otomatis
        if (newStatus === 'DONE') {
            w.completed_at = new Date().toISOString();
            
            // Cari aset terkait
            const asset = state.db.assets.find(a => a.id === w.asset_id);
            if (asset) {
                // 1. Update Last Service Date di Aset
                asset.service = dayjs().format('YYYY-MM-DD');
                
                // 2. Jika Aset Rusak & WO tipe Repair -> Ubah jadi Normal
                if (asset.cond === 'Rusak' && w.type === 'Repair') {
                    asset.cond = 'Normal';
                    asset.issue = '';
                }

                // 3. Hitung Next PM Date (Otomatis)
                // Cari interval PM berdasarkan Tipe Aset
                const typeDef = state.db.master.asset_types.find(t => t.id === asset.type_id);
                const interval = typeDef ? typeDef.pm_interval : 90; // Default 90 hari
                
                if (interval > 0) {
                    asset.next_pm_date = dayjs().add(interval, 'day').format('YYYY-MM-DD');
                }
            }
        }

        db.push(`WO ${w.no} -> ${newStatus}`);
    },

    // Upload Foto ke WO (Before/After)
    addPhoto: async (woId, type, file) => {
        const w = state.db.work_orders.find(x => x.id === woId);
        if(!w) return;
        const b64 = await ut.compress(file);
        if(!w.photos[type]) w.photos[type] = [];
        w.photos[type].push(b64);
        db.push(`WO Photo ${type}`);
    }
};
