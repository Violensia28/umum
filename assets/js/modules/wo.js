import { state } from '../state.js';
import { ut } from '../utils.js';
import { db } from '../db.js';

export const wo = {
    // 1. Buat Tiket Baru
    create: (assetId, title, priority, desc, type = 'Repair') => {
        const item = {
            id: 'wo_' + ut.id(),
            no: `WO/${dayjs().format('YYMM')}/${state.db.work_orders.length + 1}`,
            asset_id: assetId,
            title: title,
            desc: desc,
            priority: priority, // 'Low', 'Med', 'High', 'Critical'
            type: type,         // 'Repair', 'Maintenance', 'Installation'
            status: 'OPEN',     // 'OPEN', 'PROGRESS', 'DONE'
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

    // 2. Update Status & PM Engine
    updateStatus: (woId, newStatus, notes = null) => {
        const w = state.db.work_orders.find(x => x.id === woId);
        if(!w) return;

        w.status = newStatus;
        w.updated_at = new Date().toISOString();
        if(notes) w.tech_notes = notes;

        // --- LOGIKA OTOMATISASI PM (Preventive Maintenance) ---
        // Jika status DONE, update data aset terkait
        if (newStatus === 'DONE') {
            w.completed_at = new Date().toISOString();
            
            const asset = state.db.assets.find(a => a.id === w.asset_id);
            if (asset) {
                // A. Update Tanggal Servis Terakhir
                asset.service = dayjs().format('YYYY-MM-DD');
                
                // B. Jika aset sebelumnya rusak & ini perbaikan -> Tandai Normal
                if (asset.cond === 'Rusak' && w.type === 'Repair') {
                    asset.cond = 'Normal';
                    asset.issue = '';
                }

                // C. Hitung Jadwal Servis Berikutnya (Next PM)
                // Default 90 hari jika tipe aset tidak ditemukan di master
                const typeDef = state.db.master.asset_types.find(t => t.id === asset.type_id);
                const interval = typeDef ? typeDef.pm_interval : 90; 
                
                if (interval > 0) {
                    asset.next_pm_date = dayjs().add(interval, 'day').format('YYYY-MM-DD');
                }
            }
        }

        db.push(`WO ${w.no} -> ${newStatus}`);
    },

    // 3. Upload Foto Bukti
    addPhoto: async (woId, type, file) => {
        const w = state.db.work_orders.find(x => x.id === woId);
        if(!w) return;
        
        const b64 = await ut.compress(file);
        
        if(!w.photos) w.photos = { before: [], after: [] };
        if(!w.photos[type]) w.photos[type] = [];
        
        w.photos[type].push(b64);
        db.push(`WO Photo ${type}`);
    }
};
