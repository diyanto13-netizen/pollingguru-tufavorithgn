/**
 * Master Data Definitions
 * SMKS PGRI 1 Kota Sukabumi - Hari Guru Nasional 2026
 * Catatan: Data awal dikosongkan secara default sesuai permintaan.
 * Seluruh data diisi melalui menu upload / tambah di Panel Admin.
 */

export interface MasterStudent {
  id: string;
  nama: string;
  kelas: string;
}

// Data sample dikosongkan agar database dan antarmuka bersih
export const DEFAULT_STUDENTS: MasterStudent[] = [];
export const DEFAULT_TEACHERS: string[] = [];
export const DEFAULT_STAFF: string[] = [];
