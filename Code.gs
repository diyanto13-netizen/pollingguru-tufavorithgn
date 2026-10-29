/**
 * ==============================================================================
 * APLIKASI POLLING GURU & STAF TU FAVORIT - HARI GURU NASIONAL 2026
 * SMKS PGRI 1 KOTA SUKABUMI
 * Backend: Google Apps Script (GAS) & Cloud Google Sheets Database
 * 
 * FITUR UTAMA:
 * 1. Penyimpanan langsung ke Cloud Database (Google Sheets).
 * 2. Validasi Anti-Duplikasi: Setiap siswa hanya dapat memilih 1 kali (berdasarkan Nama & Kelas).
 * 3. Kalkulasi Otomatis 5 Besar (Top 5) dengan suara terbanyak untuk Guru & Staf TU.
 * 4. Endpoint GET & POST untuk sinkronisasi real-time dengan frontend.
 * ==============================================================================
 */

const SHEET_NAME = 'Data Polling HGN 2026';

/**
 * Endpoint POST: Menerima data polling baru, memvalidasi duplikasi siswa,
 * menyimpan ke database cloud, dan mengembalikan hasil 5 Besar (Top 5).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Tunggu hingga 15 detik agar antrean siswa saat traffic padat tidak crash
  lock.tryLock(15000);

  try {
    let data;
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      throw new Error('Payload data JSON tidak ditemukan');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Buat sheet baru jika belum tersedia
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Inisialisasi Header Tabel jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      initSheetHeaders(sheet);
    }

    const inputNama = (data.namaSiswa || '').toString().trim();
    const inputKelas = (data.kelas || '').toString().trim();

    if (!inputNama || !inputKelas) {
      return buildJsonResponse({
        status: 'error',
        message: 'Nama Siswa dan Kelas wajib diisi!'
      });
    }

    // ---------------------------------------------------------
    // VALIDASI ANTI-DUPLIKASI (Siswa hanya boleh polling 1 kali)
    // ---------------------------------------------------------
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Ambil kolom B (Nama Siswa) dan C (Kelas) untuk seluruh baris data
      const existingData = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
      const normInputNama = inputNama.toLowerCase().replace(/\s+/g, ' ');
      const normInputKelas = inputKelas.toLowerCase().replace(/\s+/g, ' ');

      for (let i = 0; i < existingData.length; i++) {
        const rowNama = existingData[i][0].toString().trim().toLowerCase().replace(/\s+/g, ' ');
        const rowKelas = existingData[i][1].toString().trim().toLowerCase().replace(/\s+/g, ' ');

        if (rowNama === normInputNama && rowKelas === normInputKelas) {
          // Siswa sudah pernah memilih sebelumnya!
          return buildJsonResponse({
            status: 'duplicate',
            message: 'Maaf, siswa dengan nama "' + inputNama + '" dari kelas "' + inputKelas + '" sudah pernah menggunakan hak suara. Polling hanya diperbolehkan 1 kali!',
            alreadyVoted: true
          });
        }
      }
    }

    // ---------------------------------------------------------
    // SIMPAN REKAMAN BARU KE CLOUD SPREADSHEET
    // ---------------------------------------------------------
    const formattedDate = Utilities.formatDate(
      new Date(),
      'Asia/Jakarta',
      'yyyy-MM-dd HH:mm:ss'
    );

    const skorG = data.skorGuru || {};
    const skorT = data.skorTU || {};
    const avgGuruNum = parseFloat(data.rataRataGuru) || 0;
    const avgTUNum = parseFloat(data.rataRataTU) || 0;

    const rowData = [
      formattedDate,
      inputNama,
      inputKelas,
      (data.namaGuru || '-').toString().trim(),
      skorG.keramahan || 0,
      skorG.profesionalisme || 0,
      skorG.empati || 0,
      skorG.keteladanan || 0,
      skorG.inspirasi || 0,
      avgGuruNum,
      (data.namaTU || '-').toString().trim(),
      skorT.keramahan || 0,
      skorT.kecepatan || 0,
      skorT.bantuan || 0,
      skorT.kedisiplinan || 0,
      skorT.auraPositif || 0,
      avgTUNum
    ];

    sheet.appendRow(rowData);

    // Hitung ulang 5 Besar (Top 5) terkini setelah penyimpanan
    const topResults = calculateTop5(sheet);

    return buildJsonResponse({
      status: 'success',
      message: 'Terima kasih! Suara Anda berhasil disimpan ke Cloud Database SMKS PGRI 1 Kota Sukabumi.',
      receivedAt: formattedDate,
      top5Guru: topResults.top5Guru,
      top5TU: topResults.top5TU,
      totalResponden: topResults.totalResponden
    });

  } catch (err) {
    return buildJsonResponse({
      status: 'error',
      message: 'Gagal memproses data: ' + err.toString()
    });

  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint GET: Digunakan oleh frontend untuk mengambil daftar 5 Besar (Top 5)
 * dan mengecek status live polling secara real-time.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet || sheet.getLastRow() <= 1) {
      return buildJsonResponse({
        status: 'success',
        totalResponden: 0,
        top5Guru: [],
        top5TU: [],
        message: 'Belum ada data masuk.'
      });
    }

    const topResults = calculateTop5(sheet);

    return buildJsonResponse({
      status: 'success',
      totalResponden: topResults.totalResponden,
      top5Guru: topResults.top5Guru,
      top5TU: topResults.top5TU,
      lastUpdated: Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss')
    });

  } catch (err) {
    return buildJsonResponse({
      status: 'error',
      message: err.toString()
    });
  }
}

/**
 * Fungsi kalkulasi untuk mengelompokkan dan mengambil 5 Besar (Top 5)
 * berdasarkan jumlah polling suara terbanyak (dan rata-rata skor sebagai tie-breaker).
 */
function calculateTop5(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { top5Guru: [], top5TU: [], totalResponden: 0 };
  }

  // Kolom D = Nama Guru (idx 3), Kolom J = Rata-rata Skor Guru (idx 9)
  // Kolom K = Nama TU (idx 10), Kolom Q = Rata-rata Skor TU (idx 16)
  const rows = sheet.getRange(2, 1, lastRow - 1, 17).getValues();

  const guruMap = {};
  const tuMap = {};

  rows.forEach(function(row) {
    const rawGuru = row[3] ? row[3].toString().trim() : '';
    const skorG = parseFloat(row[9]) || 0;

    const rawTU = row[10] ? row[10].toString().trim() : '';
    const skorT = parseFloat(row[16]) || 0;

    // Agregasi Guru
    if (rawGuru && rawGuru !== '-') {
      // Normalisasi kunci pencarian agar variasi huruf besar/kecil tergabung rapi
      const keyG = rawGuru.toLowerCase();
      if (!guruMap[keyG]) {
        guruMap[keyG] = {
          nama: rawGuru,
          totalSuara: 0,
          totalSkor: 0
        };
      }
      guruMap[keyG].totalSuara += 1;
      guruMap[keyG].totalSkor += skorG;
    }

    // Agregasi Staf TU
    if (rawTU && rawTU !== '-') {
      const keyT = rawTU.toLowerCase();
      if (!tuMap[keyT]) {
        tuMap[keyT] = {
          nama: rawTU,
          totalSuara: 0,
          totalSkor: 0
        };
      }
      tuMap[keyT].totalSuara += 1;
      tuMap[keyT].totalSkor += skorT;
    }
  });

  // Konversi ke Array dan sortir descending berdasarkan totalSuara, lalu rata-rata nilai
  const listGuru = Object.keys(guruMap).map(function(k) {
    const item = guruMap[k];
    const avg = item.totalSuara > 0 ? (item.totalSkor / item.totalSuara).toFixed(1) : '0.0';
    return {
      nama: item.nama,
      totalSuara: item.totalSuara,
      rataRataSkor: parseFloat(avg)
    };
  });

  listGuru.sort(function(a, b) {
    if (b.totalSuara !== a.totalSuara) {
      return b.totalSuara - a.totalSuara; // Urut suara tertinggi
    }
    return b.rataRataSkor - a.rataRataSkor;
  });

  const listTU = Object.keys(tuMap).map(function(k) {
    const item = tuMap[k];
    const avg = item.totalSuara > 0 ? (item.totalSkor / item.totalSuara).toFixed(1) : '0.0';
    return {
      nama: item.nama,
      totalSuara: item.totalSuara,
      rataRataSkor: parseFloat(avg)
    };
  });

  listTU.sort(function(a, b) {
    if (b.totalSuara !== a.totalSuara) {
      return b.totalSuara - a.totalSuara;
    }
    return b.rataRataSkor - a.rataRataSkor;
  });

  // Ambil hanya 5 Besar (Top 5)
  return {
    top5Guru: listGuru.slice(0, 5),
    top5TU: listTU.slice(0, 5),
    totalResponden: rows.length
  };
}

/**
 * Format Header Tabel Spreadsheet
 */
function initSheetHeaders(sheet) {
  const headers = [
    'Timestamp',
    'Nama Siswa',
    'Kelas & Jurusan',
    'Nama Guru Favorit',
    'Keramahan (Guru)',
    'Profesionalisme (Guru)',
    'Empati (Guru)',
    'Keteladanan (Guru)',
    'Inspirasi (Guru)',
    'Rata-rata Skor Guru',
    'Nama Staf TU Favorit',
    'Keramahan (TU)',
    'Kecepatan Kerja (TU)',
    'Bantuan (TU)',
    'Kedisiplinan (TU)',
    'Aura Positif (TU)',
    'Rata-rata Skor TU'
  ];

  sheet.appendRow(headers);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4f46e5'); // Indigo 600
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

/**
 * Helper untuk response JSON dengan header text output
 */
function buildJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
