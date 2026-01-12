import { state } from '../state.js';
import { ut } from '../utils.js';

export const ai = {
    // 1. Kirim Pesan ke AI
    send: async () => {
        const input = document.getElementById('ai-input');
        const box = document.getElementById('ai-chat-box');
        const sendBtn = document.getElementById('ai-send-btn');
        
        if (!input || !box || !input.value.trim()) return;

        const userMsg = input.value;
        const apiKey = state.config.gemini;

        // Validasi API Key
        if (!apiKey) {
            // Gunakan alert bawaan atau Swal jika tersedia
            if(typeof Swal !== 'undefined') {
                Swal.fire('API Key Kosong', 'Silakan masukkan Gemini API Key di menu Pengaturan.', 'warning');
            } else {
                alert('API Key Kosong. Cek Pengaturan.');
            }
            return;
        }

        // Tampilkan Pesan User
        input.value = '';
        input.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        
        box.innerHTML += `
            <div class="flex justify-end mb-4">
                <div class="bg-ai text-white px-4 py-2 rounded-2xl rounded-tr-none max-w-[85%] text-sm shadow-sm">
                    ${userMsg}
                </div>
            </div>`;
        box.scrollTop = box.scrollHeight;

        // Siapkan Konteks Data (Grounding)
        // AI perlu tahu kondisi 'kantor' saat ini agar jawabannya relevan
        const context = {
            agency: state.db.meta?.agency_name || "Instansi Umum",
            stats: {
                total_assets: state.db.assets.length,
                broken_assets: state.db.assets.filter(a => a.cond === 'Rusak').length,
                need_service: state.db.assets.filter(a => a.cond === 'Perlu Servis' || ut.isOverdue(a.service)).length,
                active_wo: (state.db.work_orders || []).filter(w => w.status !== 'DONE').length
            },
            // Ambil 3 data keuangan terakhir
            recent_finances: state.db.finances.slice(0, 3).map(f => `${f.item}: ${ut.fmtRp(f.cost)}`),
            // Ambil 3 WO prioritas tinggi
            urgent_wo: state.db.work_orders.filter(w => w.priority === 'Critical' || w.priority === 'High').slice(0, 3).map(w => w.title)
        };

        const systemPrompt = `
            Anda adalah "TechPartner Consultant", asisten AI pakar manajemen aset.
            
            DATA REAL-TIME INSTANSI "${context.agency}":
            - Total Aset: ${context.stats.total_assets}
            - Aset Rusak: ${context.stats.broken_assets}
            - Perlu Servis/Telat: ${context.stats.need_service}
            - Work Order Aktif: ${context.stats.active_wo}
            - Pengeluaran Terakhir: ${context.recent_finances.join(', ') || 'Belum ada'}
            - WO Prioritas: ${context.urgent_wo.join(', ') || 'Tidak ada'}

            TUGAS ANDA:
            1. Jawab pertanyaan user berdasarkan data di atas.
            2. Berikan saran teknis yang logis, efisien, dan profesional.
            3. Gunakan Bahasa Indonesia yang lugas.
            4. Format jawaban dengan Markdown (Bold, List) agar rapi.
        `;

        // Loading Indicator
        const loadingId = 'ai-loading-' + Date.now();
        box.innerHTML += `
            <div id="${loadingId}" class="flex justify-start mb-4">
                <div class="bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm text-slate-400 text-xs flex items-center gap-2">
                    <i class="fa-solid fa-circle-notch animate-spin"></i> Menganalisis data...
                </div>
            </div>`;
        box.scrollTop = box.scrollHeight;

        // Request ke Gemini API
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userMsg }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] }
                })
            });

            const result = await response.json();
            const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, saya tidak dapat terhubung ke server AI saat ini.";

            // Hapus Loading
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            // Tampilkan Jawaban AI
            // Cek apakah library marked.js tersedia untuk format teks
            const formattedText = typeof marked !== 'undefined' ? marked.parse(aiResponse) : aiResponse;

            box.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none max-w-[90%] text-sm shadow-md prose prose-sm text-slate-700">
                        ${formattedText}
                    </div>
                </div>`;
            
        } catch (error) {
            console.error("AI Error:", error);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            
            box.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-2xl text-xs">
                        Gagal menghubungi AI. Periksa koneksi internet atau API Key.
                    </div>
                </div>`;
        } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            box.scrollTop = box.scrollHeight;
            input.focus();
        }
    },

    // 2. Diagnosa Cepat dari Form Aset
    diagnoseIssue: () => {
        const issue = document.getElementById('asset-issue')?.value;
        const brand = document.getElementById('asset-brand')?.value;
        const model = document.getElementById('asset-model')?.value;

        if (!issue || issue.length < 3) {
            if(typeof Swal !== 'undefined') {
                Swal.fire('Info', 'Mohon isi detail kerusakan terlebih dahulu.', 'info');
            } else {
                alert('Mohon isi detail kerusakan.');
            }
            return;
        }

        // Buka modal AI secara manual (DOM Manipulation untuk menghindari circular dependency)
        const modal = document.getElementById('modal-ai');
        if(modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
            const input = document.getElementById('ai-input');
            if (input) {
                input.value = `Tolong diagnosa masalah pada aset ${brand} ${model}. Keluhannya adalah: "${issue}". Berikan kemungkinan penyebab dan solusi perbaikannya.`;
                // Panggil fungsi send
                ai.send();
            }
        }
    }
};
