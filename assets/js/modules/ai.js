import { state } from '../state.js';
import { ut } from '../utils.js';

export const ai = {
    getContext: () => {
        // Ringkas data untuk konteks AI
        const broken = state.db.assets.filter(a => a.cond === 'Rusak').map(a => `${state.getTypeName(a.type_id)} di ${state.getLocationName(a.location_id)} (${a.issue})`);
        return JSON.stringify({ 
            total_assets: state.db.assets.length, 
            broken_list: broken,
            locations: state.db.master.locations.map(l => l.name)
        });
    },

    send: async () => {
        const input = document.getElementById('ai-input');
        const btn = document.getElementById('ai-send-btn');
        const box = document.getElementById('ai-chat-box');
        const q = input.value.trim();

        if (!q || !state.config.gemini) {
            Swal.fire('Error', 'API Key Gemini Kosong atau Input Kosong', 'warning');
            return;
        }

        input.value = ''; 
        btn.disabled = true; 
        box.innerHTML += `<div class="chat-bubble chat-user">${q}</div>`;
        box.scrollTop = box.scrollHeight;

        try {
            const prompt = `Context JSON: ${ai.getContext()}. User Question: "${q}". Jawab sebagai asisten manajer teknis. Bahasa Indonesia, ringkas, profesional.`;
            
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.config.gemini}`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) 
            });
            
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, AI tidak merespons.";
            
            box.innerHTML += `<div class="chat-bubble chat-ai">${marked.parse(reply)}</div>`;
        } catch (e) { 
            box.innerHTML += `<div class="chat-bubble chat-ai text-red-500">Error: ${e.message}</div>`; 
        }
        
        box.scrollTop = box.scrollHeight; 
        btn.disabled = false;
        input.focus();
    },

    diagnoseIssue: async () => {
        if (!state.config.gemini) return Swal.fire('Error', 'API Key Kosong', 'warning');
        
        const issue = document.getElementById('asset-issue').value;
        // Ambil nama tipe dari select (karena form edit/add sudah dirender dengan tipe baru)
        const typeSelect = document.getElementById('asset-type');
        const typeName = typeSelect ? typeSelect.options[typeSelect.selectedIndex].text : 'Aset';
        const brand = document.getElementById('asset-brand').value;

        if(!issue) return Swal.fire('Info', 'Isi keluhan dulu', 'info');
        
        Swal.showLoading();
        try {
            const prompt = `Sebagai teknisi senior, berikan solusi perbaikan step-by-step untuk ${typeName} merk ${brand} dengan masalah: "${issue}". Sertakan estimasi tingkat kesulitan (1-10).`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.config.gemini}`, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({contents:[{parts:[{text:prompt}]}]}) 
            });
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal diagnosa.";
            
            Swal.fire({ 
                title: 'Analisa AI', 
                html: `<div class="text-left text-sm whitespace-pre-line prose">${marked.parse(reply)}</div>`, 
                icon: 'info', 
                width: '600px' 
            });
        } catch (e) { 
            Swal.fire('Error', 'Gagal koneksi AI', 'error'); 
        }
    }
};
