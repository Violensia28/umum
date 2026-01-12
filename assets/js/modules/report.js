import { state } from '../state.js';
import { ut } from '../utils.js';

export const report = {
    // --- Helper: Membuat Kop Surat Standar ---
    addHeader: (doc, title, subtitle) => {
        const width = doc.internal.pageSize.getWidth();
        
        // 1. Placeholder Logo (Kotak Abu)
        // Nanti bisa diganti dengan doc.addImage() jika punya logo Base64
        doc.setFillColor(241, 245, 249); // Warna slate-100
        doc.rect(14, 10, 25, 25, 'F');
        doc.setFontSize(8); doc.setTextColor(100);
        doc.text("LOGO", 19, 25);

        // 2. Teks Instansi
        doc.setTextColor(15, 23, 42); // Warna slate-900
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text((state.db.meta?.agency_name || "TECHPARTNER OPERATIONS"), 45, 18);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Unit Layanan Teknis & Pemeliharaan Aset Terpadu", 45, 24);
        doc.text("Laporan Sistem Manajemen Aset V6.0", 45, 30);
        
        // 3. Garis Pembatas
        doc.setLineWidth(0.5);
        doc.setDrawColor(200);
        doc.line(14, 38, width - 14, 38);

        // 4. Judul Dokumen
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), width/2, 50, { align: 'center' });
        
        if(subtitle) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100);
            doc.text(subtitle, width/2, 56, { align: 'center' });
        }
    },

    // --- Helper: Footer Tanda Tangan ---
    addSignature: (doc) => {
        const h = doc.internal.pageSize.getHeight();
        const w = doc.internal.pageSize.getWidth();
        // Posisi Y menyesuaikan akhir tabel atau di bawah halaman
        const y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : h - 60;
        
        // Cek agar tidak keluar halaman
        const finalY = (y > h - 50) ? h - 50 : y;

        doc.setFontSize(10); doc.setTextColor(0);
        doc.text(`Dicetak pada: ${dayjs().format('DD MMMM YYYY')}`, w - 20, finalY, { align: 'right' });
        
        doc.text("Dibuat Oleh,", 40, finalY + 10, { align: 'center' });
        doc.text("Mengetahui,", w - 40, finalY + 10, { align: 'center' });
        
        doc.text("( ........................... )", 40, finalY + 35, { align: 'center' });
        doc.text("( ........................... )", w - 40, finalY + 35, { align: 'center' });
    },

    // 1. LAPORAN ASET (Inventory)
    assetPDF: () => {
        const doc = new jspdf.jsPDF();
        report.addHeader(doc, "Laporan Inventaris Aset", `Total Aset: ${state.db.assets.length} Item`);

        const rows = state.db.assets.map((a, i) => [
            i + 1,
            state.getLocationName(a.location_id),
            state.getTypeName(a.type_id),
            `${a.brand || '-'} ${a.model || ''}`,
            a.cond,
            a.service ? dayjs(a.service).format('DD/MM/YY') : '-'
        ]);

        doc.autoTable({
            startY: 65,
            head: [['No', 'Lokasi', 'Tipe', 'Merk/Model', 'Kondisi', 'Last Svc']],
            body: rows,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42] } // Warna Gelap
        });

        report.addSignature(doc);
        doc.save(`Aset_${dayjs().format('YYYYMMDD')}.pdf`);
    },

    // 2. LAPORAN WO (Pekerjaan)
    woPDF: () => {
        const doc = new jspdf.jsPDF('l', 'mm', 'a4'); // Landscape agar muat banyak kolom
        const s = document.getElementById('report-start')?.value;
        const e = document.getElementById('report-end')?.value;
        
        // Filter Data WO berdasarkan Tanggal
        const filtered = state.db.work_orders.filter(w => {
            if(!s || !e) return true; // Jika filter kosong, ambil semua
            return dayjs(w.created_at).isAfter(dayjs(s).subtract(1,'day')) && 
                   dayjs(w.created_at).isBefore(dayjs(e).add(1,'day'));
        });

        report.addHeader(doc, "Laporan Pekerjaan (Work Order)", `Periode: ${s ? dayjs(s).format('DD/MM/YY') : 'Awal'} s/d ${e ? dayjs(e).format('DD/MM/YY') : 'Akhir'}`);

        const rows = filtered.map((w, i) => [
            i + 1,
            dayjs(w.created_at).format('DD/MM/YY'),
            w.no,
            w.title,
            w.priority,
            w.status,
            w.tech_notes || '-'
        ]);

        doc.autoTable({
            startY: 65,
            head: [['No', 'Tgl', 'Tiket', 'Pekerjaan', 'Prioritas', 'Status', 'Catatan']],
            body: rows,
            headStyles: { fillColor: [37, 99, 235] } // Warna Biru
        });

        report.addSignature(doc);
        doc.save(`WO_${dayjs().format('YYYYMMDD')}.pdf`);
    },

    // 3. LAPORAN KEUANGAN
    financePDF: () => {
        const doc = new jspdf.jsPDF();
        report.addHeader(doc, "Laporan Pengeluaran", `Tahun Anggaran ${dayjs().format('YYYY')}`);
        
        const rows = state.db.finances.map((f, i) => [
            i + 1,
            dayjs(f.date).format('DD/MM/YYYY'),
            f.item,
            ut.fmtRp(f.cost)
        ]);
        
        // Hitung Total
        const total = state.db.finances.reduce((acc, c) => acc + (c.cost||0), 0);
        rows.push(['', '', 'TOTAL', ut.fmtRp(total)]);

        doc.autoTable({
            startY: 65,
            head: [['No', 'Tanggal', 'Uraian Belanja', 'Biaya']],
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [5, 150, 105] } // Warna Hijau
        });

        report.addSignature(doc);
        doc.save(`Keuangan_${dayjs().format('YYYYMMDD')}.pdf`);
    }
};
