/**
 * utils.js - Kumpulan Fungsi Bantu (Helper)
 * Digunakan di seluruh aplikasi untuk format data & utilitas teknis.
 */
export const ut = {
    // 1. ID Generator (Singkat & Unik berdasarkan Timestamp)
    id: () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5),

    // 2. Format Rupiah (Rp 1.000.000)
    fmtRp: (n) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0 
        }).format(n || 0);
    },

    // 3. Cek apakah tanggal sudah lewat (Overdue)
    // Return true jika tanggal target < hari ini
    isOverdue: (dateStr) => {
        if(!dateStr) return false;
        return dayjs(dateStr).isBefore(dayjs(), 'day');
    },

    // 4. Kompresi Gambar (PENTING UNTUK PERFORMA)
    // Mengubah file input menjadi Base64 string yang diperkecil (max 800px)
    compress: (file) => {
        return new Promise((resolve, reject) => {
            if (!file) return resolve(null);
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Resize Logic (Max width/height 800px)
                    const max = 800;
                    let w = img.width;
                    let h = img.height;
                    
                    if (w > h) {
                        if (w > max) { h *= max / w; w = max; }
                    } else {
                        if (h > max) { w *= max / h; h = max; }
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    // Compress Quality 0.7 (JPEG)
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }
};
