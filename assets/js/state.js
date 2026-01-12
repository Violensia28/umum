import { ut } from './utils.js';

// Definisi Default Master Data
const defaultMaster = {
    locations: [
        { id: 'site_utama', name: 'Kantor Utama', type: 'SITE', parent_id: null },
        { id: 'site_stui', name: 'Rumah Dinas Stui', type: 'SITE', parent_id: null },
        { id: 'site_lampineung', name: 'Rumah Dinas Lampineung', type: 'SITE', parent_id: null },
        { id: 'site_mess', name: 'Mess Batoh', type: 'SITE', parent_id: null }
    ],
    asset_types: [
        { id: 'type_ac', name: 'AC Split', pm_interval: 90 },
        { id: 'type_light', name: 'Lampu', pm_interval: 0 },
        { id: 'type_ups', name: 'UPS', pm_interval: 180 },
        { id: 'type_genset', name: 'Genset', pm_interval: 30 },
        { id: 'type_cctv', name: 'CCTV', pm_interval: 90 },
        { id: 'type_network', name: 'Perangkat Jaringan', pm_interval: 180 },
        { id: 'type_general', name: 'Umum', pm_interval: 0 }
    ]
};

export const state = {
    db: { 
        meta: { version: 1 }, 
        master: { ...defaultMaster },
        assets: [], 
        activities: [], 
        finances: [],
        work_orders: [] 
    },
    sha: null,
    config: { 
        owner: localStorage.getItem('gh_owner')||'', 
        repo: localStorage.getItem('gh_repo')||'', 
        token: localStorage.getItem('gh_token')||'', 
        gemini: localStorage.getItem('gemini_key')||'', 
        path: 'data/db_partner.json' 
    },
    ui: { multiSelect: false, selected: new Set() },

    // --- LOGIKA MIGRASI DATA (V1 -> V2) ---
    initMigration: () => {
        // Cek jika versi DB masih lama atau belum ada versi
        if (!state.db.meta || !state.db.meta.version || state.db.meta.version < 2) {
            console.log("Mulai Migrasi Data ke V2...");
            
            // 1. Inisialisasi Master Data jika belum ada
            if (!state.db.master) state.db.master = { ...defaultMaster };
            if (!state.db.work_orders) state.db.work_orders = [];

            // 2. Migrasi Aset
            if (state.db.assets && state.db.assets.length > 0) {
                state.db.assets.forEach(asset => {
                    // a. Migrasi Kategori ke Type ID
                    if (asset.cat === 'AC') asset.type_id = 'type_ac';
                    else if (asset.cat === 'Light') asset.type_id = 'type_light';
                    else if (!asset.type_id) asset.type_id = 'type_general';

                    // b. Migrasi Lokasi String ke Location ID
                    // Cek apakah 'loc' aset ini sudah ada di master.locations?
                    // Jika belum, buat lokasi 'ROOM' baru di bawah 'Kantor Utama' (default)
                    if (asset.loc && !asset.location_id) {
                        // Cari case-insensitive
                        let existingLoc = state.db.master.locations.find(l => l.name.toLowerCase() === asset.loc.toLowerCase());
                        
                        if (existingLoc) {
                            asset.location_id = existingLoc.id;
                        } else {
                            // Buat lokasi baru otomatis dari nama lokasi lama
                            const newLocId = 'loc_' + ut.id();
                            state.db.master.locations.push({
                                id: newLocId,
                                name: asset.loc, // Pakai nama lama (misal "Ruang Server")
                                type: 'ROOM',
                                parent_id: 'site_utama' // Default parent
                            });
                            asset.location_id = newLocId;
                        }
                    }

                    // c. Set Next PM Date (Default)
                    if (!asset.next_pm_date && asset.service) {
                         // Default 90 hari untuk AC, bisa disesuaikan nanti
                         asset.next_pm_date = dayjs(asset.service).add(90, 'day').format('YYYY-MM-DD');
                    }
                    
                    // d. Tambah field Criticality default
                    if (!asset.criticality) asset.criticality = 'MED';
                });
            }

            // 3. Update Versi
            state.db.meta = {
                version: 2,
                last_updated: new Date().toISOString(),
                agency_name: "Instansi Pemerintah"
            };
            
            console.log("Migrasi Selesai. DB Version: 2");
        }
    },
    
    // Helper untuk mengambil nama lokasi dari ID
    getLocationName: (locId) => {
        const loc = state.db.master.locations.find(l => l.id === locId);
        return loc ? loc.name : (locId || '-');
    },

    // Helper untuk mengambil nama tipe dari ID
    getTypeName: (typeId) => {
        const type = state.db.master.asset_types.find(t => t.id === typeId);
        return type ? type.name : (typeId || 'Umum');
    }
};
