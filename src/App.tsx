/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  KeyRound,
  LogOut,
  X,
  LogIn,
  UserCheck,
  UserPlus,
  RefreshCw,
  Download,
  Medal,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

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

const DAFTAR_GURU_CONTOH = [
  'Drs. H. Mulyadi, M.Pd.',
  'Siti Nurjanah, S.Kom. (Guru TKJ)',
  'Asep Gunawan, S.Pd. (Guru Matematika)',
  'Dewi Kartika, S.E. (Guru Akuntansi / AKL)',
  'Rina Marlina, M.Pd. (Guru Bahasa Indonesia)',
  'Budi Santoso, S.Kom. (Guru TKJ)',
  'Dra. Eni Rohaeni (Guru Manajemen Perkantoran / MPLB)',
  'Rahmat Hidayat, S.E. (Guru Bisnis Daring & Pemasaran / PM)'
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

const DAFTAR_TU_CONTOH = [
  'Pak Hendra (Kepala Tata Usaha)',
  'Ibu Yanti (Administrasi Siswa & Rapor)',
  'Pak Dedi (Administrasi Keuangan & SPP)',
  'Ibu Nina (Persuratan & Pelayanan Legalisir)',
  'Pak Rahmat (Sarana & Prasarana)'
];

const DEFAULT_ADMIN_PIN = 'admin2026';

export default function App() {
  // Navigation: 'dashboard' (hanya polling) vs 'admin' (5 besar & data masuk)
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin'>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<'top5' | 'dataMasuk'>('top5');
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

  // Input fields
  const [namaSiswa, setNamaSiswa] = useState<string>('');
  const [kelas, setKelas] = useState<string>('');
  const [namaGuru, setNamaGuru] = useState<string>('');
  const [skorGuru, setSkorGuru] = useState<GuruScores>({
    keramahan: 0,
    profesionalisme: 0,
    empati: 0,
    keteladanan: 0,
    inspirasi: 0,
  });
  const [namaTU, setNamaTU] = useState<string>('');
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
    setNamaGuru('');
    setSkorGuru({ keramahan: 0, profesionalisme: 0, empati: 0, keteladanan: 0, inspirasi: 0 });
    setNamaTU('');
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
      setNamaGuru('');
      setSkorGuru({ keramahan: 0, profesionalisme: 0, empati: 0, keteladanan: 0, inspirasi: 0 });
      setNamaTU('');
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

          {/* Header Action: Discreet Menu Admin Button */}
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
                title="Buka Menu Admin (5 Besar & Data Masuk)"
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

              {/* STEP 1: Login Siswa */}
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
                      Masukkan <strong>Nama Lengkap</strong> dan pilih <strong>Rombel Kelas</strong> Anda untuk masuk ke sistem Polling HGN 2026.
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    {/* Nama Lengkap Siswa */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                        Nama Lengkap Siswa <span className="text-pink-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={namaSiswa}
                          onChange={(e) => {
                            setNamaSiswa(e.target.value);
                            setDuplicateWarning(null);
                          }}
                          placeholder="Contoh: Muhammad Farhan"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50"
                        />
                      </div>
                    </div>

                    {/* Kelas & Program Keahlian (21 Rombel Resmi) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                          Kelas &amp; Program Keahlian <span className="text-pink-500">*</span>
                        </label>
                        <span className="text-[11px] text-slate-400 font-mono">21 Rombel Terakreditasi</span>
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                          <GraduationCap className="w-4 h-4" />
                        </span>
                        <select
                          value={kelas}
                          onChange={(e) => {
                            setKelas(e.target.value);
                            setDuplicateWarning(null);
                          }}
                          className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>-- Pilih Rombel &amp; Program Keahlian --</option>
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

                    {/* Ketentuan 1 Siswa 1 Suara */}
                    <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-900">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Ketentuan 1 Siswa 1 Suara:</span>
                        <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                          Sistem otomatis memverifikasi hak suara Anda di Cloud Database. Pastikan menggunakan nama lengkap asli.
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

              {/* STEP 2: Guru Favorit */}
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
                        Beri rating 5-bintang untuk setiap kriteria guru pilihanmu.
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
                    <input
                      type="text"
                      value={namaGuru}
                      onChange={(e) => setNamaGuru(e.target.value)}
                      placeholder="Contoh: Bu Siti Nurjanah, S.Kom."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50"
                    />
                    
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Pilihan Cepat:</span>
                      {DAFTAR_GURU_CONTOH.slice(0, 4).map((g) => (
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

              {/* STEP 3: Staf TU Favorit */}
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
                        Nilai pelayanan staf Tata Usaha terbaik pilihanmu.
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
                    <input
                      type="text"
                      value={namaTU}
                      onChange={(e) => setNamaTU(e.target.value)}
                      placeholder="Contoh: Ibu Yanti / Pak Hendra"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none text-sm transition text-slate-800 bg-slate-50/50"
                    />

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Pilihan Cepat:</span>
                      {DAFTAR_TU_CONTOH.slice(0, 4).map((t) => (
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

                  {/* Summary */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100 text-left max-w-md mx-auto space-y-2 text-xs sm:text-sm">
                    <p className="text-xs font-bold text-purple-900 uppercase tracking-wide border-b border-purple-200 pb-1.5 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-purple-600" />
                      <span>Ringkasan Suara Anda:</span>
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Kelas:</span>
                      <span className="font-semibold text-slate-800 font-mono">{submittedData.kelas}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Guru Favorit:</span>
                      <span className="font-bold text-indigo-700">{submittedData.namaGuru}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Staf TU Favorit:</span>
                      <span className="font-bold text-pink-700">{submittedData.namaTU}</span>
                    </div>
                  </div>

                  {/* Tombol Login Siswa Baru */}
                  <div className="pt-2 max-w-md mx-auto space-y-2">
                    <button
                      type="button"
                      onClick={handleLoginAsNewStudent}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Login Siswa Lainnya (Isi Polling Baru)</span>
                    </button>
                    <p className="text-[11px] text-slate-400">
                      Klik tombol di atas bila komputer atau ponsel ini akan digunakan oleh siswa lain.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* VIEW 2: PANEL ADMIN - MENU 5 BESAR & DATA MASUK TERSIMPAN DI SINI */}
        {currentView === 'admin' && isAdminLoggedIn && (
          <div className="w-full bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-2xl p-5 sm:p-7 text-slate-800 space-y-5 animate-fade-in">
            {/* Header Panel Admin */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold mb-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  Area Khusus Panitia &amp; Dewan Guru
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <span>Panel Rekapitulasi Polling HGN 2026</span>
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
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Unduh seluruh suara dalam format CSV untuk Excel"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh Rekap CSV</span>
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
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rombel Aktif</p>
                <p className="text-2xl font-extrabold text-indigo-700 font-mono mt-0.5">
                  {new Set(firestoreVotes.map((d) => d.kelas)).size} <span className="text-xs font-sans font-normal text-slate-500">/ 21</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">4 Program Keahlian</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Top Guru Teratas</p>
                <p className="text-2xl font-extrabold text-indigo-600 font-mono mt-0.5">{top5Guru.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">5 Terpilih</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Top Staf TU Teratas</p>
                <p className="text-2xl font-extrabold text-purple-600 font-mono mt-0.5">{top5TU.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">5 Terpilih</p>
              </div>
            </div>

            {/* Subtabs Navigation */}
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setAdminSubTab('top5')}
                className={`pb-2.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-[2px] ${
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
                className={`pb-2.5 px-3.5 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 -mb-[2px] ${
                  adminSubTab === 'dataMasuk'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Rekap Dokumen Data Masuk ({firestoreVotes.length})</span>
              </button>
            </div>

            {/* Konten Submenu 1: 5 BESAR (TOP 5) */}
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

            {/* Konten Submenu 2: DATA MASUK (DATABASE FIRESTORE) */}
            {adminSubTab === 'dataMasuk' && (
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Dokumen Suara Masuk di Cloud Firestore
                    </h3>
                  </div>
                  <button
                    onClick={handleAdminResetTest}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition cursor-pointer"
                  >
                    Reset Hak Suara Tes Lokal
                  </button>
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
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>{jur === 'SEMUA' ? 'Semua' : jur}</span>
                        <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                          jurusanFilter === jur ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Tabel Data Masuk */}
                <div className="overflow-x-auto rounded-xl border border-slate-200 custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Kelas / Rombel</th>
                        <th className="py-2.5 px-3">Guru Pilihan</th>
                        <th className="py-2.5 px-3 text-center">Rating Guru</th>
                        <th className="py-2.5 px-3">Staf TU Pilihan</th>
                        <th className="py-2.5 px-3 text-center">Rating TU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {filteredFirestoreVotes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400">
                            {firestoreVotes.length === 0 
                              ? 'Belum ada dokumen suara di Firebase Firestore.' 
                              : `Tidak ada data suara untuk program keahlian "${jurusanFilter}".`}
                          </td>
                        </tr>
                      ) : (
                        filteredFirestoreVotes.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                              {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">{item.namaSiswa}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[10px] font-mono">
                                {item.kelas}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-indigo-700 font-medium whitespace-nowrap">{item.namaGuru}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-500 whitespace-nowrap">
                              ★ {item.rataRataGuru}
                            </td>
                            <td className="py-2.5 px-3 text-pink-700 font-medium whitespace-nowrap">{item.namaTU}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-500 whitespace-nowrap">
                              ★ {item.rataRataTU}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL PIN LOGIN ADMIN */}
      {showAdminPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-slate-800 animate-zoom-in relative space-y-4">
            <button
              onClick={() => {
                setShowAdminPinModal(false);
                setAdminPinError(null);
                setAdminPinInput('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2 font-bold shadow-inner">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Masuk Menu Admin</h3>
              <p className="text-xs text-slate-500 mt-0.5">Khusus Panitia &amp; Dewan Guru</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Masukkan PIN Admin:
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
