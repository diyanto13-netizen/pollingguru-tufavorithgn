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
  RefreshCw
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <nav className="bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 py-2.5 text-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-500 flex items-center justify-center text-white shadow-md font-black text-sm shrink-0">
              <School className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  SMKS PGRI 1 KOTA SUKABUMI
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Firebase Cloud
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Polling Guru & Staf TU Favorit-Dalam Rangka HGN tahun 2026
              </p>
            </div>
          </div>

          {/* Header Action: Discreet Menu Admin Button */}
          <div className="flex items-center gap-2">
            {isAdminLoggedIn ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentView(currentView === 'admin' ? 'dashboard' : 'admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    currentView === 'admin'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{currentView === 'admin' ? 'Buka Polling' : 'Panel Admin'}</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  title="Keluar dari Menu Admin"
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdminPinModal(true)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 border border-white/15 cursor-pointer"
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
      <div className="flex-1 py-6 px-3 sm:px-6 flex items-center justify-center">
        
        {/* VIEW 1: DASHBOARD UTAMA - HANYA ISI POLLING */}
        {currentView === 'dashboard' && (
          <div className="w-full max-w-xl mx-auto">
            {/* Header Brand */}
            <div className="text-center mb-4 text-white">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-xs sm:text-sm font-semibold tracking-wide text-white mb-2 shadow-sm">
                <Award className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>HARI GURU NASIONAL 2026</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md">
                Polling Guru & Staf TU Favorit
              </h1>
              <p className="text-sm sm:text-base text-purple-100 font-medium mt-0.5 drop-shadow flex items-center justify-center gap-1.5">
                <School className="w-4 h-4 text-pink-200" />
                <span>SMKS PGRI 1 Kota Sukabumi</span>
              </p>
            </div>

            {/* Glassmorphic Container Card - HANYA FORMULIR POLLING */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-white/60 p-5 sm:p-8 relative overflow-hidden transition-all duration-300">
              
              {/* Info bila perangkat sebelumnya pernah dipakai memilih */}
              {hasVotedToken && step === 1 && (
                <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 text-xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Siswa sebelumnya di perangkat ini: <strong>{hasVotedToken.nama}</strong> ({hasVotedToken.kelas})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoginAsNewStudent}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition cursor-pointer text-[11px] flex items-center gap-1 shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Bersihkan & Login Baru</span>
                  </button>
                </div>
              )}

              {duplicateWarning && (
                <div className="mb-4 p-3 rounded-xl bg-pink-50 border border-pink-200 text-pink-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-pink-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Peringatan: </span>
                    <span>{duplicateWarning}</span>
                  </div>
                  <button onClick={() => setDuplicateWarning(null)} className="text-pink-600 hover:text-pink-900 font-bold text-xs cursor-pointer">✕</button>
                </div>
              )}

              {/* Wizard Steps Header (Langkah 1, 2, 3) */}
              {step < 4 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between relative mb-2">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full z-0 transition-all duration-300"
                      style={{
                        width: step === 1 ? '0%' : step === 2 ? '50%' : '100%'
                      }}
                    ></div>

                    {/* Step Nodes */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                          step > 1
                            ? 'bg-emerald-500 text-white shadow-md'
                            : step === 1
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-110 ring-4 ring-purple-200'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
                      </div>
                      <span className="text-[11px] font-bold mt-1 text-slate-800">Login Siswa</span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                          step > 2
                            ? 'bg-emerald-500 text-white shadow-md'
                            : step === 2
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-110 ring-4 ring-purple-200'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
                      </div>
                      <span className="text-[11px] font-medium mt-1 text-slate-700">Guru</span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                          step === 3
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md scale-110 ring-4 ring-purple-200'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        3
                      </div>
                      <span className="text-[11px] font-medium mt-1 text-slate-700">Staf TU</span>
                    </div>
                  </div>
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

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">
                      Kelas & Program Keahlian <span className="text-pink-500">*</span>
                    </label>
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
                        <option value="" disabled>-- Pilih Rombel & Program Keahlian --</option>
                        <optgroup label="1. TKJ (Teknik Komputer & Jaringan)">
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
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      disabled={!isStep1Valid}
                      onClick={handleStudentLogin}
                      className={`w-full py-3 rounded-xl font-bold text-sm text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        isStep1Valid
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 shadow-purple-500/25'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Masuk / Login Siswa & Mulai Polling</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Guru Favorit */}
              {step === 2 && (
                <div className="animate-fade-in space-y-4">
                  {/* Info Siswa yang Login */}
                  <div className="flex items-center justify-between bg-slate-100/90 px-3.5 py-2 rounded-xl text-xs border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-800">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Login: <strong className="text-slate-900">{namaSiswa}</strong> ({kelas})</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setStep(1)} 
                      className="text-purple-600 hover:text-purple-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ganti Siswa</span>
                    </button>
                  </div>

                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <School className="w-5 h-5 text-purple-600" />
                        <span>Langkah 2: Guru Favorit</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Beri rating 5-bintang untuk setiap kriteria guru pilihanmu.
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">2/3</span>
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
                      <span className="text-[10px] text-slate-400 font-semibold">Pilihan:</span>
                      {DAFTAR_GURU_CONTOH.slice(0, 3).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setNamaGuru(g)}
                          className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200/60 rounded-full text-[10px] hover:bg-purple-100 transition cursor-pointer"
                        >
                          + {g.split('(')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5 Criteria Stars */}
                  <div className="max-h-[290px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>5 Kriteria Penilaian Guru</span>
                    </p>

                    {CRITERIA_GURU.map((c) => {
                      const currentVal = skorGuru[c.key];
                      return (
                        <div key={c.key} className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/80">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-800">{c.label}</span>
                            <span className={`text-[11px] font-medium ${currentVal > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                              {currentVal > 0 ? RATING_DESCRIPTIONS[currentVal] : 'Belum dinilai'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">{c.desc}</p>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingChange('guru', c.key, star)}
                                className={`text-xl sm:text-2xl transition-all duration-150 hover:scale-125 focus:outline-none p-1 cursor-pointer ${
                                  star <= currentVal
                                    ? 'text-amber-400 drop-shadow-sm'
                                    : 'text-slate-300 hover:text-amber-300'
                                }`}
                              >
                                <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= currentVal ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-3 rounded-xl border border-slate-300 font-semibold text-sm text-slate-600 hover:bg-slate-100 transition duration-150 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isStep2Valid}
                      onClick={() => setStep(3)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        isStep2Valid
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 shadow-purple-500/25'
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
                  <div className="flex items-center justify-between bg-slate-100/90 px-3.5 py-2 rounded-xl text-xs border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-800">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Login: <strong className="text-slate-900">{namaSiswa}</strong> ({kelas})</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setStep(1)} 
                      className="text-purple-600 hover:text-purple-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Ganti Siswa</span>
                    </button>
                  </div>

                  <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-pink-600" />
                        <span>Langkah 3: Staf TU Favorit</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Nilai pelayanan staf Tata Usaha terbaik pilihanmu.
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded bg-pink-100 text-pink-700 text-[10px] font-bold">3/3</span>
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none text-sm transition text-slate-800 bg-slate-50/50"
                    />

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Pilihan:</span>
                      {DAFTAR_TU_CONTOH.slice(0, 3).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNamaTU(t)}
                          className="px-2 py-0.5 bg-pink-50 text-pink-700 border border-pink-200/60 rounded-full text-[10px] hover:bg-pink-100 transition cursor-pointer"
                        >
                          + {t.split('(')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5 Criteria Stars for TU */}
                  <div className="max-h-[290px] overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>5 Kriteria Penilaian Staf Tata Usaha</span>
                    </p>

                    {CRITERIA_TU.map((c) => {
                      const currentVal = skorTU[c.key];
                      return (
                        <div key={c.key} className="bg-slate-50/90 p-3 rounded-xl border border-slate-200/80">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs sm:text-sm font-bold text-slate-800">{c.label}</span>
                            <span className={`text-[11px] font-medium ${currentVal > 0 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                              {currentVal > 0 ? RATING_DESCRIPTIONS[currentVal] : 'Belum dinilai'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2">{c.desc}</p>
                          <div className="flex items-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRatingChange('tu', c.key, star)}
                                className={`text-xl sm:text-2xl transition-all duration-150 hover:scale-125 focus:outline-none p-1 cursor-pointer ${
                                  star <= currentVal
                                    ? 'text-amber-400 drop-shadow-sm'
                                    : 'text-slate-300 hover:text-amber-300'
                                }`}
                              >
                                <Star className={`w-5 h-5 sm:w-6 sm:h-6 ${star <= currentVal ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-3 rounded-xl border border-slate-300 font-semibold text-sm text-slate-600 hover:bg-slate-100 transition duration-150 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali</span>
                    </button>
                    <button
                      type="button"
                      disabled={!isStep3Valid || isSubmitting}
                      onClick={handleSubmit}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                        isStep3Valid && !isSubmitting
                          ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 shadow-pink-500/25'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan ke Firebase Firestore...</span>
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4" />
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
                      <span className="font-semibold text-slate-800">{submittedData.kelas}</span>
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

            <div className="text-center mt-5 text-white/80 text-xs">
              <p>© 2026 SMKS PGRI 1 Kota Sukabumi • Hari Guru Nasional</p>
            </div>
          </div>
        )}

        {/* VIEW 2: PANEL ADMIN - MENU 5 BESAR & DATA MASUK TERSIMPAN DI SINI */}
        {currentView === 'admin' && isAdminLoggedIn && (
          <div className="w-full max-w-4xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-2xl p-5 sm:p-7 text-slate-800 animate-fade-in">
            {/* Header Panel Admin */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span>Panel Menu Admin</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Terkunci Khusus Admin
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Memantau hasil 5 besar perolehan suara tertinggi dan rekaman database Firebase.
                  </p>
                </div>
              </div>

              {/* Subtabs di Menu Admin: 5 Besar & Data Masuk */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAdminSubTab('top5')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    adminSubTab === 'top5'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>5 Besar (Top 5)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSubTab('dataMasuk')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    adminSubTab === 'dataMasuk'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Data Masuk ({firestoreVotes.length})</span>
                </button>
              </div>
            </div>

            {/* Konten Submenu 1: 5 BESAR (TOP 5) */}
            {adminSubTab === 'top5' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Hasil 5 Besar Polling Tertinggi (Guru & Staf TU)</span>
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Live Real-Time
                  </span>
                </div>

                {/* Tab Kategori Guru vs TU */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => setLeaderboardCategory('guru')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      leaderboardCategory === 'guru'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>5 Besar Guru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardCategory('tu')}
                    className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      leaderboardCategory === 'tu'
                        ? 'bg-white text-pink-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>5 Besar Staf TU</span>
                  </button>
                </div>

                {/* Daftar Top 5 */}
                <div className="space-y-2.5 max-w-xl mx-auto pt-1">
                  {(leaderboardCategory === 'guru' ? top5Guru : top5TU).length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Belum ada suara yang masuk di database Firebase.
                    </div>
                  ) : (
                    (leaderboardCategory === 'guru' ? top5Guru : top5TU).map((item, idx) => {
                      const medals = [
                        { icon: '🥇', bg: 'border-amber-300 bg-amber-50/70 ring-2 ring-amber-200/50' },
                        { icon: '🥈', bg: 'border-slate-300 bg-slate-50/80' },
                        { icon: '🥉', bg: 'border-amber-700/30 bg-orange-50/50' },
                        { icon: '#4', bg: 'border-slate-200 bg-white' },
                        { icon: '#5', bg: 'border-slate-200 bg-white' },
                      ];
                      const medal = medals[idx] || { icon: `#${idx + 1}`, bg: 'border-slate-200 bg-white' };

                      return (
                        <div
                          key={item.nama}
                          className={`p-3.5 rounded-xl border ${medal.bg} flex items-center justify-between transition hover:shadow-sm`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl shrink-0">{medal.icon}</span>
                            <div>
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                                {item.nama}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500 mt-0.5">
                                <span className="text-amber-500 font-semibold flex items-center gap-0.5">
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  <span>{item.rataRataSkor} / 5</span>
                                </span>
                                <span>•</span>
                                <span>{leaderboardCategory === 'guru' ? 'Dewan Guru' : 'Staf Tata Usaha'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`inline-block px-3 py-1 rounded-full font-black text-xs sm:text-sm ${
                              leaderboardCategory === 'guru' ? 'bg-indigo-100 text-indigo-700' : 'bg-pink-100 text-pink-700'
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Dokumen Suara Masuk di Firebase Firestore</span>
                  </h3>
                  <button
                    onClick={handleAdminResetTest}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold transition cursor-pointer"
                  >
                    Reset Hak Suara Tes
                  </button>
                </div>

                {/* Filter Rombel & Program Keahlian */}
                <div className="flex flex-wrap items-center gap-1.5 py-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-600 mr-1">Filter Program Keahlian:</span>
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
                            ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-200'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>{jur === 'SEMUA' ? 'Semua' : jur}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          jurusanFilter === jur ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-2.5">Waktu Masuk</th>
                        <th className="p-2.5">Nama Siswa</th>
                        <th className="p-2.5">Kelas / Rombel</th>
                        <th className="p-2.5">Guru Pilihan</th>
                        <th className="p-2.5 text-center">Skor Guru</th>
                        <th className="p-2.5">Staf TU Pilihan</th>
                        <th className="p-2.5 text-center">Skor TU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredFirestoreVotes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            {firestoreVotes.length === 0 
                              ? 'Belum ada dokumen suara di Firebase Firestore.' 
                              : `Tidak ada data suara untuk program keahlian "${jurusanFilter}".`}
                          </td>
                        </tr>
                      ) : (
                        filteredFirestoreVotes.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                              {item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="p-2.5 font-semibold text-slate-900 whitespace-nowrap">{item.namaSiswa}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[10px]">
                                {item.kelas}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium text-indigo-700 whitespace-nowrap">{item.namaGuru}</td>
                            <td className="p-2.5 text-center font-bold text-amber-500 whitespace-nowrap">
                              ⭐ {item.rataRataGuru}
                            </td>
                            <td className="p-2.5 font-medium text-pink-700 whitespace-nowrap">{item.namaTU}</td>
                            <td className="p-2.5 text-center font-bold text-amber-500 whitespace-nowrap">
                              ⭐ {item.rataRataTU}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Panel Admin: Kembali ke Dashboard */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Terhubung ke Project ID: <code className="font-mono text-purple-700 font-bold">{firebaseConfig.projectId}</code>
              </span>
              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className="font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Dashboard Polling</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* MODAL PIN LOGIN ADMIN */}
      {showAdminPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-slate-800 animate-zoom-in relative">
            <button
              onClick={() => {
                setShowAdminPinModal(false);
                setAdminPinError(null);
                setAdminPinInput('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2 text-xl shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Masuk Menu Admin</h3>
              <p className="text-xs text-slate-500 mt-1">
                Akses khusus guru/panitia untuk melihat 5 Besar Teratas dan Data Masuk.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Masukkan PIN / Sandi Admin:
                </label>
                <input
                  type="password"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    setAdminPinError(null);
                  }}
                  placeholder="PIN Default: admin2026"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm text-center tracking-widest font-mono"
                  autoFocus
                />
                {adminPinError && (
                  <p className="text-[11px] text-pink-600 font-semibold mt-1 text-center">
                    {adminPinError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow hover:opacity-95 transition cursor-pointer"
              >
                Buka Menu Admin
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
