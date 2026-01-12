export const state = {
    // Database Utama
    db: {
        meta: { 
            version: 2.0, 
            agency_name: "UNIT PEMELIHARAAN TEKNIS",
            last_sync: null 
        },
        assets: [],
        work_orders: [],
        activities: [],
        finances: [],
        // Master Data untuk Dropdown & Filter
        master: {
            locations: [
                { id: 'loc_1', name: 'Gedung Utama - Lantai 1', type: 'AREA' },
                { id: 'loc_2', name: 'Gedung Utama - Lantai 2', type: 'AREA' },
                { id: 'loc_3', name: 'Server Room', type: 'CRITICAL' },
                { id: 'loc_4', name: 'Area Parkir & Eksternal', type: 'AREA' }
            ],
            asset_types: [
                { id: 'type_ac', name: 'Air Conditioner (AC)', pm_interval: 90 },
                { id: 'type_ups', name: 'UPS & Kelistrikan', pm_interval: 180 },
                { id: 'type_network', name: 'Perangkat Jaringan', pm_interval: 360 },
                { id: 'type_light', name: 'Penerangan / Lampu', pm_interval: 0 } // 0 = No PM
            ]
        }
    },

    // UI State (Temporary)
    ui: {
        currentTab: 'dashboard',
        selected: new Set(),
        multiSelect: false,
        currentWOId: null
    },

    config: {
        owner: localStorage.getItem('gh_owner') || '',
        repo: localStorage.getItem('gh_repo') || '',
        token: localStorage.getItem('gh_token') || '',
        gemini: localStorage.getItem('gemini_key') || ''
    },

    // Getters
    getLocationName: (id) => state.db.master.locations.find(l => l.id === id)?.name || "Lokasi Umum",
    getTypeName: (id) => state.db.master.asset_types.find(t => t.id === id)?.name || "Lain-lain",

    // Migrasi Data (Agar data lama tidak hilang saat update struktur)
    initMigration: () => {
        if (!state.db.assets) state.db.assets = [];
        if (!state.db.work_orders) state.db.work_orders = [];
        if (!state.db.activities) state.db.activities = [];
        if (!state.db.finances) state.db.finances = [];
        if (!state.db.master) state.db.master = { locations: [], asset_types: [] };
        
        console.log("State Initialized & Migrated to V2.0");
    }
};
