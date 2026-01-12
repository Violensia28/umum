export const ut = {
    // Generate ID unik
    id: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    
    // Format Rupiah
    fmtRp: (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n),
    
    // Base64 Encode/Decode (untuk GitHub API)
    b64Enc: (str) => btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1))),
    b64Dec: (str) => decodeURIComponent(atob(str).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')),
    
    // Cek Overdue (90 hari)
    isOverdue: (dateStr) => dateStr ? dayjs().diff(dayjs(dateStr), 'day') > 90 : false,
    
    // Preview Image dari Input File
    previewImage: (input, imgId) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.getElementById(imgId);
                if(img) {
                    img.src = e.target.result;
                    img.classList.remove('hidden');
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    // Kompresi Gambar (Penting agar database JSON tidak meledak)
    compress: (file) => {
        return new Promise((resolve) => {
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize ke max 800px
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.6)); // Kualitas 60%
                }
            }
        });
    }
};
