import { state } from '../state.js';
import { ut } from '../utils.js';

/**
 * ai.js - Modul Kecerdasan Buatan TechPartner 6.0
 * Mengelola komunikasi dengan Gemini API dan analisis data operasional.
 */
export const ai = {
    /**
     * Mengirim pesan user ke AI dengan menyertakan konteks data aplikasi.
     */
    send: async () => {
        const input = document.getElementById('ai-input');
        const box = document.getElementById('ai-chat-box');
        const sendBtn = document.getElementById('ai-send-btn');
        
        if (!input || !box || !input.value.trim()) return;

        const userMsg = input.value;
        const apiKey = state.config.gemini;

        if (!apiKey) {
            Swal.fire('API Key Kosong', 'Silakan masukkan Gemini API Key di menu Pengaturan terlebih dahulu.', 'warning');
            return;
        }

        // 1. Tampilkan Pesan User di UI
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

        // 2. Siapkan Konteks Data untuk AI (Grounding)
        const context = {
            agency: state.db.meta?.agency_name || "Instansi Umum",
            stats: {
                total_assets: state.db.assets.length,
                broken_assets: state.db.assets.filter(a => a.cond === 'Rusak').length,
                need_service: state.db.assets.filter(a => a.cond === 'Perlu Servis' || ut.isOverdue(a.service)).length,
                active_wo: (state.db.work_orders || []).filter(w => w.status !== 'DONE').length
            },
            recent_finances: state.db.finances.slice(0, 3).map(f => `${f.item}: ${ut.fmtRp(f.cost)}`),
            urgent_wo: state.db.work_orders.filter(w => w.priority === 'Critical' || w.priority === 'High').slice(0, 3).map(w => w.title)
        };

        const systemPrompt = `
            Anda adalah "TechPartner Consultant", asisten AI pakar manajemen aset dan teknisi pemeliharaan.
            Konteks data saat ini di instansi "${context.agency}":
            - Total Aset: ${context.stats.total_assets}
            - Aset Rusak: ${context.stats.broken_assets}
            - Perlu Servis/Telat: ${context.stats.need_service}
            - Work Order Aktif: ${context.stats.active_wo}
            - Pengeluaran Terakhir: ${context.recent_finances.join(', ') || 'Belum ada'}
            - WO Prioritas: ${context.urgent_wo.join(', ') || 'Tidak ada'}

            Tugas Anda:
            1. Jawab pertanyaan user berdasarkan data di atas.
            2. Berikan saran teknis yang logis, efisien, dan profesional.
            3. Gunakan Bahasa Indonesia yang lugas namun sopan.
            4. Jika user bertanya hal di luar maintenance, arahkan kembali ke topik operasional.
            5. Gunakan format Markdown (bold, list) agar mudah dibaca.
        `;

        // 3. Tambahkan Loading Indicator
        const loadingId = 'ai-loading-' + Date.now();
        box.innerHTML += `
            <div id="${loadingId}" class="flex justify-start mb-4">
                <div class="bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm text-slate-400 text-xs flex items-center gap-2">
                    <i class="fa-solid fa-circle-notch animate-spin"></i> Menganalisis data...
                </div>
            </div>`;
        box.scrollTop = box.scrollHeight;

        // 4. Panggil API Gemini
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
            const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, saya tidak mendapatkan respon dari otak pusat.";

            // Hapus Loading dan Tampilkan Jawaban
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();

            box.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none max-w-[90%] text-sm shadow-md prose prose-sm text-slate-700">
                        ${marked.parse(aiResponse)}
                    </div>
                </div>`;
            
        } catch (error) {
            console.error("AI Error:", error);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) loadingEl.remove();
            
            box.innerHTML += `
                <div class="flex justify-start mb-4">
                    <div class="bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-2xl text-xs">
                        Gagal menghubungi AI. Periksa koneksi internet atau API Key Anda.
                    </div>
                </div>`;
        } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            box.scrollTop = box.scrollHeight;
            input.focus();
        }
    },

    /**
     * Fungsi khusus untuk menganalisis kerusakan aset tertentu (Dipanggil dari Modal Aset)
     */
    diagnoseIssue: async () => {
        const issue = document.getElementById('asset-issue')?.value;
        const brand = document.getElementById('asset-brand')?.value;
        const model = document.getElementById('asset-model')?.value;

        if (!issue || issue.length < 5) {
            Swal.fire('Info', 'Mohon tuliskan detail kerusakan aset agar AI bisa menganalisa.', 'info');
            return;
        }

        ui.showModal('modal-ai');
        const input = document.getElementById('ai-input');
        if (input) {
            input.value = `Berikan diagnosa teknis dan langkah perbaikan untuk: ${brand} ${model} dengan keluhan "${issue}"`;
            ai.send();
        }
    }
};
