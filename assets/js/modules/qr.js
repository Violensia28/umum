import { state } from '../state.js';
import { ui } from '../ui.js';

export const qr = {
    // 1. Tampilkan Modal QR
    show: (assetId) => {
        // Cari data aset berdasarkan ID
        const asset = state.db.assets.find(a => a.id === assetId);
        if (!asset) return;

        // Update Teks di Modal
        const titleEl = document.getElementById('qr-title');
        const subEl = document.getElementById('qr-subtitle');
        
        if(titleEl) titleEl.innerText = `${asset.brand || 'Aset'} ${asset.model || ''}`;
        if(subEl) subEl.innerText = state.getLocationName(asset.location_id);
        
        // Bersihkan area canvas QR sebelumnya
        const container = document.getElementById('qr-canvas');
        if(container) {
            container.innerHTML = ''; 
            
            // Data yang disimpan dalam QR (JSON string ringkas)
            // i = ID, l = Location ID
            const qrData = JSON.stringify({ 
                i: asset.id, 
                l: asset.location_id,
                t: 'TP-V6' // Penanda aplikasi
            });
            
            // Generate QR Code menggunakan library qrcode.js
            try {
                new QRCode(container, {
                    text: qrData,
                    width: 180,
                    height: 180,
                    colorDark : "#0f172a", // Warna Primary
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.M
                });
                
                // Tampilkan Modal
                ui.showModal('modal-qr');
            } catch(e) {
                console.error("QR Lib Error:", e);
                // Fallback jika library gagal load
                container.innerText = "Error: Library QR Code tidak terdeteksi.";
                ui.showModal('modal-qr');
            }
        }
    },

    // 2. Fungsi Cetak (Print) Label
    print: () => {
        const content = document.getElementById('qr-print-area').innerHTML;
        
        // Buka jendela popup baru untuk print
        const win = window.open('', '', 'height=600,width=600');
        
        win.document.write('<html><head><title>Cetak Label Aset</title>');
        win.document.write('<style>');
        win.document.write('body { font-family: sans-serif; text-align: center; padding: 40px; }');
        win.document.write('#qr-canvas { margin-bottom: 20px; }');
        win.document.write('#qr-canvas img { margin: 0 auto; display: block; border: 2px solid #000; padding: 10px; border-radius: 10px; }');
        win.document.write('h4 { margin: 10px 0 5px 0; font-size: 18px; font-weight: bold; }');
        win.document.write('p { margin: 0; color: #555; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }');
        win.document.write('.no-print { display: none; }');
        win.document.write('</style>');
        win.document.write('</head><body>');
        
        win.document.write(content); // Masukkan konten QR dari modal
        
        win.document.write('<script>window.onload = function() { window.print(); window.close(); }</script>');
        win.document.write('</body></html>');
        win.document.close();
    }
};
