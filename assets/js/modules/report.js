import { state } from '../state.js';
import { ut } from '../utils.js';

export const report = {
    // Helper: Header Kop Surat
    addHeader: (doc, title, subtitle) => {
        const width = doc.internal.pageSize.getWidth();
        
        // Placeholder Logo (Kotak Abu) - Nanti bisa diganti Base64 Logo Instansi
        doc.setFillColor(240, 240, 240);
        doc.rect(14, 10, 25, 25, 'F');
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("LOGO", 19, 25);

        // Teks Kop
        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text((state.db.meta.agency_name || "INSTANSI PEMERINTAH"), 45, 18);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Unit Layanan Teknis & Pemeliharaan Aset", 45, 24);
        doc.text("Alamat: Jl. Administrasi No. 1, Banda Aceh", 45, 30);
        
        // Garis Pembatas
        doc.setLineWidth(0.5);
        doc.line(14, 38, width - 14, 38);

        // Judul Laporan
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), width/2, 48, { align: 'center' });
        
        if(subtitle) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "italic");
            doc.text(subtitle, width/2, 54, { align: 'center' });
        }
    },

    // Helper: Footer Tanda Tangan
    addSignature: (doc) => {
        const height = doc.internal.pageSize.getHeight();
        const width = doc.internal.pageSize.getWidth();
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        const yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : height - 60;
        
        // Kiri (Teknisi)
        doc.text(`Banda Aceh, ${dayjs().format('DD MMMM YYYY')}`, width - 60, yPos, { align: 'center' });
        doc.text("Dibuat Oleh,", 40, yPos + 5, { align: 'center' });
        doc.text("Mengetahui Atasan,", width - 60, yPos + 5, { align: 'center' });

        doc.setFont("helvetica", "bold");
        doc.text("( ........................... )", 40, yPos + 30, { align: 'center' }); // Nama Anda
        doc.text("( ........................... )", width - 60, yPos + 30, { align: 'center' }); // Nama Atasan
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("Dokumen ini dihasilkan otomatis oleh TechPartner 6.0", width/2, height - 10, { align: 'center' });
    },

    // 1. Laporan Aset (Inventory)
    assetPDF: () => {
        const doc = new jspdf.jsPDF();
        report.addHeader(doc, "Laporan Inventaris Aset", `Per Tanggal: ${dayjs().format('DD/MM/YYYY')}`);

        const tableData = state.db.assets.map((a, i) => [
            i + 1,
            state.getLocationName(a.location_id),
            state.getTypeName(a.type_id),
            `${a.brand} ${a.model}`,
            a.cond,
            a.service ? dayjs(a.service).format('DD/MM/YY') : '-'
        ]);

        doc.autoTable({
            startY: 60,
            head: [['No', 'Lokasi', 'Tipe', 'Merk/Model', 'Kondisi', 'Last Svc']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 }
        });

        report.addSignature(doc);
        doc.save(`Laporan_Aset_${dayjs().format('YYYYMMDD')}.pdf`);
    },

    // 2. Laporan Pekerjaan (WO)
    woPDF: () => {
        const doc = new jspdf.jsPDF('l', 'mm', 'a4'); // Landscape agar muat banyak
        const s = document.getElementById('report-start').value;
        const e = document.getElementById('report-end').value;
        
        // Filter WO berdasarkan tanggal
        const data = state.db.work_orders.filter(w => {
            const d = dayjs(w.created_at);
            return d.isAfter(dayjs(s).subtract(1, 'day')) && d.isBefore(dayjs(e).add(1, 'day'));
        });

        report.addHeader(doc, "Laporan Pekerjaan & Maintenance", `Periode: ${dayjs(s).format('DD/MM/YY')} s.d ${dayjs(e).format('DD/MM/YY')}`);

        const tableData = data.map((w, i) => {
            const asset = state.db.assets.find(a => a.id === w.asset_id) || {};
            return [
                i + 1,
                dayjs(w.created_at).format('DD/MM/YY'),
                w.no,
                `${state.getLocationName(asset.location_id)}\n${asset.brand}`,
                w.title,
                w.status,
                w.tech_notes || '-'
            ];
        });

        doc.autoTable({
            startY: 60,
            head: [['No', 'Tanggal', 'No Tiket', 'Lokasi/Aset', 'Pekerjaan', 'Status', 'Catatan']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [52, 73, 94] },
            styles: { fontSize: 8, cellPadding: 2 }
        });

        report.addSignature(doc);
        doc.save(`Laporan_WO_${dayjs().format('YYYYMMDD')}.pdf`);
    },
    
    // 3. Laporan Keuangan
    financePDF: () => {
        const doc = new jspdf.jsPDF();
        report.addHeader(doc, "Laporan Pengeluaran", `YTD Tahun ${dayjs().format('YYYY')}`);
        
        const tableData = state.db.finances.map((f, i) => [
            i + 1,
            dayjs(f.date).format('DD/MM/YYYY'),
            f.item,
            ut.fmtRp(f.cost)
        ]);
        
        // Hitung Total
        const total = state.db.finances.reduce((acc, c) => acc + (c.cost||0), 0);
        tableData.push(['', '', 'TOTAL', ut.fmtRp(total)]);

        doc.autoTable({
            startY: 60,
            head: [['No', 'Tanggal', 'Item Belanja', 'Biaya']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [39, 174, 96] },
        });

        report.addSignature(doc);
        doc.save(`Laporan_Keuangan_${dayjs().format('YYYYMMDD')}.pdf`);
    }
};
