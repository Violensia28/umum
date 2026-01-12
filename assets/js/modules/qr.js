import { state } from '../state.js';
import { ui } from '../ui.js';

export const qr = {
    // Generate QR Code di Modal
    show: (assetId) => {
        const asset = state.db.assets.find(a => a.id === assetId);
        if (!asset) return;

        // Siapkan Modal
        document.getElementById('qr-title').innerText = `${asset.brand} ${asset.model}`;
        document.getElementById('qr-subtitle').innerText = state.getLocationName(asset.location_id);
        
        const container = document.getElementById('qr-canvas');
        container.innerHTML = ''; // Clear previous

        // Generate QR (Menggunakan library QRCode.js yang akan kita pasang di HTML)
        // Format data: JSON string ID agar nanti bisa discan app scanner custom atau HP
        const qrData = JSON.stringify({ id: asset.id, type: 'asset' });
        
        new QRCode(container, {
            text: qrData,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });

        ui.showModal('modal-qr');
    },

    // Print QR (Print area modal saja)
    print: () => {
        const content = document.getElementById('qr-print-area').innerHTML;
        const win = window.open('', '', 'height=600,width=600');
        win.document.write('<html><head><title>Print QR</title>');
        win.document.write('<style>body{font-family:sans-serif; text-align:center; padding: 20px;} .qr-box{border:1px solid #ccc; padding:20px; display:inline-block;}</style>');
        win.document.write('</head><body>');
        win.document.write(content);
        win.document.write('</body></html>');
        win.document.close();
        win.print();
    }
};
