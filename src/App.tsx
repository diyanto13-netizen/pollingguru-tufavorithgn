/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Award, 
  School, 
  User, 
  GraduationCap, 
  ArrowRight, 
  ArrowLeft, 
  Star, 
  Check, 
  Sparkles, 
  Trophy, 
  Flame, 
  AlertTriangle, 
  Lock, 
  Database, 
  ShieldCheck, 
  LogOut, 
  LogIn, 
  UserCheck, 
  UserPlus, 
  RefreshCw, 
  Download, 
  ChevronRight, 
  HeartHandshake, 
  Send,
  Upload,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  FolderUp,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { 
  DEFAULT_STUDENTS, 
  DEFAULT_TEACHERS, 
  DEFAULT_STAFF, 
  MasterStudent 
} from './defaultMasterData';
import {
  downloadExcelTemplate,
  parseExcelFile,
  exportRekapToExcel
} from './excelUtils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type GuruKey = 'keramahan' | 'profesionalisme' | 'empati' | 'keteladanan' | 'inspirasi';
type TUKey = 'keramahan' | 'kecepatan' | 'bantuan' | 'kedisiplinan' | 'auraPositif';

interface GuruScores {
  keramahan: number;
  profesionalisme: number;
  empati: number;
  keteladanan: number;
  inspirasi: number;
}

interface TUScores {
  keramahan: number;
  kecepatan: number;
  bantuan: number;
  kedisiplinan: number;
  auraPositif: number;
}

interface FirebaseVoteDocument {
  id?: string;
  namaSiswa: string;
  kelas: string;
  namaGuru: string;
  skorGuru: GuruScores;
  rataRataGuru: number;
  namaTU: string;
  skorTU: TUScores;
  rataRataTU: number;
  createdAt: string;
}

interface TopRankItem {
  nama: string;
  totalSuara: number;
  rataRataSkor: number;
}

const CRITERIA_GURU: { key: GuruKey; label: string; desc: string }[] = [
  { key: 'keramahan', label: '1. Keramahan', desc: 'Ramah, menyambut siswa dengan hangat, dan menciptakan suasana belajar yang nyaman.' },
  { key: 'profesionalisme', label: '2. Profesionalisme', desc: 'Menguasai materi pelajaran, disiplin waktu, dan adil dalam mendidik semua siswa.' },
  { key: 'empati', label: '3. Empati', desc: 'Memahami kendala siswa, mendengarkan saran, dan sabar membimbing saat kesulitan.' },
  { key: 'keteladanan', label: '4. Keteladanan', desc: 'Menjadi teladan dalam akhlak, integritas, tutur kata, dan perilaku sehari-hari.' },
  { key: 'inspirasi', label: '5. Inspirasi', desc: 'Mampu memotivasi siswa untuk berprestasi dan terus percaya pada masa depan.' },
];

const CRITERIA_TU: { key: TUKey; label: string; desc: string }[] = [
  { key: 'keramahan', label: '1. Keramahan', desc: 'Ramah, santun, dan tersenyum saat melayani siswa dan tamu sekolah.' },
  { key: 'kecepatan', label: '2. Kecepatan Kerja', desc: 'Cekatan, sigap, dan tidak berbelit-belit dalam mengurus keperluan administrasi.' },
  { key: 'bantuan', label: '3. Bantuan', desc: 'Suka menolong, memberi panduan jelas, dan solutif bila siswa menghadapi masalah berkas.' },
  { key: 'kedisiplinan', label: '4. Kedisiplinan', desc: 'Tepat waktu di ruang tata usaha, menjaga ketertiban, dan teliti dalam bekerja.' },
  { key: 'auraPositif', label: '5. Aura Positif', desc: 'Membawa suasana ceria, tidak mudah emosi, dan membuat ruang TU terasa bersahabat.' },
];

const RATING_DESCRIPTIONS = [
  '',
  '1 - Perlu Peningkatan',
  '2 - Cukup Baik',
  '3 - Baik',
  '4 - Sangat Baik',
  '5 - Luar Biasa (Sempurna)'
];

export const STRUKTUR_ROMBEL_SMK = [
  {
    kode: 'TKJ',
    nama: 'TKJ (Teknik Komputer & Jaringan)',
    rombel: [
      { tingkat: 'Kelas X', list: ['X TKJ 1', 'X TKJ 2'] },
      { tingkat: 'Kelas XI', list: ['XI TKJ 1', 'XI TKJ 2'] },
      { tingkat: 'Kelas XII', list: ['XII TKJ 1', 'XII TKJ 2'] }
    ]
  },
  {
    kode: 'AKL',
    nama: 'AKL (Akuntansi)',
    rombel: [
      { tingkat: 'Kelas X', list: ['X AKL'] },
      { tingkat: 'Kelas XI', list: ['XI AKL'] },
      { tingkat: 'Kelas XII', list: ['XII AKL'] }
    ]
  },
  {
    kode: 'MPLB',
    nama: 'MPLB (Manajemen Perkantoran)',
    rombel: [
      { tingkat: 'Kelas X', list: ['X MPLB 1', 'X MPLB 2'] },
      { tingkat: 'Kelas XI', list: ['XI MPLB 1', 'XI MPLB 2'] },
      { tingkat: 'Kelas XII', list: ['XII MPLB 1', 'XII MPLB 2'] }
    ]
  },
  {
    kode: 'PM',
    nama: 'PM (Bisnis Daring/Pemasaran)',
    rombel: [
      { tingkat: 'Kelas X', list: ['X PM 1', 'X PM 2'] },
      { tingkat: 'Kelas XI', list: ['XI PM 1', 'XI PM 2'] },
      { tingkat: 'Kelas XII', list: ['XII PM 1', 'XII PM 2'] }
    ]
  }
];

export const ALL_ROMBEL_LIST: string[] = [
  'X TKJ 1', 'X TKJ 2', 'XI TKJ 1', 'XI TKJ 2', 'XII TKJ 1', 'XII TKJ 2',
  'X AKL', 'XI AKL', 'XII AKL',
  'X MPLB 1', 'X MPLB 2', 'XI MPLB 1', 'XI MPLB 2', 'XII MPLB 1', 'XII MPLB 2',
  'X PM 1', 'X PM 2', 'XI PM 1', 'XI PM 2', 'XII PM 1', 'XII PM 2'
];

const DEFAULT_ADMIN_PIN = 'admin2026';

export default function App() {
  // Navigation: 'dashboard' (hanya polling) vs 'admin' (5 besar, data masuk, upload master)
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin'>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<'top5' | 'dataMasuk' | 'uploadMaster'>('top5');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  // Polling Form State
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  // Real-time Firestore votes collection listener
  const [firestoreVotes, setFirestoreVotes] = useState<FirebaseVoteDocument[]>([]);
  
  // Single-vote protection state
  const [hasVotedToken, setHasVotedToken] = useState<{ nama: string; kelas: string; time: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [leaderboardCategory, setLeaderboardCategory] = useState<'guru' | 'tu'>('guru');
  const [jurusanFilter, setJurusanFilter] = useState<'SEMUA' | 'TKJ' | 'AKL' | 'MPLB' | 'PM'>('SEMUA');

  // Master Data State (Students per class, Teachers, TU Staff)
  const [masterStudents, setMasterStudents] = useState<MasterStudent[]>(DEFAULT_STUDENTS);
  const [masterTeachers, setMasterTeachers] = useState<string[]>(DEFAULT_TEACHERS);
  const [masterStaff, setMasterStaff] = useState<string[]>(DEFAULT_STAFF);
  const [masterUpdatedAt, setMasterUpdatedAt] = useState<string | null>(null);
  const [isSavingMaster, setIsSavingMaster] = useState<boolean>(false);
  const [masterSuccessMsg, setMasterSuccessMsg] = useState<string | null>(null);

  // Input fields for Polling
  const [kelas, setKelas] = useState<string>('');
  const [namaSiswa, setNamaSiswa] = useState<string>('');
  const [isManualStudent, setIsManualStudent] = useState<boolean>(false);

  const [namaGuru, setNamaGuru] = useState<string>('');
  const [isManualGuru, setIsManualGuru] = useState<boolean>(false);
  const [skorGuru, setSkorGuru] = useState<GuruScores>({
    keramahan: 0,
    profesionalisme: 0,
    empati: 0,
    keteladanan: 0,
    inspirasi: 0,
  });

  const [namaTU, setNamaTU] = useState<string>('');
  const [isManualTU, setIsManualTU] = useState<boolean>(false);
  const [skorTU, setSkorTU] = useState<TUScores>({
    keramahan: 0,
    kecepatan: 0,
    bantuan: 0,
    kedisiplinan: 0,
    auraPositif: 0,
  });

  const [submittedData, setSubmittedData] = useState<{
    namaSiswa: string;
    kelas: string;
    namaGuru: string;
    avgGuru: number;
    namaTU: string;
    avgTU: number;
  } | null>(null);

  // Admin Master Data Management State
  const [uploadCategory, setUploadCategory] = useState<'siswa' | 'guru' | 'tu'>('siswa');
  const [studentFilterClass, setStudentFilterClass] = useState<string>('SEMUA');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [pasteText, setPasteText] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState<boolean>(false);
  
  // Single entry form states
  const [singleStudentNama, setSingleStudentNama] = useState<string>('');
  const [singleStudentKelas, setSingleStudentKelas] = useState<string>('X TKJ 1');
  const [singleTeacherNama, setSingleTeacherNama] = useState<string>('');
  const [singleStaffNama, setSingleStaffNama] = useState<string>('');

  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const teacherFileInputRef = useRef<HTMLInputElement>(null);
  const staffFileInputRef = useRef<HTMLInputElement>(null);

  // Check local single-vote token on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('smks_pgri1_hgn2026_voted');
      if (savedToken) {
        setHasVotedToken(JSON.parse(savedToken));
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  // Listen to Firestore 'votes' collection in real-time
  useEffect(() => {
    const votesPath = 'votes';
    const unsubscribe = onSnapshot(
      collection(db, votesPath),
      (snapshot) => {
        setIsFirebaseConnected(true);
        const docs: FirebaseVoteDocument[] = [];
        snapshot.forEach((docSnap) => {
          docs.push({
            id: docSnap.id,
            ...(docSnap.data() as FirebaseVoteDocument)
          });
        });
        setFirestoreVotes(docs);
      },
      (error) => {
        setIsFirebaseConnected(false);
        handleFirestoreError(error, OperationType.GET, votesPath);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to Firestore 'master_data/lists' document in real-time
  useEffect(() => {
    const masterPath = 'master_data';
    const unsubscribe = onSnapshot(
      doc(db, masterPath, 'lists'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setMasterStudents(Array.isArray(data.students) ? data.students : []);
          setMasterTeachers(Array.isArray(data.teachers) ? data.teachers : []);
          setMasterStaff(Array.isArray(data.staff) ? data.staff : []);
          setMasterUpdatedAt(data.updatedAt || null);
        } else {
          setMasterStudents([]);
          setMasterTeachers([]);
          setMasterStaff([]);
          setMasterUpdatedAt(null);
        }
      },
      (error) => {
        console.warn('Master data snapshot notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute ONLY TOP 5 Guru with highest vote counts
  const top5Guru = useMemo<TopRankItem[]>(() => {
    const map: Record<string, { totalSuara: number; sumScore: number; originalName: string }> = {};

    firestoreVotes.forEach((item) => {
      const raw = (item.namaGuru || '').trim();
      if (!raw || raw === '-') return;
      const key = raw.toLowerCase();
      if (!map[key]) {
        map[key] = { totalSuara: 0, sumScore: 0, originalName: raw };
      }
      map[key].totalSuara += 1;
      map[key].sumScore += item.rataRataGuru || 0;
    });

    const list: TopRankItem[] = Object.values(map).map((v) => ({
      nama: v.originalName,
      totalSuara: v.totalSuara,
      rataRataSkor: parseFloat((v.sumScore / v.totalSuara).toFixed(1))
    }));

    list.sort((a, b) => {
      if (b.totalSuara !== a.totalSuara) return b.totalSuara - a.totalSuara;
      return b.rataRataSkor - a.rataRataSkor;
    });

    return list.slice(0, 5);
  }, [firestoreVotes]);

  // Compute ONLY TOP 5 Staf TU with highest vote counts
  const top5TU = useMemo<TopRankItem[]>(() => {
    const map: Record<string, { totalSuara: number; sumScore: number; originalName: string }> = {};

    firestoreVotes.forEach((item) => {
      const raw = (item.namaTU || '').trim();
      if (!raw || raw === '-') return;
      const key = raw.toLowerCase();
      if (!map[key]) {
        map[key] = { totalSuara: 0, sumScore: 0, originalName: raw };
      }
      map[key].totalSuara += 1;
      map[key].sumScore += item.rataRataTU || 0;
    });

    const list: TopRankItem[] = Object.values(map).map((v) => ({
      nama: v.originalName,
      totalSuara: v.totalSuara,
      rataRataSkor: parseFloat((v.sumScore / v.totalSuara).toFixed(1))
    }));

    list.sort((a, b) => {
      if (b.totalSuara !== a.totalSuara) return b.totalSuara - a.totalSuara;
      return b.rataRataSkor - a.rataRataSkor;
    });

    return list.slice(0, 5);
  }, [firestoreVotes]);

  // Filtered votes by program keahlian for admin view
  const filteredFirestoreVotes = useMemo(() => {
    if (jurusanFilter === 'SEMUA') return firestoreVotes;
    return firestoreVotes.filter((v) => v.kelas.toUpperCase().includes(jurusanFilter));
  }, [firestoreVotes, jurusanFilter]);

  // Students for currently selected class in Step 1
  const studentsInSelectedClass = useMemo(() => {
    if (!kelas) return [];
    return masterStudents
      .filter((s) => s.kelas.trim().toLowerCase() === kelas.trim().toLowerCase())
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [masterStudents, kelas]);

  // Filtered students for Admin preview table
  const adminFilteredStudents = useMemo(() => {
    return masterStudents.filter((s) => {
      const matchClass = studentFilterClass === 'SEMUA' || s.kelas === studentFilterClass;
      const matchSearch = studentSearch === '' || s.nama.toLowerCase().includes(studentSearch.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [masterStudents, studentFilterClass, studentSearch]);

  // Validation
  const isStep1Valid = namaSiswa.trim().length >= 2 && kelas !== '';
  const isStep2Valid = 
    namaGuru.trim().length >= 2 && 
    Object.values(skorGuru).every(score => score > 0);
  const isStep3Valid = 
    namaTU.trim().length >= 2 && 
    Object.values(skorTU).every(score => score > 0);

  const calculateAverage = (scores: GuruScores | TUScores) => {
    const values = Object.values(scores);
    const sum = values.reduce((acc, curr) => acc + curr, 0);
    return parseFloat((sum / values.length).toFixed(1));
  };

  const handleRatingChange = (
    type: 'guru' | 'tu',
    key: string,
    rating: number
  ) => {
    if (type === 'guru') {
      setSkorGuru(prev => ({ ...prev, [key]: rating }));
    } else {
      setSkorTU(prev => ({ ...prev, [key]: rating }));
    }
  };

  const getStudentVoteDocId = (studentClass: string, studentName: string) => {
    const cleanClass = studentClass.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanName = studentName.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    return `${cleanClass}__${cleanName}`;
  };

  // Student Login validation handler
  const handleStudentLogin = async () => {
    if (!isStep1Valid) return;
    const docId = getStudentVoteDocId(kelas, namaSiswa);
    const alreadyExistsInMemory = firestoreVotes.some(v => v.id === docId);
    if (alreadyExistsInMemory) {
      setDuplicateWarning(`Siswa atas nama "${namaSiswa}" di rombel "${kelas}" sudah pernah memberikan suara! Setiap siswa hanya dapat polling 1 kali.`);
      return;
    }
    setDuplicateWarning(null);
    setStep(2);
  };

  // Reset/switch to login as another student
  const handleLoginAsNewStudent = () => {
    localStorage.removeItem('smks_pgri1_hgn2026_voted');
    setHasVotedToken(null);
    setNamaSiswa('');
    setKelas('');
    setIsManualStudent(false);
    setNamaGuru('');
    setIsManualGuru(false);
    setSkorGuru({ keramahan: 0, profesionalisme: 0, empati: 0, keteladanan: 0, inspirasi: 0 });
    setNamaTU('');
    setIsManualTU(false);
    setSkorTU({ keramahan: 0, kecepatan: 0, bantuan: 0, kedisiplinan: 0, auraPositif: 0 });
    setSubmittedData(null);
    setDuplicateWarning(null);
    setStep(1);
  };

  // Submit to Firebase Firestore
  const handleSubmit = async () => {
    if (!isStep3Valid) return;

    const voteDocId = getStudentVoteDocId(kelas, namaSiswa);

    setIsSubmitting(true);
    setDuplicateWarning(null);

    try {
      const docRef = doc(db, 'votes', voteDocId);
      const existingDoc = await getDoc(docRef);

      if (existingDoc.exists()) {
        const msg = `Siswa dengan nama "${namaSiswa}" di rombel "${kelas}" sudah pernah tercatat di Firebase. Setiap siswa hanya diperbolehkan 1 kali polling!`;
        setDuplicateWarning(msg);
        setIsSubmitting(false);
        return;
      }

      const avgGuru = calculateAverage(skorGuru);
      const avgTU = calculateAverage(skorTU);

      const voteData: FirebaseVoteDocument = {
        namaSiswa: namaSiswa.trim(),
        kelas,
        namaGuru: namaGuru.trim(),
        skorGuru: { ...skorGuru },
        rataRataGuru: avgGuru,
        namaTU: namaTU.trim(),
        skorTU: { ...skorTU },
        rataRataTU: avgTU,
        createdAt: new Date().toISOString()
      };

      await setDoc(docRef, voteData);

      const voteToken = {
        nama: namaSiswa.trim(),
        kelas,
        time: new Date().toISOString()
      };
      localStorage.setItem('smks_pgri1_hgn2026_voted', JSON.stringify(voteToken));
      setHasVotedToken(voteToken);

      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.6 }
      });

      setSubmittedData({
        namaSiswa: namaSiswa.trim(),
        kelas,
        namaGuru: namaGuru.trim(),
        avgGuru,
        namaTU: namaTU.trim(),
        avgTU
      });

      setIsSubmitting(false);
      setStep(4);
    } catch (err) {
      setIsSubmitting(false);
      handleFirestoreError(err, OperationType.WRITE, `votes/${voteDocId}`);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput === DEFAULT_ADMIN_PIN || adminPinInput === 'pgri2026') {
      setIsAdminLoggedIn(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError(null);
      setCurrentView('admin');
    } else {
      setAdminPinError('PIN Admin salah! (Default: admin2026)');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setCurrentView('dashboard');
  };

  const handleAdminResetTest = () => {
    if (confirm('Reset status hak suara pada perangkat ini untuk keperluan uji coba?')) {
      localStorage.removeItem('smks_pgri1_hgn2026_voted');
      setHasVotedToken(null);
      setNamaSiswa('');
      setKelas('');
      setIsManualStudent(false);
      setNamaGuru('');
      setIsManualGuru(false);
      setSkorGuru({ keramahan: 0, profesionalisme: 0, empati: 0, keteladanan: 0, inspirasi: 0 });
      setNamaTU('');
      setIsManualTU(false);
      setSkorTU({ keramahan: 0, kecepatan: 0, bantuan: 0, kedisiplinan: 0, auraPositif: 0 });
      setSubmittedData(null);
      setDuplicateWarning(null);
      setStep(1);
      alert('Status pemilih lokal berhasil direset. Silakan kembali ke formulir polling.');
    }
  };

  const handleExportCSV = () => {
    if (firestoreVotes.length === 0) {
      alert('Belum ada data suara masuk untuk diunduh.');
      return;
    }
    const headers = [
      'Waktu Masuk',
      'Nama Siswa',
      'Kelas/Rombel',
      'Guru Pilihan',
      'Rata-rata Guru',
      'Staf TU Pilihan',
      'Rata-rata TU'
    ];
    const rows = filteredFirestoreVotes.map((v) => [
      `"${v.createdAt ? new Date(v.createdAt).toLocaleString('id-ID') : '-'}"`,
      `"${v.namaSiswa.replace(/"/g, '""')}"`,
      `"${v.kelas.replace(/"/g, '""')}"`,
      `"${v.namaGuru.replace(/"/g, '""')}"`,
      v.rataRataGuru,
      `"${v.namaTU.replace(/"/g, '""')}"`,
      v.rataRataTU
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_polling_hgn2026_pgri1_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save Master Data (Students, Teachers, Staff) to Cloud Firestore
  const handleSaveMasterToCloud = async (
    newStudents = masterStudents,
    newTeachers = masterTeachers,
    newStaff = masterStaff
  ) => {
    setIsSavingMaster(true);
    try {
      const docRef = doc(db, 'master_data', 'lists');
      const nowStr = new Date().toISOString();
      await setDoc(docRef, {
        students: newStudents,
        teachers: newTeachers,
        staff: newStaff,
        updatedAt: nowStr
      });
      setMasterStudents(newStudents);
      setMasterTeachers(newTeachers);
      setMasterStaff(newStaff);
      setMasterUpdatedAt(nowStr);
      setMasterSuccessMsg('Data Master (Siswa, Guru, TU) berhasil disimpan ke Cloud Firestore!');
      setTimeout(() => setMasterSuccessMsg(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'master_data/lists');
    } finally {
      setIsSavingMaster(false);
    }
  };

  // Clear all Master Data (Students, Teachers, Staff) permanently from Cloud Firestore and UI
  const handleClearAllMaster = async () => {
    if (confirm('Kosongkan semua data master (Siswa, Guru, TU) di Cloud Database? Semua data yang dihapus tidak akan tampil kembali.')) {
      await handleSaveMasterToCloud([], [], []);
      alert('Seluruh data master (Siswa, Guru, TU) telah berhasil dikosongkan.');
    }
  };

  // Clear all Votes from Cloud Firestore permanently
  const handleClearAllVotes = async () => {
    if (confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data suara polling yang tersimpan di Cloud Database? Tindakan ini permanen.')) {
      setIsSavingMaster(true);
      try {
        for (const vote of firestoreVotes) {
          if (vote.id) {
            await deleteDoc(doc(db, 'votes', vote.id));
          }
        }
        localStorage.removeItem('smks_pgri1_hgn2026_voted');
        setHasVotedToken(null);
        alert('Seluruh data suara polling berhasil dihapus dan dikosongkan dari Cloud Firestore.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'votes');
      } finally {
        setIsSavingMaster(false);
      }
    }
  };

  // Template CSV Downloaders
  const downloadTemplateCSV = (type: 'siswa' | 'guru' | 'tu') => {
    let content = '';
    let filename = '';
    if (type === 'siswa') {
      content = 'Kelas,Nama Siswa\n' +
        'X TKJ 1,Aditya Pratama\n' +
        'X TKJ 1,Anisa Rahmawati\n' +
        'X TKJ 2,Arya Putra Pratama\n' +
        'X AKL,Amanda Zahra\n' +
        'X MPLB 1,Aldi Taher\n' +
        'X PM 1,Aditya Zoni';
      filename = 'template_siswa_pgri1.csv';
    } else if (type === 'guru') {
      content = 'Nama Guru\n' +
        'Drs. H. Mulyadi, M.Pd.\n' +
        'Siti Nurjanah, S.Kom. (Guru TKJ)\n' +
        'Budi Santoso, S.Kom., M.T. (Guru TKJ)\n' +
        'Asep Gunawan, S.Pd. (Guru Matematika)\n' +
        'Dewi Kartika, S.E., Ak. (Guru AKL)';
      filename = 'template_guru_pgri1.csv';
    } else {
      content = 'Nama Staf TU\n' +
        'Pak Hendra Permana (Kepala Tata Usaha)\n' +
        'Ibu Yanti Maryati (Administrasi Siswa & Rapor)\n' +
        'Pak Dedi Mulyadi (Administrasi Keuangan & SPP)\n' +
        'Ibu Nina Herlina (Persuratan & Pelayanan Legalisir)';
      filename = 'template_staf_tu_pgri1.csv';
    }

    const encodedUri = encodeURI('data:text/csv;charset=utf-8,\uFEFF' + content);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse Raw Text / CSV for Master Data
  const handleProcessRawText = async (type: 'siswa' | 'guru' | 'tu', text: string) => {
    if (!text.trim()) return;
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (type === 'siswa') {
      const parsedList: MasterStudent[] = [];
      lines.forEach((line, index) => {
        // Skip header if line has "nama" or "kelas"
        if (index === 0 && (line.toLowerCase().includes('nama') || line.toLowerCase().includes('kelas'))) {
          return;
        }

        // Split by comma, tab, or semicolon
        const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 2) {
          // Identify which part is class and which is student name
          let parsedKelas = parts[0];
          let parsedNama = parts[1];

          // If part 2 looks like a class (e.g. X TKJ, XI, XII)
          if (/^(X|XI|XII)\s/i.test(parts[1]) || /TKJ|AKL|MPLB|PM/i.test(parts[1])) {
            parsedKelas = parts[1];
            parsedNama = parts[0];
          }

          if (parsedNama && parsedKelas) {
            parsedList.push({
              id: `custom-s-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              nama: parsedNama,
              kelas: parsedKelas.toUpperCase().trim()
            });
          }
        } else if (parts.length === 1 && parts[0]) {
          // Single name, assign to currently selected class filter or default
          const defaultTargetClass = studentFilterClass !== 'SEMUA' ? studentFilterClass : 'X TKJ 1';
          parsedList.push({
            id: `custom-s-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            nama: parts[0],
            kelas: defaultTargetClass
          });
        }
      });

      if (parsedList.length > 0) {
        // Merge without exact duplicates (same class & name)
        const updated = [...masterStudents];
        parsedList.forEach(item => {
          const exists = updated.some(
            existing => existing.kelas.toLowerCase() === item.kelas.toLowerCase() &&
                        existing.nama.toLowerCase() === item.nama.toLowerCase()
          );
          if (!exists) {
            updated.push(item);
          }
        });
        await handleSaveMasterToCloud(updated, masterTeachers, masterStaff);
        alert(`Berhasil menambahkan ${parsedList.length} siswa ke Data Master!`);
      } else {
        alert('Format teks tidak dikenali. Pastikan berformat: "Kelas,Nama Siswa" (Contoh: X TKJ 1, Aditya Pratama).');
      }
    } else if (type === 'guru') {
      const parsedTeachers: string[] = [];
      lines.forEach((line, index) => {
        if (index === 0 && line.toLowerCase().includes('nama guru')) return;
        const cleaned = line.replace(/^["']|["']$/g, '').trim();
        if (cleaned.length >= 2) {
          parsedTeachers.push(cleaned);
        }
      });

      if (parsedTeachers.length > 0) {
        const set = new Set([...masterTeachers, ...parsedTeachers]);
        const updated = Array.from(set);
        await handleSaveMasterToCloud(masterStudents, updated, masterStaff);
        alert(`Berhasil menambahkan ${parsedTeachers.length} guru ke Data Master!`);
      }
    } else if (type === 'tu') {
      const parsedStaff: string[] = [];
      lines.forEach((line, index) => {
        if (index === 0 && line.toLowerCase().includes('nama staf')) return;
        const cleaned = line.replace(/^["']|["']$/g, '').trim();
        if (cleaned.length >= 2) {
          parsedStaff.push(cleaned);
        }
      });

      if (parsedStaff.length > 0) {
        const set = new Set([...masterStaff, ...parsedStaff]);
        const updated = Array.from(set);
        await handleSaveMasterToCloud(masterStudents, masterTeachers, updated);
        alert(`Berhasil menambahkan ${parsedStaff.length} staf TU ke Data Master!`);
      }
    }

    setPasteText('');
    setShowPasteModal(false);
  };

  // Handle File Upload for Excel (.xlsx, .xls) and CSV/TXT
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'siswa' | 'guru' | 'tu') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    setIsSavingMaster(true);
    try {
      if (isExcel) {
        const result = await parseExcelFile(
          file, 
          type, 
          studentFilterClass !== 'SEMUA' ? studentFilterClass : 'X TKJ 1'
        );

        if (type === 'siswa' && result.students && result.students.length > 0) {
          const updated = [...masterStudents];
          result.students.forEach(item => {
            const exists = updated.some(
              existing => existing.kelas.toLowerCase() === item.kelas.toLowerCase() &&
                          existing.nama.toLowerCase() === item.nama.toLowerCase()
            );
            if (!exists) {
              updated.push(item);
            }
          });
          await handleSaveMasterToCloud(updated, masterTeachers, masterStaff);
          alert(`Berhasil mengunggah dan menyimpan ${result.students.length} data siswa dari file Excel!`);
        } else if (type === 'guru' && result.teachers && result.teachers.length > 0) {
          const set = new Set([...masterTeachers, ...result.teachers]);
          const updated = Array.from(set);
          await handleSaveMasterToCloud(masterStudents, updated, masterStaff);
          alert(`Berhasil mengunggah dan menyimpan ${result.teachers.length} data guru dari file Excel!`);
        } else if (type === 'tu' && result.staff && result.staff.length > 0) {
          const set = new Set([...masterStaff, ...result.staff]);
          const updated = Array.from(set);
          await handleSaveMasterToCloud(masterStudents, masterTeachers, updated);
          alert(`Berhasil mengunggah dan menyimpan ${result.staff.length} data staf TU dari file Excel!`);
        } else {
          alert('Tidak ditemukan baris data valid di dalam file Excel. Silakan gunakan format template Excel resmi yang disediakan.');
        }
      } else {
        // Fallback for CSV / TXT
        const reader = new FileReader();
        reader.onload = async (event) => {
          const text = event.target?.result as string;
          if (text) {
            await handleProcessRawText(type, text);
          }
        };
        reader.readAsText(file);
      }
    } catch (err) {
      console.error('Error handling upload:', err);
      alert('Terjadi kesalahan saat memproses file. Pastikan file berformat Excel (.xlsx/.xls) yang valid.');
    } finally {
      setIsSavingMaster(false);
      e.target.value = '';
    }
  };

  // Add Single Student
  const handleAddSingleStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStudentNama.trim() || !singleStudentKelas) return;

    const exists = masterStudents.some(
      s => s.kelas.toLowerCase() === singleStudentKelas.toLowerCase() &&
           s.nama.toLowerCase() === singleStudentNama.trim().toLowerCase()
    );
    if (exists) {
      alert(`Siswa "${singleStudentNama}" sudah ada di rombel "${singleStudentKelas}".`);
      return;
    }

    const newStudent: MasterStudent = {
      id: `manual-s-${Date.now()}`,
      nama: singleStudentNama.trim(),
      kelas: singleStudentKelas
    };

    const updated = [...masterStudents, newStudent];
    await handleSaveMasterToCloud(updated, masterTeachers, masterStaff);
    setSingleStudentNama('');
  };

  // Delete Single Student
  const handleDeleteStudent = async (id: string) => {
    if (confirm('Hapus siswa ini dari daftar data master?')) {
      const updated = masterStudents.filter(s => s.id !== id);
      await handleSaveMasterToCloud(updated, masterTeachers, masterStaff);
    }
  };

  // Add Single Teacher
  const handleAddSingleTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleTeacherNama.trim()) return;
    if (masterTeachers.some(t => t.toLowerCase() === singleTeacherNama.trim().toLowerCase())) {
      alert('Nama guru tersebut sudah ada di daftar.');
      return;
    }
    const updated = [...masterTeachers, singleTeacherNama.trim()];
    await handleSaveMasterToCloud(masterStudents, updated, masterStaff);
    setSingleTeacherNama('');
  };

  // Delete Single Teacher
  const handleDeleteTeacher = async (name: string) => {
    if (confirm(`Hapus guru "${name}" dari daftar master?`)) {
      const updated = masterTeachers.filter(t => t !== name);
      await handleSaveMasterToCloud(masterStudents, updated, masterStaff);
    }
  };

  // Add Single Staff
  const handleAddSingleStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStaffNama.trim()) return;
    if (masterStaff.some(s => s.toLowerCase() === singleStaffNama.trim().toLowerCase())) {
      alert('Nama staf TU tersebut sudah ada di daftar.');
      return;
    }
    const updated = [...masterStaff, singleStaffNama.trim()];
    await handleSaveMasterToCloud(masterStudents, masterTeachers, updated);
    setSingleStaffNama('');
  };

  // Delete Single Staff
  const handleDeleteStaff = async (name: string) => {
    if (confirm(`Hapus staf TU "${name}" dari daftar master?`)) {
      const updated = masterStaff.filter(s => s !== name);
      await handleSaveMasterToCloud(masterStudents, masterTeachers, updated);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 text-slate-800 flex flex-col font-sans relative overflow-x-hidden selection:bg-purple-200 selection:text-purple-900">
      {/* Top Navbar */}
      <nav className="bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-500 flex items-center justify-center text-white shadow-md font-black text-sm shrink-0">
              <School className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white uppercase">
                  SMKS PGRI 1 KOTA SUKABUMI
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {isFirebaseConnected ? 'Firebase Cloud' : 'Menghubungkan...'}
                </span>
              </div>
              <p className="text-[11px] text-purple-200 font-medium">
                {" Polling Guru & Staf TU Favorit-Dalam Rangka HGN tahun 2026"}
              </p>
            </div>
          </div>

          {/* Header Action: Menu Admin Button */}
          <div className="flex items-center gap-2">
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView(currentView === 'admin' ? 'dashboard' : 'admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    currentView === 'admin'
                      ? 'bg-amber-400 text-slate-950 font-extrabold'
                      : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{currentView === 'admin' ? 'Buka Polling' : 'Panel Admin'}</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  title="Keluar dari Menu Admin"
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminPinModal(true)}
                className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-sm"
                title="Buka Menu Admin (5 Besar, Data Masuk, & Upload Data)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Menu Admin</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start">
        
        {/* VIEW 1: DASHBOARD UTAMA - HANYA ISI POLLING */}
        {currentView === 'dashboard' && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            
            {/* Header Hero Section */}
            <div className="text-center text-white space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs font-semibold text-white shadow-sm">
                <Award className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>HARI GURU NASIONAL 2026</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md">
                Polling Guru &amp; Staf TU Favorit
              </h1>
              <p className="text-xs sm:text-sm text-purple-100 font-medium drop-shadow flex items-center justify-center gap-1.5">
                <School className="w-4 h-4 text-pink-200" />
                <span>SMKS PGRI 1 Kota Sukabumi</span>
              </p>
            </div>

            {/* Stepper Wizard Indicator */}
            {step < 4 && (
              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 border border-white/30 shadow-lg text-white">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { num: '01', title: 'Login Siswa', stepId: 1, icon: UserCheck },
                    { num: '02', title: 'Guru Favorit', stepId: 2, icon: Award },
                    { num: '03', title: 'Staf TU Favorit', stepId: 3, icon: HeartHandshake },
                  ].map((s) => {
                    const isDone = step > s.stepId;
                    const isCurrent = step === s.stepId;
                    return (
                      <div
                        key={s.num}
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs font-semibold transition ${
                          isCurrent
                            ? 'bg-white text-indigo-700 font-extrabold shadow-md'
                            : isDone
                            ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40'
                            : 'bg-white/10 text-white/70 border border-white/15'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isDone
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white/20 text-white'
                          }`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                        </div>
                        <span className="truncate">{s.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Glassmorphic Container Card - HANYA FORMULIR POLLING */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 p-5 sm:p-7 relative overflow-hidden transition-all duration-300">
              
              {/* Info bila perangkat sebelumnya pernah dipakai memilih */}
              {hasVotedToken && step === 1 && (
                <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-indigo-950 text-xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Siswa sebelumnya di perangkat ini: <strong>{hasVotedToken.nama}</strong> ({hasVotedToken.kelas})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoginAsNewStudent}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer text-[11px] flex items-center gap-1 shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Login Siswa Baru</span>
                  </button>
                </div>
              )}

              {/* Peringatan Duplikasi / Hak Suara */}
              {duplicateWarning && (
                <div className="mb-4 p-3.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-900 text-xs flex items-start gap-2.5 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Peringatan: </span>
                    <span className="leading-relaxed">{duplicateWarning}</span>
                  </div>
                  <button onClick={() => setDuplicateWarning(null)} className="text-pink-600 hover:text-pink-900 font-bold text-xs cursor-pointer">✕</button>
                </div>
              )}

              {/* STEP 1: Login Siswa (Kelas di Atas, Nama Siswa di Bawah) */}
              {step === 1 && (
                <div className="animate-fade-in space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-indigo-600" />
                        <span>Portal Login Siswa</span>
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Langkah 1/3
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Pilih <strong>Kelas &amp; Program Keahlian</strong> Anda terlebih dahulu, kemudian pilih <strong>Nama Lengkap Siswa</strong> dari daftar yang tersedia.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* 1. ATAS: Dropdown Kelas & Program Keahlian (21 Rombel Resmi) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                          Kelas &amp; Program Keahlian <span className="text-pink-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400 font-mono">21 Rombel Resmi</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <GraduationCap className="w-4 h-4 text-indigo-600" />
                        </span>
                        <select
                          value={kelas}
                          onChange={(e) => {
                            const newClass = e.target.value;
                            setKelas(newClass);
                            setDuplicateWarning(null);
                            // If current student name does not belong to new class, reset it
                            if (namaSiswa && !isManualStudent) {
                              const inClass = masterStudents.some(
                                s => s.kelas.toLowerCase() === newClass.toLowerCase() && s.nama === namaSiswa
                              );
                              if (!inClass) setNamaSiswa('');
                            }
                          }}
                          className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50 appearance-none cursor-pointer font-medium"
                        >
                          <option value="" disabled>-- Pilih Kelas &amp; Program Keahlian --</option>
                          <optgroup label="1. TKJ (Teknik Komputer &amp; Jaringan)">
                            <option value="X TKJ 1">X TKJ 1</option>
                            <option value="X TKJ 2">X TKJ 2</option>
                            <option value="XI TKJ 1">XI TKJ 1</option>
                            <option value="XI TKJ 2">XI TKJ 2</option>
                            <option value="XII TKJ 1">XII TKJ 1</option>
                            <option value="XII TKJ 2">XII TKJ 2</option>
                          </optgroup>
                          <optgroup label="2. AKL (Akuntansi)">
                            <option value="X AKL">X AKL</option>
                            <option value="XI AKL">XI AKL</option>
                            <option value="XII AKL">XII AKL</option>
                          </optgroup>
                          <optgroup label="3. MPLB (Manajemen Perkantoran)">
                            <option value="X MPLB 1">X MPLB 1</option>
                            <option value="X MPLB 2">X MPLB 2</option>
                            <option value="XI MPLB 1">XI MPLB 1</option>
                            <option value="XI MPLB 2">XI MPLB 2</option>
                            <option value="XII MPLB 1">XII MPLB 1</option>
                            <option value="XII MPLB 2">XII MPLB 2</option>
                          </optgroup>
                          <optgroup label="4. PM (Bisnis Daring/Pemasaran)">
                            <option value="X PM 1">X PM 1</option>
                            <option value="X PM 2">X PM 2</option>
                            <option value="XI PM 1">XI PM 1</option>
                            <option value="XI PM 2">XI PM 2</option>
                            <option value="XII PM 1">XII PM 1</option>
                            <option value="XII PM 2">XII PM 2</option>
                          </optgroup>
                        </select>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <ChevronRight className="w-4 h-4 rotate-90" />
                        </span>
                      </div>
                    </div>

                    {/* 2. BAWAH: Dropdown Nama Lengkap Siswa (Terkoneksi ke Pilihan Kelas) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                          Nama Lengkap Siswa <span className="text-pink-500">*</span>
                        </label>
                        {kelas && (
                          <span className="text-[11px] text-purple-700 font-semibold">
                            {studentsInSelectedClass.length} Siswa Terdaftar
                          </span>
                        )}
                      </div>

                      {!isManualStudent ? (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                              <User className="w-4 h-4 text-purple-600" />
                            </span>
                            <select
                              disabled={!kelas}
                              value={namaSiswa}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__MANUAL__') {
                                  setIsManualStudent(true);
                                  setNamaSiswa('');
                                } else {
                                  setNamaSiswa(val);
                                  setDuplicateWarning(null);
                                }
                              }}
                              className={`w-full pl-10 pr-8 py-2.5 rounded-xl border outline-none text-sm transition appearance-none cursor-pointer ${
                                !kelas
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-slate-50/50 border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 text-slate-900 font-medium'
                              }`}
                            >
                              <option value="">
                                {!kelas 
                                  ? '-- Pilih Kelas & Program Keahlian Terlebih Dahulu --' 
                                  : studentsInSelectedClass.length === 0
                                  ? '-- Belum ada data siswa untuk rombel ini --'
                                  : `-- Pilih Nama Siswa (${studentsInSelectedClass.length} Terdaftar) --`}
                              </option>
                              {studentsInSelectedClass.map((s) => {
                                const docId = getStudentVoteDocId(kelas, s.nama);
                                const isAlreadyVoted = firestoreVotes.some(v => v.id === docId);
                                return (
                                  <option 
                                    key={s.id} 
                                    value={s.nama} 
                                    disabled={isAlreadyVoted}
                                    className={isAlreadyVoted ? 'text-slate-400 bg-slate-50' : 'text-slate-900'}
                                  >
                                    {s.nama} {isAlreadyVoted ? '(✓ Sudah Memilih)' : ''}
                                  </option>
                                );
                              })}
                              {kelas && (
                                <option value="__MANUAL__" className="text-purple-700 font-bold">
                                  + {studentsInSelectedClass.length === 0 ? 'Ketik Nama Siswa Secara Manual...' : 'Nama Saya Tidak Ada di Daftar (Ketik Manual)...'}
                                </option>
                              )}
                            </select>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                              <ChevronRight className="w-4 h-4 rotate-90" />
                            </span>
                          </div>

                          {kelas && studentsInSelectedClass.length === 0 && (
                            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2 mt-1">
                              <span>Data siswa rombel <strong>{kelas}</strong> belum diunggah panitia.</span>
                              <button
                                type="button"
                                onClick={() => setIsManualStudent(true)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shrink-0 hover:bg-indigo-700 transition cursor-pointer"
                              >
                                Ketik Manual
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 animate-fade-in">
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                              <User className="w-4 h-4 text-purple-600" />
                            </span>
                            <input
                              type="text"
                              value={namaSiswa}
                              onChange={(e) => {
                                setNamaSiswa(e.target.value);
                                setDuplicateWarning(null);
                              }}
                              placeholder="Ketik Nama Lengkap Anda sesuai rapor..."
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-purple-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-900 bg-white"
                              autoFocus
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualStudent(false);
                                setNamaSiswa('');
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                            >
                              ← Kembali ke Pilihan Dropdown Siswa
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ketentuan 1 Siswa 1 Suara */}
                    <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-900">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Ketentuan 1 Siswa 1 Suara:</span>
                        <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                          Sistem otomatis memverifikasi hak suara Anda di Cloud Database. Siswa yang telah memilih tidak dapat mengisi ulang.
                        </p>
                      </div>
                    </div>

                    {/* Tombol Masuk */}
                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={!isStep1Valid}
                        onClick={handleStudentLogin}
                        className={`w-full py-3 rounded-xl font-bold text-sm text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                          isStep1Valid
                            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 shadow-purple-500/25 active:scale-[0.99]'
                            : 'bg-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Masuk &amp; Mulai Polling Guru Favorit</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Guru Favorit (Dropdown Nama Guru) */}
              {step === 2 && (
                <div className="animate-fade-in space-y-4">
                  {/* Info Siswa yang Login */}
                  <div className="flex items-center justify-between bg-indigo-50/80 px-3.5 py-2 rounded-xl text-xs border border-indigo-200">
                    <div className="flex items-center gap-2 text-slate-800 min-w-0">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Login: <strong className="text-slate-900">{namaSiswa}</strong> ({kelas})</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setStep(1)} 
                      className="text-purple-600 hover:text-purple-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ganti Siswa</span>
                    </button>
                  </div>

                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-600" />
                        <span>Pilih Guru Favorit &amp; Beri Nilai</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pilih guru favoritmu dari dropdown dan beri rating 5-bintang untuk setiap kriteria.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold font-mono">
                      {Object.values(skorGuru).filter(v => v > 0).length}/{CRITERIA_GURU.length} Kriteria Terisi
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                      Nama Guru Favorit <span className="text-pink-500">*</span>
                    </label>

                    {!isManualGuru && masterTeachers.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                            <Award className="w-4 h-4 text-indigo-600" />
                          </span>
                          <select
                            value={namaGuru}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__MANUAL__') {
                                setIsManualGuru(true);
                                setNamaGuru('');
                              } else {
                                setNamaGuru(val);
                              }
                            }}
                            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50 appearance-none cursor-pointer font-medium"
                          >
                            <option value="">-- Pilih Guru Favorit ({masterTeachers.length} Guru) --</option>
                            {masterTeachers.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                            <option value="__MANUAL__" className="text-purple-700 font-bold">
                              + Tulis Nama Guru Lainnya (Manual)...
                            </option>
                          </select>
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fade-in">
                        <input
                          type="text"
                          value={namaGuru}
                          onChange={(e) => setNamaGuru(e.target.value)}
                          placeholder="Ketik Nama Guru Favorit pilihan Anda..."
                          className="w-full px-4 py-2.5 rounded-xl border border-purple-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-white"
                          autoFocus
                        />
                        {masterTeachers.length === 0 && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            Daftar master guru belum diupload oleh panitia. Silakan ketik nama guru pilihan Anda secara manual.
                          </p>
                        )}
                        {masterTeachers.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualGuru(false);
                                setNamaGuru('');
                              }}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                            >
                              ← Kembali ke Dropdown Guru
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Quick chips from master teachers */}
                    {!isManualGuru && masterTeachers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-400 font-semibold">Pilihan Cepat:</span>
                        {masterTeachers.slice(0, 4).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setNamaGuru(g)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                              namaGuru === g
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {g.split('(')[0].trim()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5 Criteria Stars */}
                  <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>5 Kriteria Penilaian Guru (Skala 1 - 5 Bintang)</span>
                    </p>

                    {CRITERIA_GURU.map((c, idx) => {
                      const currentVal = skorGuru[c.key];
                      return (
                        <div key={c.key} className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-800">
                              <span className="text-indigo-600 mr-1.5 font-mono">{idx + 1}.</span>
                              {c.label.replace(/^\d+\.\s*/, '')}
                            </span>
                            <span className={`text-[11px] font-medium ${currentVal > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                              {currentVal > 0 ? RATING_DESCRIPTIONS[currentVal] : 'Belum dinilai'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">{c.desc}</p>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingChange('guru', c.key, star)}
                                className={`transition-all duration-150 hover:scale-125 focus:outline-none p-1 cursor-pointer ${
                                  star <= currentVal
                                    ? 'text-amber-400 drop-shadow-sm'
                                    : 'text-slate-300 hover:text-amber-300'
                                }`}
                              >
                                <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= currentVal ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                              </button>
                            ))}
                            <span className="font-mono text-xs font-bold text-slate-700 ml-2 w-4 text-center">
                              {currentVal > 0 ? currentVal : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-600 hover:bg-slate-100 transition duration-150 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isStep2Valid}
                      onClick={() => setStep(3)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        isStep2Valid
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 shadow-purple-500/25 active:scale-[0.99]'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span>Lanjut ke Staf TU</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Staf TU Favorit (Dropdown Nama TU) */}
              {step === 3 && (
                <div className="animate-fade-in space-y-4">
                  {/* Info Siswa yang Login */}
                  <div className="flex items-center justify-between bg-purple-50/80 px-3.5 py-2 rounded-xl text-xs border border-purple-200">
                    <div className="flex items-center gap-2 text-slate-800 min-w-0">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Login: <strong className="text-slate-900">{namaSiswa}</strong> ({kelas})</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500">Guru: </span>
                      <span className="text-xs font-bold text-indigo-700">{namaGuru.split('(')[0].trim()}</span>
                    </div>
                  </div>

                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <HeartHandshake className="w-5 h-5 text-purple-600" />
                        <span>Pilih Staf TU Favorit &amp; Beri Nilai</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pilih staf Tata Usaha terbaik pilihanmu dari dropdown dan beri rating 5-bintang.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold font-mono">
                      {Object.values(skorTU).filter(v => v > 0).length}/{CRITERIA_TU.length} Kriteria Terisi
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                      Nama Staf TU Favorit <span className="text-pink-500">*</span>
                    </label>

                    {!isManualTU && masterStaff.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                            <HeartHandshake className="w-4 h-4 text-purple-600" />
                          </span>
                          <select
                            value={namaTU}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__MANUAL__') {
                                setIsManualTU(true);
                                setNamaTU('');
                              } else {
                                setNamaTU(val);
                              }
                            }}
                            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50 appearance-none cursor-pointer font-medium"
                          >
                            <option value="">-- Pilih Staf TU Favorit ({masterStaff.length} Staf TU) --</option>
                            {masterStaff.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                            <option value="__MANUAL__" className="text-purple-700 font-bold">
                              + Tulis Nama Staf TU Lainnya (Manual)...
                            </option>
                          </select>
                          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-fade-in">
                        <input
                          type="text"
                          value={namaTU}
                          onChange={(e) => setNamaTU(e.target.value)}
                          placeholder="Ketik Nama Staf TU Favorit pilihan Anda..."
                          className="w-full px-4 py-2.5 rounded-xl border border-purple-400 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-white"
                          autoFocus
                        />
                        {masterStaff.length === 0 && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                            Daftar master staf TU belum diupload oleh panitia. Silakan ketik nama staf TU pilihan Anda secara manual.
                          </p>
                        )}
                        {masterStaff.length > 0 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualTU(false);
                                setNamaTU('');
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 font-semibold cursor-pointer underline"
                            >
                              ← Kembali ke Dropdown Staf TU
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick chips from master staff */}
                    {!isManualTU && masterStaff.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-400 font-semibold">Pilihan Cepat:</span>
                        {masterStaff.slice(0, 4).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNamaTU(t)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                              namaTU === t
                                ? 'bg-purple-600 text-white font-bold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {t.split('(')[0].trim()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5 Criteria Stars for TU */}
                  <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>5 Kriteria Penilaian Staf Tata Usaha (Skala 1 - 5 Bintang)</span>
                    </p>

                    {CRITERIA_TU.map((c, idx) => {
                      const currentVal = skorTU[c.key];
                      return (
                        <div key={c.key} className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-800">
                              <span className="text-purple-600 mr-1.5 font-mono">{idx + 1}.</span>
                              {c.label.replace(/^\d+\.\s*/, '')}
                            </span>
                            <span className={`text-[11px] font-medium ${currentVal > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                              {currentVal > 0 ? RATING_DESCRIPTIONS[currentVal] : 'Belum dinilai'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">{c.desc}</p>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingChange('tu', c.key, star)}
                                className={`transition-all duration-150 hover:scale-125 focus:outline-none p-1 cursor-pointer ${
                                  star <= currentVal
                                    ? 'text-amber-400 drop-shadow-sm'
                                    : 'text-slate-300 hover:text-amber-300'
                                }`}
                              >
                                <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= currentVal ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                              </button>
                            ))}
                            <span className="font-mono text-xs font-bold text-slate-700 ml-2 w-4 text-center">
                              {currentVal > 0 ? currentVal : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-xs text-slate-600 hover:bg-slate-100 transition duration-150 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isStep3Valid || isSubmitting}
                      onClick={handleSubmit}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        isStep3Valid && !isSubmitting
                          ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-pink-500/25 active:scale-[0.99]'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan ke Cloud Database...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Kirim Suara Polling</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Success Screen */}
              {step === 4 && submittedData && (
                <div className="animate-zoom-in text-center py-4 space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-emerald-400 to-green-500 text-white flex items-center justify-center text-3xl shadow-xl shadow-green-500/30">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>

                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
                      Suara Tersimpan di Cloud Firebase!
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900">
                      Terima Kasih, <span className="text-purple-600">{submittedData.namaSiswa}</span>!
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mt-1 leading-relaxed">
                      Apresiasi Anda telah dicatat secara permanen di Database SMKS PGRI 1 Kota Sukabumi dalam rangka Hari Guru Nasional 2026.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left max-w-md mx-auto space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-xs">
                      <span className="text-slate-500">Rombel Siswa:</span>
                      <span className="font-bold text-slate-800">{submittedData.kelas}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200 text-xs">
                      <span className="text-slate-500">Guru Favorit:</span>
                      <div className="text-right">
                        <span className="font-bold text-indigo-700 block">{submittedData.namaGuru}</span>
                        <span className="text-[11px] text-amber-500 font-mono">Rating: {submittedData.avgGuru} / 5.0</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Staf TU Favorit:</span>
                      <div className="text-right">
                        <span className="font-bold text-purple-700 block">{submittedData.namaTU}</span>
                        <span className="text-[11px] text-amber-500 font-mono">Rating: {submittedData.avgTU} / 5.0</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleLoginAsNewStudent}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition cursor-pointer flex items-center gap-2 mx-auto"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Login Siswa Lainnya (Isi Polling Baru)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: MENU ADMIN (TERLINDUNGI PIN) */}
        {currentView === 'admin' && isAdminLoggedIn && (
          <div className="w-full bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 p-5 sm:p-7 space-y-5 animate-fade-in text-slate-800">
            {/* Admin Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Area Khusus Panitia &amp; Dewan Guru
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <span>Panel Rekapitulasi &amp; Data Master HGN 2026</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  SMKS PGRI 1 Kota Sukabumi • Real-time Cloud Database Firestore
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali ke Polling</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportRekapToExcel(filteredFirestoreVotes, top5Guru, top5TU)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Unduh laporan resmi rekapitulasi format Excel (.xlsx) rapi siap cetak"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Unduh Rekap Excel (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Suara Masuk</p>
                <p className="text-2xl font-extrabold text-slate-900 font-mono mt-0.5">{firestoreVotes.length}</p>
                <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Terverifikasi 1 siswa
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Data Siswa Master</p>
                <p className="text-2xl font-extrabold text-indigo-700 font-mono mt-0.5">
                  {masterStudents.length} <span className="text-xs font-sans font-normal text-slate-500">siswa</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">21 Rombel Terakreditasi</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Master Guru</p>
                <p className="text-2xl font-extrabold text-indigo-600 font-mono mt-0.5">{masterTeachers.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Dewan Guru</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Master Staf TU</p>
                <p className="text-2xl font-extrabold text-purple-600 font-mono mt-0.5">{masterStaff.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Staf Tata Usaha</p>
              </div>
            </div>

            {/* Subtabs Navigation */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => setAdminSubTab('top5')}
                className={`pb-2.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-[2px] whitespace-nowrap ${
                  adminSubTab === 'top5'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Peringkat 5 Besar Teratas</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSubTab('dataMasuk')}
                className={`pb-2.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-[2px] whitespace-nowrap ${
                  adminSubTab === 'dataMasuk'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Rekap Dokumen Data Masuk ({firestoreVotes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSubTab('uploadMaster')}
                className={`pb-2.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-[2px] whitespace-nowrap ${
                  adminSubTab === 'uploadMaster'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FolderUp className="w-4 h-4 text-purple-600" />
                <span>Upload &amp; Kelola Data Master (Siswa, Guru, TU)</span>
              </button>
            </div>

            {/* Notification Alert for Master Data Save */}
            {masterSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{masterSuccessMsg}</span>
              </div>
            )}

            {/* KONTEN SUBMENU 1: 5 BESAR (TOP 5) */}
            {adminSubTab === 'top5' && (
              <div className="space-y-4">
                {/* Switcher Kategori: Guru vs Staf TU */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => setLeaderboardCategory('guru')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      leaderboardCategory === 'guru'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>5 Besar Guru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardCategory('tu')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      leaderboardCategory === 'tu'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>5 Besar Staf TU</span>
                  </button>
                </div>

                {/* Daftar Top 5 Podium */}
                <div className="space-y-2.5 max-w-xl mx-auto">
                  {(leaderboardCategory === 'guru' ? top5Guru : top5TU).length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl text-center py-10 text-slate-400 text-xs">
                      Belum ada perolehan suara yang masuk untuk {leaderboardCategory === 'guru' ? 'Guru' : 'Staf TU'}.
                    </div>
                  ) : (
                    (leaderboardCategory === 'guru' ? top5Guru : top5TU).map((item, idx) => {
                      const isFirst = idx === 0;
                      const isSecond = idx === 1;
                      const isThird = idx === 2;

                      return (
                        <div
                          key={item.nama}
                          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                            isFirst
                              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-200/50'
                              : isSecond
                              ? 'bg-slate-50 border-slate-300'
                              : isThird
                              ? 'bg-orange-50/50 border-orange-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-black shrink-0 ${
                                isFirst
                                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                                  : isSecond
                                  ? 'bg-slate-300 text-slate-800'
                                  : isThird
                                  ? 'bg-orange-200 text-orange-900'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              #{idx + 1}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {item.nama}
                              </h4>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="text-amber-500 font-semibold flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span className="font-mono">{item.rataRataSkor} / 5.0</span>
                                </span>
                                <span>•</span>
                                <span>{leaderboardCategory === 'guru' ? 'Dewan Guru' : 'Staf Tata Usaha'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-xs sm:text-sm ${
                              leaderboardCategory === 'guru' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {item.totalSuara} Suara
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* KONTEN SUBMENU 2: DATA MASUK (DATABASE FIRESTORE) */}
            {adminSubTab === 'dataMasuk' && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Dokumen Suara Masuk di Cloud Firestore
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleAdminResetTest}
                      className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition cursor-pointer"
                    >
                      Reset Hak Suara Tes Lokal
                    </button>
                    {firestoreVotes.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllVotes}
                        className="px-2.5 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        title="Hapus dan kosongkan seluruh suara polling di database"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Kosongkan Suara ({firestoreVotes.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Rombel & Program Keahlian */}
                <div className="flex flex-wrap items-center gap-1.5 py-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">Program Keahlian:</span>
                  {(['SEMUA', 'TKJ', 'AKL', 'MPLB', 'PM'] as const).map((jur) => {
                    const count = jur === 'SEMUA' 
                      ? firestoreVotes.length 
                      : firestoreVotes.filter(v => v.kelas.toUpperCase().includes(jur)).length;
                    return (
                      <button
                        key={jur}
                        onClick={() => setJurusanFilter(jur)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          jurusanFilter === jur
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{jur}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          jurusanFilter === jur ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Table Data Masuk */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 font-bold z-10">
                        <tr>
                          <th className="py-2.5 px-3">No</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3">Kelas &amp; Rombel</th>
                          <th className="py-2.5 px-3">Guru Pilihan</th>
                          <th className="py-2.5 px-3 text-center">Skor Guru</th>
                          <th className="py-2.5 px-3">Staf TU Pilihan</th>
                          <th className="py-2.5 px-3 text-center">Skor TU</th>
                          <th className="py-2.5 px-3 text-right">Waktu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredFirestoreVotes.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-400">
                              Belum ada data suara masuk pada kategori ini.
                            </td>
                          </tr>
                        ) : (
                          filteredFirestoreVotes.map((v, idx) => (
                            <tr key={v.id || idx} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{v.namaSiswa}</td>
                              <td className="py-2 px-3">
                                <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-700">
                                  {v.kelas}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-indigo-700">{v.namaGuru}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-mono font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">
                                  ★ {v.rataRataGuru}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-purple-700">{v.namaTU}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-mono font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">
                                  ★ {v.rataRataTU}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                                {v.createdAt ? new Date(v.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* KONTEN SUBMENU 3: UPLOAD & KELOLA DATA MASTER (SISWA, GURU, TU) */}
            {adminSubTab === 'uploadMaster' && (
              <div className="space-y-4">
                {/* Header Sub-section */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FolderUp className="w-4 h-4 text-indigo-600" />
                      <span>Manajemen Sumber Data Dropdown Aplikasi Polling</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Data ini otomatis digunakan pada pilihan dropdown login siswa, guru favorit, dan staf TU.
                      {masterUpdatedAt && (
                        <span className="text-purple-700 font-medium ml-1">
                          (Sinkronisasi terakhir: {new Date(masterUpdatedAt).toLocaleString('id-ID')})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSavingMaster}
                      onClick={() => handleSaveMasterToCloud()}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isSavingMaster ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-3.5 h-3.5" />
                          <span>Simpan ke Cloud Firebase</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllMaster}
                      className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition flex items-center gap-1 border border-red-200 cursor-pointer"
                      title="Kosongkan seluruh data master siswa, guru, dan TU di Cloud Database"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Kosongkan Semua Master</span>
                    </button>
                  </div>
                </div>

                {/* Sub-selector Kategori Master */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => setUploadCategory('siswa')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadCategory === 'siswa'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Data Siswa ({masterStudents.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadCategory('guru')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadCategory === 'guru'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Data Guru ({masterTeachers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadCategory('tu')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadCategory === 'tu'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HeartHandshake className="w-3.5 h-3.5" />
                    <span>Data TU ({masterStaff.length})</span>
                  </button>
                </div>

                {/* 1. SEKSI UPLOAD DATA SISWA */}
                {uploadCategory === 'siswa' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Action Upload Controls */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Upload File Excel (.xlsx / .xls) Data Siswa</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Format resmi: <strong>Kelas &amp; Rombel</strong> dan <strong>Nama Lengkap Siswa</strong> (Tersedia format siap cetak 21 rombel).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={studentFileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={(e) => handleFileUpload(e, 'siswa')}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => studentFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Pilih File Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadExcelTemplate('siswa')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Unduh format tabel Excel resmi 21 rombel siap cetak & diisi"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Unduh Template Excel Siap Cetak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPasteModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Tempel Teks</span>
                        </button>
                      </div>
                    </div>

                    {/* Single Student Manual Add Form */}
                    <form onSubmit={handleAddSingleStudent} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-indigo-600" /> Tambah 1 Siswa:
                      </span>
                      <select
                        value={singleStudentKelas}
                        onChange={(e) => setSingleStudentKelas(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-slate-50 outline-none"
                      >
                        {ALL_ROMBEL_LIST.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Nama Lengkap Siswa..."
                        value={singleStudentNama}
                        onChange={(e) => setSingleStudentNama(e.target.value)}
                        className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!singleStudentNama.trim()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs cursor-pointer transition"
                      >
                        Tambah
                      </button>
                    </form>

                    {/* Filter and Table of Students */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-slate-400" />
                          <select
                            value={studentFilterClass}
                            onChange={(e) => setStudentFilterClass(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs text-slate-800 font-semibold bg-white"
                          >
                            <option value="SEMUA">Semua Rombel ({masterStudents.length})</option>
                            {ALL_ROMBEL_LIST.map((r) => {
                              const count = masterStudents.filter(s => s.kelas === r).length;
                              return (
                                <option key={r} value={r}>{r} ({count} siswa)</option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Cari nama siswa..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none w-48 sm:w-64"
                          />
                        </div>
                      </div>

                      {/* Students List Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <div className="overflow-y-auto max-h-[350px] custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 font-bold z-10">
                              <tr>
                                <th className="py-2 px-3 w-12">No</th>
                                <th className="py-2 px-3">Nama Lengkap Siswa</th>
                                <th className="py-2 px-3">Kelas &amp; Rombel</th>
                                <th className="py-2 px-3 text-center">Status Suara</th>
                                <th className="py-2 px-3 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {adminFilteredStudents.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="py-6 text-center text-slate-400">
                                    Tidak ada data siswa yang cocok dengan filter.
                                  </td>
                                </tr>
                              ) : (
                                adminFilteredStudents.map((s, idx) => {
                                  const docId = getStudentVoteDocId(s.kelas, s.nama);
                                  const hasVoted = firestoreVotes.some(v => v.id === docId);
                                  return (
                                    <tr key={s.id} className="hover:bg-slate-50 transition">
                                      <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                      <td className="py-1.5 px-3 font-semibold text-slate-800">{s.nama}</td>
                                      <td className="py-1.5 px-3">
                                        <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                                          {s.kelas}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-3 text-center">
                                        {hasVoted ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                            <Check className="w-3 h-3 stroke-[3]" /> Sudah Memilih
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-medium">
                                            Belum Memilih
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-3 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteStudent(s.id)}
                                          className="p-1 rounded text-red-500 hover:bg-red-50 transition cursor-pointer"
                                          title="Hapus siswa ini"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. SEKSI UPLOAD DATA GURU */}
                {uploadCategory === 'guru' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Upload File Excel (.xlsx / .xls) Data Guru</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Format resmi: <strong>Nama Lengkap Guru beserta Gelar</strong> dan <strong>Mata Pelajaran</strong> (Tersedia format siap cetak).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={teacherFileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={(e) => handleFileUpload(e, 'guru')}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => teacherFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Pilih File Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadExcelTemplate('guru')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Unduh format tabel Excel resmi dewan guru siap cetak & diisi"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Unduh Template Excel Siap Cetak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPasteModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Tempel Teks</span>
                        </button>
                      </div>
                    </div>

                    {/* Single Teacher Manual Add */}
                    <form onSubmit={handleAddSingleTeacher} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-indigo-600" /> Tambah 1 Guru:
                      </span>
                      <input
                        type="text"
                        placeholder="Nama Lengkap Guru beserta Gelar..."
                        value={singleTeacherNama}
                        onChange={(e) => setSingleTeacherNama(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!singleTeacherNama.trim()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs cursor-pointer transition"
                      >
                        Tambah
                      </button>
                    </form>

                    {/* Teachers List */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="overflow-y-auto max-h-[350px] custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 font-bold z-10">
                            <tr>
                              <th className="py-2 px-3 w-12">No</th>
                              <th className="py-2 px-3">Nama Dewan Guru</th>
                              <th className="py-2 px-3 text-center">Perolehan Suara Polling</th>
                              <th className="py-2 px-3 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {masterTeachers.map((t, idx) => {
                              const voteCount = firestoreVotes.filter(v => v.namaGuru.trim().toLowerCase() === t.trim().toLowerCase()).length;
                              return (
                                <tr key={t} className="hover:bg-slate-50 transition">
                                  <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                  <td className="py-1.5 px-3 font-semibold text-slate-800">{t}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                      {voteCount} Suara
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTeacher(t)}
                                      className="p-1 rounded text-red-500 hover:bg-red-50 transition cursor-pointer"
                                      title="Hapus guru ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. SEKSI UPLOAD DATA STAF TU */}
                {uploadCategory === 'tu' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>Upload File Excel (.xlsx / .xls) Data Staf TU</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Format resmi: <strong>Nama Lengkap Staf Tata Usaha</strong> dan <strong>Bagian / Unit Pelayanan</strong> (Tersedia format siap cetak).
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          ref={staffFileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv,.txt"
                          onChange={(e) => handleFileUpload(e, 'tu')}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => staffFileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Pilih File Excel (.xlsx)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadExcelTemplate('tu')}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-800 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Unduh format tabel Excel resmi staf TU siap cetak & diisi"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Unduh Template Excel Siap Cetak</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPasteModal(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span>Tempel Teks</span>
                        </button>
                      </div>
                    </div>

                    {/* Single Staff Manual Add */}
                    <form onSubmit={handleAddSingleStaff} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
                        <Plus className="w-3.5 h-3.5 text-purple-600" /> Tambah 1 Staf TU:
                      </span>
                      <input
                        type="text"
                        placeholder="Nama Lengkap Staf TU & Bagian Pelayanan..."
                        value={singleStaffNama}
                        onChange={(e) => setSingleStaffNama(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!singleStaffNama.trim()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs cursor-pointer transition"
                      >
                        Tambah
                      </button>
                    </form>

                    {/* Staff List */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <div className="overflow-y-auto max-h-[350px] custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 sticky top-0 font-bold z-10">
                            <tr>
                              <th className="py-2 px-3 w-12">No</th>
                              <th className="py-2 px-3">Nama Staf Tata Usaha</th>
                              <th className="py-2 px-3 text-center">Perolehan Suara Polling</th>
                              <th className="py-2 px-3 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {masterStaff.map((s, idx) => {
                              const voteCount = firestoreVotes.filter(v => v.namaTU.trim().toLowerCase() === s.trim().toLowerCase()).length;
                              return (
                                <tr key={s} className="hover:bg-slate-50 transition">
                                  <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                  <td className="py-1.5 px-3 font-semibold text-slate-800">{s}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                      {voteCount} Suara
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaff(s)}
                                      className="p-1 rounded text-red-500 hover:bg-red-50 transition cursor-pointer"
                                      title="Hapus staf TU ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal Tempel / Paste Teks CSV */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Tempel Data {uploadCategory === 'siswa' ? 'Siswa' : uploadCategory === 'guru' ? 'Guru' : 'Staf TU'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {uploadCategory === 'siswa'
                ? 'Salin dari Excel lalu tempel di sini. Format kolom: Kelas, Nama Siswa (Contoh: X TKJ 1, Aditya Pratama).'
                : 'Salin dari Excel atau daftar nama, 1 nama per baris.'}
            </p>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={
                uploadCategory === 'siswa'
                  ? 'X TKJ 1, Aditya Pratama\nX TKJ 1, Anisa Rahmawati\nX TKJ 2, Bella Safitri\nX AKL, Amanda Zahra'
                  : uploadCategory === 'guru'
                  ? 'Drs. H. Mulyadi, M.Pd.\nSiti Nurjanah, S.Kom.\nBudi Santoso, S.Kom.'
                  : 'Pak Hendra Permana\nIbu Yanti Maryati\nPak Dedi Mulyadi'
              }
              className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!pasteText.trim()}
                onClick={() => handleProcessRawText(uploadCategory, pasteText)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 disabled:bg-slate-300 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Proses &amp; Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Login Admin (PIN) */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 relative text-slate-800">
            <button
              onClick={() => {
                setShowAdminPinModal(false);
                setAdminPinError(null);
                setAdminPinInput('');
              }}
              className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Autentikasi Menu Admin</h3>
              <p className="text-xs text-slate-500">
                Masukkan PIN Panitia / Guru untuk mengakses 5 Besar, Rekap Suara, dan Upload Data Master.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                  PIN Keamanan Admin
                </label>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    setAdminPinError(null);
                  }}
                  placeholder="PIN Default: admin2026"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm text-center tracking-widest font-mono text-slate-900 placeholder-slate-400"
                  autoFocus
                />
                {adminPinError && (
                  <p className="text-xs text-pink-600 font-semibold mt-1 text-center">
                    {adminPinError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdminPinModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition cursor-pointer"
                >
                  Buka Panel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-4 px-4 text-center text-xs text-white/80">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 SMKS PGRI 1 Kota Sukabumi • Hari Guru Nasional</p>
          <p className="text-[11px] text-purple-200">Sistem Polling Digital Berbasis Cloud Firestore</p>
        </div>
      </footer>
    </div>
  );
}
