/**
 * utils.js - Helper Functions TechPartner 6.0
 * Berisi fungsi-fungsi pendukung untuk ID, Format Uang, Waktu, Gambar, dan Enkripsi.
 */
export const ut = {
    // 1. ID Generator (Membuat ID unik berbasis waktu)
    id: () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5),

    // 2. Format Rupiah (Mengubah angka 1000000 jadi "Rp 1.000.000")
    fmtRp: (n) => {
        return new Intl.NumberFormat('id-ID', { 
            style: 'currency', 
            currency: 'IDR', 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(n || 0);
    },

    // 3. Cek Overdue (Apakah tanggal servis sudah lewat?)
    isOverdue: (dateStr) => {
        if(!dateStr) return false;
        // Memerlukan library dayjs yang sudah di-load di index.html
        return typeof dayjs !== 'undefined' ? dayjs(dateStr).isBefore(dayjs(), 'day') : false;
    },

    // 4. Kompresi Gambar (PENTING: Agar database GitHub tidak cepat penuh & aplikasi ringan)
    // Mengubah file gambar besar menjadi JPG resolusi max 800px
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
                    
                    // Logika Resize: Max lebar/tinggi 800px
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
                    
                    // Output: JPEG kualitas 70%
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    // 5. BASE64 HELPERS (INI YANG MEMPERBAIKI ERROR DB.JS)
    // GitHub API butuh Base64. Fungsi bawaan browser (atob/btoa) tidak support Emoji/UTF-8.
    // Fungsi ini menangani karakter khusus tersebut agar data aman.
    
    // Encode (String Biasa -> Base64)
    b64Enc: (str) => {
        return btoa(unescape(encodeURIComponent(str)));
    },
    
    // Decode (Base64 -> String Biasa)
    b64Dec: (str) => {
        return decodeURIComponent(escape(atob(str)));
    },

    // 6. Preview Image Helper (Untuk menampilkan preview saat upload foto)
    previewImage: (input, imgId) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.getElementById(imgId);
                if(img) {
                    img.src = e.target.result;
                    img.classList.remove('hidden');
                }
            }
            reader.readAsDataURL(input.files[0]);
        }
    }
};
