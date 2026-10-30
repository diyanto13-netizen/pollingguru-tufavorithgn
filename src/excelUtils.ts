/**
 * Excel Utility Functions (SheetJS / XLSX)
 * SMKS PGRI 1 Kota Sukabumi - Hari Guru Nasional 2026
 * Pembuatan Template Excel Siap Cetak & Pembacaan File Excel (.xlsx/.xls)
 */

import * as XLSX from 'xlsx';
import { MasterStudent } from './defaultMasterData';

export interface ParseExcelResult {
  students?: MasterStudent[];
  teachers?: string[];
  staff?: string[];
}

/**
 * Buat dan unduh file template Excel (.xlsx) yang rapi, berformat tabel resmi sekolah,
 * dan siap dicetak / disunting panitia sekolah.
 */
export function downloadExcelTemplate(type: 'siswa' | 'guru' | 'tu') {
  const wb = XLSX.utils.book_new();

  if (type === 'siswa') {
    const data = [
      ['SMKS PGRI 1 KOTA SUKABUMI'],
      ['PANITIA HARI GURU NASIONAL (HGN) 2026'],
      ['FORMAT RESMI MASTER DATA SISWA (SIAP CETAK & UPLOAD)'],
      ['Tahun Pelajaran 2025/2026 • Sistem Polling Guru & Staf TU Favorit'],
      [],
      ['PETUNJUK PENGISIAN:'],
      ['1. Isi kolom KELAS & ROMBEL sesuai 21 rombel resmi (X TKJ 1, XI AKL, XII PM 2, dll).'],
      ['2. Isi kolom NAMA LENGKAP SISWA sesuai nama resmi di buku induk/rapor.'],
      ['3. Simpan file ini dan langsung upload di Panel Admin Polling HGN 2026.'],
      [],
      ['NO', 'KELAS & ROMBEL', 'NAMA LENGKAP SISWA', 'JENIS KELAMIN (L/P)', 'KETERANGAN'],
      // Contoh baris awal per rombel
      [1, 'X TKJ 1', 'Aditya Pratama', 'L', 'Siswa Aktif'],
      [2, 'X TKJ 1', 'Anisa Rahmawati', 'P', 'Siswa Aktif'],
      [3, 'X TKJ 2', 'Arya Putra Pratama', 'L', 'Siswa Aktif'],
      [4, 'XI TKJ 1', 'Alif Kurniawan', 'L', 'Siswa Aktif'],
      [5, 'XII TKJ 1', 'Achmad Fauzan', 'L', 'Siswa Aktif'],
      [6, 'X AKL', 'Amanda Zahra', 'P', 'Siswa Aktif'],
      [7, 'XI AKL', 'Agnes Monica', 'P', 'Siswa Aktif'],
      [8, 'XII AKL', 'Aulia Rahma', 'P', 'Siswa Aktif'],
      [9, 'X MPLB 1', 'Aldi Taher', 'L', 'Siswa Aktif'],
      [10, 'XI MPLB 1', 'Aisyah Putri', 'P', 'Siswa Aktif'],
      [11, 'XII MPLB 1', 'Citra Kirana', 'P', 'Siswa Aktif'],
      [12, 'X PM 1', 'Aditya Zoni', 'L', 'Siswa Aktif'],
      [13, 'XI PM 1', 'Aliando Syarief', 'L', 'Siswa Aktif'],
      [14, 'XII PM 1', 'Ahmad Dhani', 'L', 'Siswa Aktif'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Lebar kolom agar rapi saat dibuka di Microsoft Excel
    ws['!cols'] = [
      { wch: 6 },  // NO
      { wch: 20 }, // KELAS & ROMBEL
      { wch: 36 }, // NAMA LENGKAP SISWA
      { wch: 22 }, // JENIS KELAMIN
      { wch: 20 }  // KETERANGAN
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa 21 Rombel');
    XLSX.writeFile(wb, 'Format_Master_Data_Siswa_SMKS_PGRI_1_Sukabumi.xlsx');

  } else if (type === 'guru') {
    const data = [
      ['SMKS PGRI 1 KOTA SUKABUMI'],
      ['PANITIA HARI GURU NASIONAL (HGN) 2026'],
      ['FORMAT RESMI MASTER DATA DEWAN GURU (SIAP CETAK & UPLOAD)'],
      ['Tahun Pelajaran 2025/2026 • Pemilihan Guru Favorit Siswa'],
      [],
      ['PETUNJUK PENGISIAN:'],
      ['1. Isi nama lengkap guru beserta gelar akademiknya.'],
      ['2. Isi mata pelajaran atau program keahlian yang diampu guru.'],
      ['3. File siap dicetak atau diunggah langsung ke Panel Admin Polling.'],
      [],
      ['NO', 'NAMA LENGKAP GURU BESERTA GELAR', 'MATA PELAJARAN / JABATAN', 'KETERANGAN'],
      [1, 'Drs. H. Mulyadi, M.Pd.', 'Kepala Sekolah', 'Guru Pembina'],
      [2, 'Siti Nurjanah, S.Kom.', 'Kejuruan TKJ / Jaringan', 'Guru Produktif'],
      [3, 'Budi Santoso, S.Kom., M.T.', 'Komputer & Jaringan Dasar', 'Guru Produktif'],
      [4, 'Asep Gunawan, S.Pd.', 'Matematika', 'Guru Umum'],
      [5, 'Dewi Kartika, S.E., Ak.', 'Akuntansi Lembaga / AKL', 'Guru Produktif'],
      [6, 'Rina Marlina, M.Pd.', 'Bahasa Indonesia', 'Guru Umum'],
      [7, 'Dra. Eni Rohaeni', 'Manajemen Perkantoran / MPLB', 'Guru Produktif'],
      [8, 'Rahmat Hidayat, S.E., M.M.', 'Bisnis Daring & Pemasaran / PM', 'Guru Produktif'],
      [9, 'Hendra Wijaya, S.Pd.', 'Pendidikan Jasmani (PJOK)', 'Guru Umum'],
      [10, 'Nurul Fadilah, S.Pd.I.', 'Pendidikan Agama Islam', 'Guru Umum'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 6 },  // NO
      { wch: 38 }, // NAMA GURU
      { wch: 32 }, // MAPEL / JABATAN
      { wch: 20 }  // KETERANGAN
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Dewan Guru');
    XLSX.writeFile(wb, 'Format_Master_Data_Guru_SMKS_PGRI_1_Sukabumi.xlsx');

  } else if (type === 'tu') {
    const data = [
      ['SMKS PGRI 1 KOTA SUKABUMI'],
      ['PANITIA HARI GURU NASIONAL (HGN) 2026'],
      ['FORMAT RESMI MASTER DATA STAF TATA USAHA (SIAP CETAK & UPLOAD)'],
      ['Tahun Pelajaran 2025/2026 • Pemilihan Staf TU Favorit Siswa'],
      [],
      ['PETUNJUK PENGISIAN:'],
      ['1. Isi nama staf tata usaha yang bertugas melayani siswa di sekolah.'],
      ['2. Isi bagian atau tugas pelayanan administrasi masing-masing staf.'],
      ['3. File siap dicetak atau diunggah langsung ke Panel Admin Polling.'],
      [],
      ['NO', 'NAMA LENGKAP STAF TATA USAHA', 'BAGIAN / UNIT PELAYANAN', 'KETERANGAN'],
      [1, 'Pak Hendra Permana', 'Kepala Tata Usaha', 'Pelayanan Pimpinan & Umum'],
      [2, 'Ibu Yanti Maryati', 'Administrasi Siswa, Rapor & Dapodik', 'Pelayanan Kesiswaan'],
      [3, 'Pak Dedi Mulyadi', 'Administrasi Keuangan & SPP', 'Pelayanan Keuangan'],
      [4, 'Ibu Nina Herlina', 'Persuratan & Pelayanan Legalisir', 'Pelayanan Surat Menyurat'],
      [5, 'Pak Rahmat Hidayat', 'Sarana & Prasarana Sekolah', 'Pelayanan Fasilitas'],
      [6, 'Ibu Siti Rohmah', 'Administrasi Kurikulum & Kesiswaan', 'Pelayanan Akademik'],
      [7, 'Pak Cecep Suhendar', 'Layanan Umum & Operator Sekolah', 'Pelayanan Umum'],
      [8, 'Ibu Ai Nurhasanah', 'Perpustakaan & Kearsipan Sekolah', 'Pelayanan Literasi'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 6 },  // NO
      { wch: 32 }, // NAMA STAF
      { wch: 38 }, // BAGIAN / PELAYANAN
      { wch: 24 }  // KETERANGAN
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Staf Tata Usaha');
    XLSX.writeFile(wb, 'Format_Master_Data_Staf_TU_SMKS_PGRI_1_Sukabumi.xlsx');
  }
}

/**
 * Membaca dan memproses File Excel (.xlsx / .xls) yang diunggah pengguna.
 */
export async function parseExcelFile(
  file: File, 
  type: 'siswa' | 'guru' | 'tu',
  fallbackClass: string = 'X TKJ 1'
): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  
  if (wb.SheetNames.length === 0) {
    throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
  }

  const sheetName = wb.SheetNames[0];
  const worksheet = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  if (type === 'siswa') {
    const students: MasterStudent[] = [];
    let headerRowIndex = -1;
    let colClass = -1;
    let colName = -1;

    // Cari baris header tabel (yang mengandung 'kelas' atau 'nama')
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('nama') || rowStr.includes('kelas') || rowStr.includes('rombel')) {
        headerRowIndex = i;
        row.forEach((colVal, cIdx) => {
          const str = String(colVal || '').toLowerCase().trim();
          if (str.includes('kelas') || str.includes('rombel')) {
            colClass = cIdx;
          }
          if (str.includes('nama')) {
            colName = cIdx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      let studentClass = '';
      let studentName = '';

      if (colClass >= 0 && colName >= 0) {
        studentClass = String(row[colClass] || '').trim();
        studentName = String(row[colName] || '').trim();
      } else {
        // Otomatis identifikasi kolom jika tidak ada header jelas
        const nonEmpties = row.map(c => String(c || '').trim()).filter(Boolean);
        if (nonEmpties.length >= 2) {
          // Cari elemen yang mirip kelas (misal: X TKJ 1, XI AKL, XII PM 2)
          const classCandidate = nonEmpties.find(val => /^(X|XI|XII)\b/i.test(val) || /TKJ|AKL|MPLB|PM/i.test(val));
          if (classCandidate) {
            studentClass = classCandidate;
            studentName = nonEmpties.find(val => val !== classCandidate && isNaN(Number(val))) || '';
          } else {
            studentClass = nonEmpties[0];
            studentName = nonEmpties[1];
          }
        } else if (nonEmpties.length === 1 && isNaN(Number(nonEmpties[0]))) {
          studentClass = fallbackClass;
          studentName = nonEmpties[0];
        }
      }

      // Bersihkan dan validasi
      studentName = studentName.replace(/^["']|["']$/g, '').trim();
      studentClass = studentClass.replace(/^["']|["']$/g, '').trim().toUpperCase();

      // Abaikan baris nomor atau header yang terulang
      if (
        studentName && 
        studentName.length >= 2 && 
        !studentName.toLowerCase().includes('nama lengkap') &&
        !studentName.toLowerCase().includes('petunjuk')
      ) {
        students.push({
          id: `excel-s-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          nama: studentName,
          kelas: studentClass || fallbackClass
        });
      }
    }

    return { students };

  } else if (type === 'guru') {
    const teachers: string[] = [];
    let headerRowIndex = -1;
    let colName = -1;

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('nama') || rowStr.includes('guru')) {
        headerRowIndex = i;
        row.forEach((colVal, cIdx) => {
          const str = String(colVal || '').toLowerCase().trim();
          if (str.includes('nama') || str.includes('guru')) {
            colName = cIdx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      let name = '';
      if (colName >= 0 && row[colName]) {
        name = String(row[colName] || '').trim();
      } else {
        const nonEmpties = row.map(c => String(c || '').trim()).filter(Boolean);
        // Pilih teks pertama yang bukan angka
        name = nonEmpties.find(val => isNaN(Number(val))) || '';
      }

      name = name.replace(/^["']|["']$/g, '').trim();
      if (
        name && 
        name.length >= 2 && 
        !name.toLowerCase().includes('nama lengkap') &&
        !name.toLowerCase().includes('petunjuk')
      ) {
        teachers.push(name);
      }
    }

    return { teachers };

  } else {
    // Staf TU
    const staff: string[] = [];
    let headerRowIndex = -1;
    let colName = -1;

    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      const row = rawRows[i];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
      if (rowStr.includes('nama') || rowStr.includes('staf') || rowStr.includes('tata usaha')) {
        headerRowIndex = i;
        row.forEach((colVal, cIdx) => {
          const str = String(colVal || '').toLowerCase().trim();
          if (str.includes('nama') || str.includes('staf')) {
            colName = cIdx;
          }
        });
        break;
      }
    }

    const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      let name = '';
      if (colName >= 0 && row[colName]) {
        name = String(row[colName] || '').trim();
      } else {
        const nonEmpties = row.map(c => String(c || '').trim()).filter(Boolean);
        name = nonEmpties.find(val => isNaN(Number(val))) || '';
      }

      name = name.replace(/^["']|["']$/g, '').trim();
      if (
        name && 
        name.length >= 2 && 
        !name.toLowerCase().includes('nama lengkap') &&
        !name.toLowerCase().includes('petunjuk')
      ) {
        staff.push(name);
      }
    }

    return { staff };
  }
}

/**
 * Ekspor seluruh rekap hasil suara ke file Excel (.xlsx) resmi dan rapi siap cetak.
 */
export function exportRekapToExcel(
  votes: any[],
  top5Guru: any[],
  top5TU: any[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet Suara Masuk
  const votesData = [
    ['SMKS PGRI 1 KOTA SUKABUMI'],
    ['LAPORAN HASIL REKAPITULASI POLLING HARI GURU NASIONAL 2026'],
    [`Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • Total Suara: ${votes.length}`],
    [],
    ['NO', 'WAKTU MASUK', 'NAMA SISWA', 'KELAS / ROMBEL', 'GURU FAVORIT TERPILIH', 'SKOR GURU', 'STAF TU FAVORIT TERPILIH', 'SKOR TU']
  ];

  votes.forEach((v, idx) => {
    votesData.push([
      idx + 1,
      v.createdAt ? new Date(v.createdAt).toLocaleString('id-ID') : '-',
      v.namaSiswa,
      v.kelas,
      v.namaGuru,
      v.rataRataGuru,
      v.namaTU,
      v.rataRataTU
    ]);
  });

  const wsVotes = XLSX.utils.aoa_to_sheet(votesData);
  wsVotes['!cols'] = [
    { wch: 6 },  // NO
    { wch: 22 }, // WAKTU
    { wch: 28 }, // NAMA SISWA
    { wch: 18 }, // KELAS
    { wch: 32 }, // GURU
    { wch: 12 }, // SKOR GURU
    { wch: 32 }, // TU
    { wch: 12 }  // SKOR TU
  ];
  XLSX.utils.book_append_sheet(wb, wsVotes, 'Rekap Semua Suara Masuk');

  // 2. Sheet 5 Besar Teratas (Podium)
  const podiumData = [
    ['SMKS PGRI 1 KOTA SUKABUMI'],
    ['HASIL PERINGKAT 5 BESAR GURU & STAF TU FAVORIT HGN 2026'],
    [],
    ['=== 5 BESAR GURU FAVORIT ==='],
    ['PERINGKAT', 'NAMA GURU', 'TOTAL PEROLEHAN SUARA', 'RATA-RATA RATING (BINTANG)'],
    ...top5Guru.map((g, idx) => [`Juara ${idx + 1}`, g.nama, `${g.totalSuara} Suara`, `★ ${g.rataRataSkor} / 5.0`]),
    [],
    ['=== 5 BESAR STAF TATA USAHA FAVORIT ==='],
    ['PERINGKAT', 'NAMA STAF TU', 'TOTAL PEROLEHAN SUARA', 'RATA-RATA RATING (BINTANG)'],
    ...top5TU.map((t, idx) => [`Juara ${idx + 1}`, t.nama, `${t.totalSuara} Suara`, `★ ${t.rataRataSkor} / 5.0`])
  ];

  const wsPodium = XLSX.utils.aoa_to_sheet(podiumData);
  wsPodium['!cols'] = [
    { wch: 16 }, // PERINGKAT
    { wch: 38 }, // NAMA
    { wch: 24 }, // TOTAL SUARA
    { wch: 28 }  // RATING
  ];
  XLSX.utils.book_append_sheet(wb, wsPodium, 'Peringkat 5 Besar');

  const filename = `Rekap_Resmi_Polling_HGN2026_SMKS_PGRI1_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
