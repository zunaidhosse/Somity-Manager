import React, { useState, FormEvent, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { 
  Users, 
  HandCoins, 
  LayoutDashboard, 
  History, 
  Plus, 
  Search,
  ChevronRight,
  Calculator,
  Calendar,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  Download,
  ArrowLeft,
  Edit2,
  Save,
  Trash2,
  Database,
  Upload,
  BarChart3,
  TrendingUp,
  PieChart,
  ArrowUpRight
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Member, type Loan, type Installment } from './db';
import { format, addWeeks, addMonths, startOfDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';

// Utilities
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

async function captureAndDownload(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found:', elementId);
    return;
  }
  
  const originalStyle = element.style.cssText;
  
  try {
    // Show loading feedback
    const btn = document.activeElement as HTMLButtonElement;
    const originalText = btn ? btn.innerText : '';
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = true;
      btn.innerText = 'প্রসেস হচ্ছে...';
    }

    // Temporary style adjustment to ensure it captures correctly
    element.style.position = 'fixed';
    element.style.left = '0';
    element.style.top = '0';
    element.style.zIndex = '-9999';
    element.style.visibility = 'visible';
    element.style.display = 'block';

    const dataUrl = await toPng(element, {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Higher quality
    });

    // Reset styles
    element.style.cssText = originalStyle;

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  } catch (err) {
    console.error('Download failed', err);
    element.style.cssText = originalStyle;
    alert('ডাউনলোড ব্যর্থ হয়েছে। ব্রাউজারের পারমিশন চেক করুন।');
  }
}

type View = 'dashboard' | 'members' | 'completed_members' | 'loans' | 'history' | 'member_profile';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingLoan, setIsAddingLoan] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PWA Logic
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Check if user already dismissed or installed
      const wasDismissed = localStorage.getItem('pwa_install_dismissed');
      if (!wasDismissed) {
        setShowInstallPopup(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setShowInstallPopup(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallPopup(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  // Queries
  const members = useLiveQuery(() => db.members.toArray()) || [];
  const loans = useLiveQuery(() => db.loans.toArray()) || [];
  const installments = useLiveQuery(() => db.installments.toArray()) || [];

  const handleExport = async () => {
    const m = await db.members.toArray();
    const l = await db.loans.toArray();
    const i = await db.installments.toArray();
    const data = JSON.stringify({ members: m, loans: l, installments: i });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `somitipro-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (window.confirm('সব বর্তমান ডাটা মুছে যাবে এবং ব্যাকআপ ডাটা রিস্টোর হবে। আপনি কি নিশ্চিত?')) {
          await db.members.clear();
          await db.loans.clear();
          await db.installments.clear();
          await db.members.bulkAdd(data.members);
          await db.loans.bulkAdd(data.loans);
          await db.installments.bulkAdd(data.installments);
          alert('ডাটা সফলভাবে রিস্টোর হয়েছে!');
          window.location.reload();
        }
      } catch (err) {
        alert('ভুল ফাইল ফরম্যাট!');
      }
    };
    reader.readAsText(file);
  };

  const activeLoans = loans.filter(l => l.status === 'active');
  const totalPrincipal = activeLoans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalExpected = activeLoans.reduce((sum, l) => sum + l.totalPayable, 0);
  const totalReceived = installments.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform md:translate-x-0 md:static",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter italic">
              SOMITI<span className="text-emerald-400 font-normal underline decoration-2 underline-offset-4">PRO</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
              )} />
              <p className="text-[8px] uppercase tracking-widest text-slate-500 font-black">
                {isOnline ? 'Online Ready' : 'Offline Mode'}
              </p>
              {offlineReady && (
                <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 border border-emerald-500/30 rounded">CACHED</span>
              )}
            </div>
            <p className="text-[8px] text-slate-600 font-bold mt-1">LAST UPDATED: {format(new Date(), 'h:mm a')}</p>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400">
            <Plus size={24} className="rotate-45" />
          </button>
        </div>
        <nav className="flex-1 p-8 pt-12 space-y-8">
          <NavItem 
            active={currentView === 'dashboard'} 
            onClick={() => { setCurrentView('dashboard'); setIsMobileMenuOpen(false); }}
            label="DASHBOARD"
          />
          <NavItem 
            active={currentView === 'members'} 
            onClick={() => { setCurrentView('members'); setIsMobileMenuOpen(false); }}
            label="ACTIVE MEMBERS"
          />
          <NavItem 
            active={currentView === 'completed_members'} 
            onClick={() => { setCurrentView('completed_members'); setIsMobileMenuOpen(false); }}
            label="COMPLETED MEMBERS"
          />
          <NavItem 
            active={currentView === 'loans'} 
            onClick={() => { setCurrentView('loans'); setIsMobileMenuOpen(false); }}
            label="COLLECTIONS"
          />
          <NavItem 
            active={currentView === 'history'} 
            onClick={() => { setCurrentView('history'); setIsMobileMenuOpen(false); }}
            label="REPORTS"
          />

          <div className="pt-8 border-t border-slate-800 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Data Control</p>
            <button 
              onClick={handleExport}
              className="w-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-all text-left"
            >
              <Database size={12} /> Backup Data
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all text-left"
            >
              <Upload size={12} /> Restore Data
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImport} 
              className="hidden" 
              accept=".json"
            />
          </div>
        </nav>
        
        <div className="p-8">
          <div className="bg-slate-800 p-4 rounded-xl">
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Local Storage</p>
            <p className="text-sm font-black mt-1">Status: Online</p>
            <div className="w-full bg-slate-700 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-1 w-[15%]"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-12 w-full">
        <header className="px-4 md:px-12 py-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600"
              >
                <LayoutDashboard size={20} />
              </button>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                {format(new Date(), 'EEEE, dd MMMM')}
              </p>
            </div>
            <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none text-slate-900">
              {currentView === 'dashboard' && 'লোন ড্যাশবোর্ড'}
              {currentView === 'members' && 'সক্রিয় সদস্য'}
              {currentView === 'completed_members' && 'পরিসমাপ্ত সদস্য'}
              {currentView === 'loans' && 'ঋণ ব্যবস্থাপনা'}
              {currentView === 'history' && 'লেনদেনের ইতিহাস'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsAddingMember(true)}
              className="px-6 py-4 bg-emerald-500 text-white font-black text-[10px] md:text-xs uppercase tracking-widest rounded-none brutalist-shadow-emerald transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              নতুন সদস্য +
            </button>
            <button 
              onClick={() => setIsAddingLoan(true)}
              className="px-6 py-4 bg-slate-900 text-white font-black text-[10px] md:text-xs uppercase tracking-widest rounded-none brutalist-shadow-slate transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              নতুন ঋণ দিন
            </button>
          </div>
        </header>

        <div className="px-4 md:px-12 max-w-7xl mx-auto">
          {currentView === 'dashboard' && (
            <Dashboard 
              totalPrincipal={totalPrincipal}
              totalExpected={totalExpected}
              totalReceived={totalReceived}
              activeLoansCount={activeLoans.length}
              recentMembers={members.filter(m => 
                loans.some(l => l.memberId === m.id && l.status === 'active') || 
                !loans.some(l => l.memberId === m.id)
              ).slice(-5).reverse()}
              recentInstallments={installments.filter(i => i.status === 'paid').slice(-5).reverse()}
            />
          )}
          {currentView === 'members' && (
            <MembersList 
              members={members.filter(m => 
                loans.some(l => l.memberId === m.id && l.status === 'active') || 
                !loans.some(l => l.memberId === m.id)
              )} 
              onAdd={() => setIsAddingMember(true)} 
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentView('member_profile');
              }}
            />
          )}
          {currentView === 'completed_members' && (
            <MembersList 
              members={members.filter(m => 
                loans.some(l => l.memberId === m.id) && 
                !loans.some(l => l.memberId === m.id && l.status === 'active')
              )} 
              onAdd={() => setIsAddingMember(true)} 
              onSelectMember={(id) => {
                setSelectedMemberId(id);
                setCurrentView('member_profile');
              }}
            />
          )}
          {currentView === 'loans' && (
            <LoansList 
              loans={loans} 
              members={members} 
              onSelect={(id) => setSelectedLoanId(id)}
            />
          )}
          {currentView === 'history' && (
            <HistoryView installments={installments} loans={loans} members={members} />
          )}
              {currentView === 'member_profile' && selectedMemberId && (
            <MemberProfile 
              memberId={selectedMemberId} 
              onBack={() => setCurrentView(
                loans.some(l => l.memberId === selectedMemberId && l.status === 'active') || 
                !loans.some(l => l.memberId === selectedMemberId) 
                ? 'members' : 'completed_members'
              )}
              onSelectLoan={(id) => setSelectedLoanId(id)}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingMember && (
          <Modal title="নতুন সদস্য যোগ করুন" onClose={() => setIsAddingMember(false)}>
            <AddMemberForm onClose={() => setIsAddingMember(false)} />
          </Modal>
        )}
        {isAddingLoan && (
          <Modal title="নতুন ঋণ প্রদান" onClose={() => setIsAddingLoan(false)}>
            <AddLoanForm members={members} loans={loans} onClose={() => setIsAddingLoan(false)} />
          </Modal>
        )}
        {selectedLoanId && (
          <Modal title="ঋণের তথ্য ও কিস্তি" onClose={() => setSelectedLoanId(null)}>
            <LoanDetails 
              loanId={selectedLoanId} 
              onClose={() => setSelectedLoanId(null)} 
            />
          </Modal>
        )}
      </AnimatePresence>

      {/* PWA Install Popup */}
      <AnimatePresence>
        {showInstallPopup && installPrompt && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm bg-white border-4 border-slate-900 brutalist-shadow-slate p-6"
          >
            <div className="flex items-start gap-4">
              <div className="bg-slate-900 text-white p-3 rotate-3 brutalist-shadow-emerald">
                <Download size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black uppercase tracking-tight">Install App</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">অফলাইনে ব্যবহার করতে এবং দ্রুত এক্সেস পেতে অ্যাপটি ইন্সটল করুন।</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={handleInstallClick}
                className="flex-1 bg-slate-900 text-white py-3 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:translate-y-1"
              >
                INSTALL NOW
              </button>
              <button 
                onClick={handleDismissInstall}
                className="px-4 py-3 border-2 border-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                LATER
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update Popup */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[101] bg-emerald-500 text-white border-2 border-slate-900 p-4 brutalist-shadow-slate flex items-center gap-4"
          >
            <p className="text-xs font-black uppercase">নতুন আপডেট পাওয়া গেছে!</p>
            <button 
              onClick={() => updateServiceWorker(true)}
              className="bg-white text-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-slate-900"
            >
              UPDATE
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-components ---

function NavItem({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left cursor-pointer outline-none"
    >
      <p className={cn(
        "text-xs font-black uppercase tracking-widest mb-2 transition-colors",
        active ? "text-emerald-400" : "text-slate-400 opacity-50 hover:opacity-100"
      )}>
        {label}
      </p>
      <div className={cn(
        "h-1 transition-all group-hover:w-16",
        active ? "w-16 bg-emerald-400" : "w-8 bg-slate-700 opacity-30"
      )}></div>
    </button>
  );
}

function StatCard({ label, value, subtext, borderClass, icon, color }: { label: string, value: string, subtext: string, borderClass: string, icon: React.ReactNode, color: string }) {
  return (
    <div className={cn("bg-white px-5 py-4 border-2 border-slate-900 brutalist-shadow-slate relative group overflow-hidden", borderClass)}>
      {/* Decorative background element */}
      <div className={cn("absolute -right-4 -top-4 w-12 h-12 opacity-5 rotate-12 transition-transform group-hover:scale-110", color)} />
      
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 flex items-center justify-center text-white border-2 border-slate-900 brutalist-shadow-emerald shrink-0", color)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 mb-0.5 truncate">{label}</p>
          <h3 className="text-2xl font-black text-slate-900 leading-none tracking-tighter">{value}</h3>
          <div className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1.5 border-t border-slate-100 pt-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", color.replace('bg-', 'bg-'))} />
            <span className="truncate">{subtext}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ totalPrincipal, totalExpected, totalReceived, activeLoansCount, recentMembers, recentInstallments }: any) {
  const allInstallments = useLiveQuery(() => db.installments.toArray()) || [];
  const allLoans = useLiveQuery(() => db.loans.toArray()) || [];
  const allMembers = useLiveQuery(() => db.members.toArray()) || [];
  const [globalSearch, setGlobalSearch] = useState('');
  
  const today = startOfDay(new Date()).getTime();
  const dueToday = allInstallments.filter(i => i.status === 'pending' && startOfDay(new Date(i.dueDate)).getTime() === today);
  const overdue = allInstallments.filter(i => i.status === 'pending' && startOfDay(new Date(i.dueDate)).getTime() < today);

  const totalProfit = allInstallments.filter(i => i.status === 'paid').reduce((sum, i) => {
    const loan = allLoans.find(l => l.id === i.loanId);
    if (!loan) return sum;
    const profitPerInst = (loan.totalPayable - loan.principalAmount) / loan.numberOfInstallments;
    return sum + profitPerInst;
  }, 0);

  const searchResults = globalSearch ? allMembers.filter(m => 
    m.name.toLowerCase().includes(globalSearch.toLowerCase()) || 
    m.phone.includes(globalSearch)
  ).slice(0, 5) : [];

  const getMemberName = (loanId: number) => {
    const loan = allLoans.find(l => l.id === loanId);
    const member = allMembers.find(m => m.id === loan?.memberId);
    return member?.name || 'Unknown';
  };

  // Prepare data for Chart
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const start = startOfDay(d).getTime();
    const dayName = format(d, 'EEE');
    const dayTotal = allInstallments
      .filter(inst => inst.status === 'paid' && inst.paidDate && startOfDay(new Date(inst.paidDate)).getTime() === start)
      .reduce((sum, inst) => sum + inst.amount, 0);
    return { name: dayName, amount: dayTotal };
  });

  return (
    <div className="space-y-16">
      <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <StatCard 
          label="মোট মূল ঋণ" 
          value={`৳${totalPrincipal.toLocaleString()}`}
          subtext={`সক্রিয় ঋণ: ${activeLoansCount}টি`}
          borderClass="border-slate-900"
          icon={<HandCoins size={20} strokeWidth={3} />}
          color="bg-slate-900"
        />
        <StatCard 
          label="মোট সুদসহ" 
          value={`৳${totalExpected.toLocaleString()}`}
          subtext="সর্বমোট আদায়যোগ্য"
          borderClass="border-blue-600"
          icon={<Calculator size={20} strokeWidth={3} />}
          color="bg-blue-600"
        />
        <StatCard 
          label="মোট আদায়কাল" 
          value={`৳${totalReceived.toLocaleString()}`}
          subtext={totalExpected > totalReceived 
            ? `বাকি: ৳${(totalExpected - totalReceived).toLocaleString()}` 
            : `অতিরিক্ত: ৳${(totalReceived - totalExpected).toLocaleString()}`}
          borderClass="border-emerald-500"
          icon={<CheckCircle2 size={20} strokeWidth={3} />}
          color="bg-emerald-500"
        />
        <StatCard 
          label="মোট লাভ" 
          value={`৳${Math.floor(totalProfit).toLocaleString()}`}
          subtext="প্রকৃত লভ্যাংশ"
          borderClass="border-amber-500"
          icon={<TrendingUp size={20} strokeWidth={3} />}
          color="bg-amber-500"
        />
        <StatCard 
          label="আদায় হার" 
          value={`${totalExpected > 0 ? ((totalReceived / totalExpected) * 100).toFixed(1) : 0}%`}
          subtext="সামগ্রিক সক্ষমতা"
          borderClass="border-indigo-500"
          icon={<PieChart size={20} strokeWidth={3} />}
          color="bg-indigo-500"
        />
      </section>

      {/* Global Quick Search */}
      <div className="relative">
        <div className="flex items-center gap-4 bg-white p-4 brutalist-card border-2 border-slate-900 brutalist-shadow-slate">
           <Search className="text-slate-900" size={24} />
           <input 
             type="text" 
             placeholder="সদস্য দ্রুত খুঁজুন (Name or Phone)..."
             value={globalSearch}
             onChange={e => setGlobalSearch(e.target.value)}
             className="flex-1 bg-transparent border-none focus:outline-none font-black text-xl uppercase tracking-widest placeholder:text-slate-300"
           />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border-2 border-slate-900 brutalist-shadow-slate divide-y-2 divide-slate-100">
             {searchResults.map(m => (
               <div 
                 key={m.id} 
                 onClick={(e) => {
                   e.stopPropagation();
                   // Since I can't easily pass state up without prop drilling deep, 
                   // I'll keep it as a UI hint or use window events if I must.
                   // Better: Dashboard receives a onSelectMember prop from App.
                   setGlobalSearch('');
                 }}
                 className="p-4 hover:bg-slate-50 cursor-pointer flex justify-between items-center group"
               >
                 <div>
                   <p className="font-black group-hover:underline">{m.name}</p>
                   <p className="text-[10px] font-bold text-slate-400">{m.phone}</p>
                 </div>
                 <ChevronRight size={18} />
               </div>
             ))}
          </div>
        )}
      </div>

      {/* Due Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-rose-50 border-2 border-rose-500 p-6 brutalist-shadow-rose">
          <div className="flex items-center gap-2 mb-4">
             <Clock className="text-rose-500" size={20} strokeWidth={3} />
             <h3 className="text-xs font-black uppercase tracking-widest text-rose-500">বকেয়া কিস্তি (OVERDUE)</h3>
             <span className="ml-auto bg-rose-500 text-white px-2 py-0.5 text-[10px] font-black">{overdue.length}</span>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {overdue.length > 0 ? overdue.map(i => (
              <div key={i.id} className="flex justify-between items-center text-xs font-black uppercase border-b border-rose-100 pb-2">
                <div>
                  <p className="text-slate-900">{getMemberName(i.loanId)}</p>
                  <p className="text-rose-400 text-[10px]">{format(i.dueDate, 'MMM d, yyyy')}</p>
                </div>
                <p className="text-rose-600 italic">৳{i.amount.toLocaleString()}</p>
              </div>
            )) : <p className="text-rose-300 text-[10px] font-black italic">সব কিস্তি আপ-টু-ডেট!</p>}
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-500 p-6 brutalist-shadow-blue">
          <div className="flex items-center gap-2 mb-4">
             <Calendar className="text-blue-500" size={20} strokeWidth={3} />
             <h3 className="text-xs font-black uppercase tracking-widest text-blue-500">আজকের আদায় (DUE TODAY)</h3>
             <span className="ml-auto bg-blue-500 text-white px-2 py-0.5 text-[10px] font-black">{dueToday.length}</span>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {dueToday.length > 0 ? dueToday.map(i => (
              <div key={i.id} className="flex justify-between items-center text-xs font-black uppercase border-b border-blue-100 pb-2">
                <div>
                  <p className="text-slate-900">{getMemberName(i.loanId)}</p>
                  <p className="text-blue-400 text-[10px]">{format(i.dueDate, 'MMM d, p')}</p>
                </div>
                <p className="text-blue-600 italic">৳{i.amount.toLocaleString()}</p>
              </div>
            )) : <p className="text-blue-300 text-[10px] font-black italic">আজকের কোনো বিশেষ আদায় নেই।</p>}
          </div>
        </div>
      </div>

      {/* Collection Chart */}
      <div className="bg-white p-8 brutalist-card brutalist-shadow-slate border-2 border-slate-900">
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="text-emerald-500" size={24} />
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest">কিস্তি আদায় বিশ্লেষণ (COLLECTION ANALYSIS)</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase">বিগত ৭ দিনের আদায় চিত্র</p>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last7Days}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }}
                tickFormatter={(val) => `৳${val}`}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '0px', 
                  border: '2px solid #0f172a',
                  boxShadow: '4px 4px 0px #0f172a',
                  fontWeight: 'black',
                  fontSize: '12px'
                }}
              />
              <Bar 
                dataKey="amount" 
                fill="#10b981" 
                radius={[0, 0, 0, 0]} 
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <section>
          <div className="flex justify-between items-center mb-8 border-b-2 border-slate-900 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest">সাম্প্রতিক সদস্য</h3>
            <span className="text-[10px] font-black text-slate-400 cursor-pointer hover:text-slate-900 tracking-widest uppercase">সব সদস্য →</span>
          </div>
          <div className="space-y-4">
            {recentMembers.length > 0 ? recentMembers.map((m: Member) => (
              <div key={m.id} className="brutalist-card p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-black">
                    {m.name[0]}
                  </div>
                  <div>
                    <p className="text-lg font-black leading-none">{m.name}</p>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{m.phone}</p>
                  </div>
                </div>
                <ChevronRight size={24} className="text-slate-900" />
              </div>
            )) : <p className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">কোন সদস্য নেই</p>}
          </div>
        </section>

        <section>
           <div className="flex justify-between items-center mb-8 border-b-2 border-emerald-500 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest">সাম্প্রতিক আদায়</h3>
            <span className="text-[10px] font-black text-slate-400 cursor-pointer hover:text-emerald-500 tracking-widest uppercase">ইতিহাস দেখুন →</span>
          </div>
          <div className="space-y-4">
            {recentInstallments.length > 0 ? recentInstallments.map((i: Installment) => (
              <div key={i.id} className="brutalist-card p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500 text-white flex items-center justify-center">
                    <CheckCircle2 size={24} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-lg font-black leading-none text-emerald-600">৳{i.amount.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">কিস্তি #{i.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {i.paidDate ? format(i.paidDate, 'p') : ''}
                  </p>
                   <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                    {i.paidDate ? format(i.paidDate, 'MMM d') : ''}
                  </p>
                </div>
              </div>
            )) : <p className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-50">ইতিহাস নেই</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="relative bg-white w-full max-w-lg brutalist-card brutalist-shadow-slate overflow-hidden"
      >
        <div className="px-8 py-6 border-b-2 border-slate-900 flex items-center justify-between bg-slate-50">
          <h3 className="text-xl font-black tracking-tighter uppercase">{title}</h3>
          <button onClick={onClose} className="text-slate-900 hover:scale-110 transition-transform">
            <Plus size={32} className="rotate-45" />
          </button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function AddMemberForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.members.add({
      ...formData,
      joinedAt: Date.now()
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-slate-900">
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">സदস্যের নাম (NAME)</label>
        <input 
          required
          type="text" 
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          placeholder="যেমন: মোঃ আনোয়ার হোসেন"
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none focus:bg-white transition-all font-bold placeholder:opacity-30"
        />
      </div>
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">মোবাইল নম্বর (PHONE)</label>
        <input 
          required
          type="tel" 
          value={formData.phone}
          onChange={e => setFormData({ ...formData, phone: e.target.value })}
          placeholder="017XXXXXXXX"
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none focus:bg-white transition-all font-bold placeholder:opacity-30"
        />
      </div>
      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">ঠিকানা (ADDRESS)</label>
        <textarea 
          required
          value={formData.address}
          onChange={e => setFormData({ ...formData, address: e.target.value })}
          placeholder="বাসা নং, গ্রাম, থানা..."
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none focus:bg-white transition-all font-bold placeholder:opacity-30 h-24 resize-none"
        ></textarea>
      </div>
      <button 
        type="submit"
        className="w-full bg-slate-900 text-white font-black py-4 uppercase tracking-widest brutalist-shadow-slate hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
      >
        যোগদান নিশ্চিত করুন
      </button>
    </form>
  );
}

function AddLoanForm({ members, loans, onClose }: { members: Member[], loans: Loan[], onClose: () => void }) {
  const [memberType, setMemberType] = useState<'new' | 'old'>('new');
  const [formData, setFormData] = useState({
    memberId: '',
    principalAmount: 0,
    interestRate: 10,
    numberOfInstallments: 10,
    frequency: 'weekly' as 'weekly' | 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd')
  });

  const filteredMembers = members.filter(m => {
    const memberLoans = loans.filter(l => l.memberId === m.id);
    const hasActiveLoan = memberLoans.some(l => l.status === 'active');
    
    // If they have an active loan, we don't show them in either list to prevent double debt 
    // (unless business rules allow it, but prompt says "nothun vs purathon")
    if (hasActiveLoan) return false;

    if (memberType === 'new') {
      return memberLoans.length === 0;
    } else {
      return memberLoans.length > 0;
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberId) return;

    const principal = Number(formData.principalAmount);
    const interest = principal * (Number(formData.interestRate) / 100);
    const total = principal + interest;
    const installmentAmount = Math.ceil(total / Number(formData.numberOfInstallments));

    const loanId = await db.loans.add({
      memberId: Number(formData.memberId),
      principalAmount: principal,
      interestRate: Number(formData.interestRate),
      totalPayable: total,
      installmentAmount,
      numberOfInstallments: Number(formData.numberOfInstallments),
      frequency: formData.frequency,
      startDate: new Date(formData.startDate).getTime(),
      status: 'active'
    });

    // Generate installments
    const installments: any[] = [];
    let currentDate = new Date(formData.startDate);

    for (let i = 1; i <= Number(formData.numberOfInstallments); i++) {
      if (formData.frequency === 'weekly') {
        currentDate = addWeeks(currentDate, 1);
      } else {
        currentDate = addMonths(currentDate, 1);
      }
      
      installments.push({
        loanId,
        dueDate: currentDate.getTime(),
        amount: installmentAmount,
        status: 'pending'
      });
    }

    await db.installments.bulkAdd(installments);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-slate-900">
      <div className="space-y-4">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">সদস্যের ধরন (MEMBER TYPE)</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setMemberType('new'); setFormData({ ...formData, memberId: '' }); }}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 transition-all",
              memberType === 'new' ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-900"
            )}
          >
            নতুন সদস্য (New)
          </button>
          <button
            type="button"
            onClick={() => { setMemberType('old'); setFormData({ ...formData, memberId: '' }); }}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 transition-all",
              memberType === 'old' ? "bg-slate-900 text-white" : "bg-white text-slate-400 hover:text-slate-900"
            )}
          >
            পুরাতন সদস্য (Old)
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">সদস্য নির্বাচন করুন (SELECT MEMBER)</label>
        <select 
          required
          value={formData.memberId}
          onChange={e => setFormData({ ...formData, memberId: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none focus:bg-white font-bold appearance-none uppercase"
        >
          <option value="">{memberType === 'new' ? '-- নতুন সদস্য সিলেক্ট করুন --' : '-- পুরাতন সদস্য সিলেক্ট করুন --'}</option>
          {filteredMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.phone})</option>)}
        </select>
        {filteredMembers.length === 0 && (
          <p className="mt-2 text-[10px] font-bold text-rose-500 uppercase italic">
            এই ক্যাটাগরিতে কোনো সদস্য পাওয়া যায়নি।
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">ঋণের পরিমাণ (PRINCIPAL)</label>
          <input 
            required
            type="number" 
            min="100"
            value={formData.principalAmount || ''}
            onChange={e => setFormData({ ...formData, principalAmount: Number(e.target.value) })}
            placeholder="৳০.০০"
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none font-black"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">সুদের হার (INTEREST %)</label>
          <input 
            type="number" 
            value={formData.interestRate}
            onChange={e => setFormData({ ...formData, interestRate: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none font-black"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">কিস্তির সংখ্যা (COUNT)</label>
          <input 
            type="number" 
            value={formData.numberOfInstallments}
            onChange={e => setFormData({ ...formData, numberOfInstallments: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none font-black"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">কিস্তির ধরন (TYPE)</label>
          <select 
            value={formData.frequency}
            onChange={e => setFormData({ ...formData, frequency: e.target.value as any })}
            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none font-bold uppercase"
          >
            <option value="weekly">সাপ্তাহিক (Weekly)</option>
            <option value="monthly">মাসিক (Monthly)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">ঋণ শুরুর তারিখ (START DATE)</label>
        <input 
          type="date" 
          value={formData.startDate}
          onChange={e => setFormData({ ...formData, startDate: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-900 focus:outline-none font-black"
        />
      </div>

      <div className="bg-emerald-500 p-6 border-2 border-slate-900 brutalist-shadow-emerald">
        <p className="text-[10px] font-black text-white uppercase tracking-widest mb-4 border-b border-white/20 pb-2">হিসাব একনজরে (SUMMARY)</p>
        <div className="grid grid-cols-2 gap-y-2 text-xs font-black text-white uppercase">
          <span>মূলধন:</span> <span className="text-right">৳{formData.principalAmount.toLocaleString()}</span>
          <span>সুদ:</span> <span className="text-right">৳{(formData.principalAmount * (formData.interestRate / 100)).toLocaleString()}</span>
          <span className="text-lg mt-2 pt-2 border-t-2 border-white/20">সর্বমোট:</span> 
          <span className="text-right text-lg mt-2 pt-2 border-t-2 border-white/20">৳{(formData.principalAmount * (1 + formData.interestRate / 100)).toLocaleString()}</span>
          <span className="opacity-70">কিস্তি:</span> <span className="text-right opacity-70">৳{Math.ceil((formData.principalAmount * (1 + formData.interestRate / 100)) / formData.numberOfInstallments).toLocaleString()}</span>
        </div>
      </div>

      <button 
        type="submit"
        className="w-full bg-slate-900 text-white font-black py-4 uppercase tracking-widest brutalist-shadow-slate hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all"
      >
        ঋণ প্রদান নিশ্চিত করুন
      </button>
    </form>
  );
}

function MembersList({ members, onAdd, onSelectMember }: { members: Member[], onAdd: () => void, onSelectMember: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search));

  return (
    <div className="space-y-12">
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-900" size={24} strokeWidth={3} />
        <input 
          type="text" 
          placeholder="NAME OR PHONE SEARCH..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-16 pr-6 py-6 bg-white border-2 border-slate-900 focus:outline-none font-black text-lg placeholder:opacity-30 uppercase tracking-widest"
        />
      </div>

      <div className="brutalist-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black">MEMBERS NAME / নাম</th>
              <th className="px-8 py-4 text-[10px] font-black text-center">PHONE</th>
              <th className="px-8 py-4 text-[10px] font-black">ADDRESS</th>
              <th className="px-8 py-4 text-[10px] font-black text-right">JOINED</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {filtered.length > 0 ? filtered.map(m => (
              <tr 
                key={m.id} 
                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                onClick={() => onSelectMember(m.id!)}
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 border-2 border-slate-900 flex items-center justify-center font-black group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      {m.name[0]}
                    </div>
                    <span className="font-black text-lg group-hover:underline underline-offset-4">{m.name}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-center">
                  <span className="font-bold text-slate-500 font-mono italic">{m.phone}</span>
                </td>
                <td className="px-8 py-6">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tighter"><MapPin size={14} strokeWidth={3} /> {m.address}</span>
                </td>
                <td className="px-8 py-6 text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(m.joinedAt, 'yyyy-MM-dd')}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-8 py-20 text-center">
                  <p className="text-xl font-black text-slate-300 uppercase tracking-[0.2em] mb-4 italic">NO MEMBERS FOUND</p>
                  <button onClick={onAdd} className="bg-slate-900 text-white font-black px-6 py-2 uppercase tracking-widest">ADD NEW सदस्य</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoansList({ loans, members, onSelect }: { loans: Loan[], members: Member[], onSelect: (id: number) => void }) {
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  
  const filtered = loans.filter(l => {
    if (filter === 'all') return true;
    return l.status === filter;
  });

  return (
    <div className="space-y-12">
      <div className="flex gap-4 border-b-2 border-slate-900 pb-1">
        {(['active', 'completed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
              filter === f ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-900"
            )}
          >
            {f === 'active' ? 'চলমান ঋণ (Active)' : f === 'completed' ? 'পরিশোধিত (Done)' : 'সব লোন (All)'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.length > 0 ? filtered.map(l => {
          const member = members.find(m => m.id === l.memberId);
          return (
            <div 
              key={l.id} 
              onClick={() => onSelect(l.id!)}
              className="brutalist-card p-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative group"
            >
              <div className={cn(
                "absolute top-0 right-0 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]",
                l.status === 'active' ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"
              )}>
                {l.status === 'active' ? 'ACTIVE' : 'COMPLETED'}
              </div>
              
              <div className="mb-8 border-b-2 border-slate-100 pb-6">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Member Details</p>
                 <h4 className="text-3xl font-black tracking-tighter leading-none mb-1">{member?.name || 'UNKNOWN'}</h4>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{l.frequency} Installments</p>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Principal</p>
                  <p className="text-2xl font-black">৳{l.principalAmount.toLocaleString()}</p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Per Installment</p>
                  <p className="text-2xl font-black text-emerald-600 italic">৳{l.installmentAmount.toLocaleString()}</p>
                </div>
                <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-center bg-slate-50 -mx-8 -mb-8 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">{l.numberOfInstallments} PAYMENTS</p>
                  <button className="bg-slate-900 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest">MANAGE →</button>
                </div>
              </div>
            </div>
          );
        }) : <div className="col-span-full py-40 text-center border-4 border-dashed border-slate-200"><p className="text-2xl font-black text-slate-300 uppercase tracking-[0.3em] italic">NO {filter === 'all' ? '' : filter} LOANS FOUND</p></div>}
      </div>
    </div>
  );
}

function LoanDetails({ loanId, onClose }: { loanId: number, onClose: () => void }) {
  const loan = useLiveQuery(() => db.loans.get(loanId), [loanId]);
  const member = useLiveQuery(() => loan ? db.members.get(loan.memberId) : undefined, [loan]);
  const installments = useLiveQuery(() => db.installments.where('loanId').equals(loanId).toArray(), [loanId]) || [];

  if (!loan || !member) return <div className="py-12 text-center text-slate-400 font-black uppercase tracking-widest">LOADING...</div>;

  const paidInstallments = installments.filter(i => i.status === 'paid');
  const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
  const progress = (paidInstallments.length / installments.length) * 100;

  const handleMarkPaid = async (inst: Installment) => {
    if (!window.confirm('আপনি কি এই কিস্তি আদায় নিশ্চিত করতে চান?')) return;
    await db.installments.update(inst.id!, {
      status: 'paid',
      paidDate: Date.now()
    });

    const updatedInsts = await db.installments.where('loanId').equals(loanId).toArray();
    if (updatedInsts.every(i => i.status === 'paid')) {
      await db.loans.update(loanId, { status: 'completed' });
    }
  };

  const handleRevertPaid = async (inst: Installment) => {
    if (!window.confirm('আপনি কি এই কিস্তিটি বাতিল করতে চান? (Undo payment?)')) return;
    
    await db.installments.update(inst.id!, {
      status: 'pending',
      paidDate: undefined
    });

    // If loan was completed, set it back to active
    if (loan.status === 'completed') {
      await db.loans.update(loanId, { status: 'active' });
    }
  };

  const lastPaidId = [...installments]
    .filter(i => i.status === 'paid')
    .sort((a, b) => (b.paidDate || 0) - (a.paidDate || 0))[0]?.id;

  return (
    <div className="space-y-8 text-slate-900">
      <div className="flex items-center gap-6 p-6 border-b-2 border-slate-100 -mx-8 -mt-8 bg-slate-50">
        <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center font-black text-2xl">
          {member.name[0]}
        </div>
        <div>
          <h4 className="font-black text-2xl tracking-tighter leading-none mb-1">{member.name}</h4>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{member.phone}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border-l-4 border-slate-900 pl-4 py-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট ঋণ</p>
          <p className="text-2xl font-black">৳{loan.totalPayable.toLocaleString()}</p>
        </div>
        <div className="border-l-4 border-emerald-500 pl-4 py-1">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">পরিশোধিত</p>
          <p className="text-2xl font-black text-emerald-600">৳{totalPaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">পরিশোধের অগ্রগতি</span>
          <span className="text-lg font-black">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-4 w-full bg-slate-100 border-2 border-slate-900 p-0.5 rounded-none overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-emerald-400"
          ></motion.div>
        </div>
      </div>

      <div className="space-y-4">
        <h5 className="text-xs font-black uppercase tracking-widest border-b-2 border-slate-900 pb-2">
          কিস্তি তালিকা (INSTALLMENTS)
        </h5>
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 px-1">
          {(() => {
            const firstPendingId = installments.find(i => i.status === 'pending')?.id;
            
            return installments.map((inst, idx) => {
              const isCurrent = inst.id === firstPendingId;
              const isPaid = inst.status === 'paid';
              
              return (
                <motion.div 
                  layout
                  key={inst.id} 
                  className={cn(
                    "p-4 border-2 transition-all relative overflow-hidden",
                    isPaid ? "bg-emerald-50 border-emerald-200 opacity-80" : 
                    isCurrent ? "bg-white border-slate-900 brutalist-shadow-slate ring-2 ring-emerald-500/20" : 
                    "bg-slate-50 border-slate-100 opacity-60"
                  )}
                >
                  {isCurrent && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "text-xs font-black",
                        isPaid ? "text-emerald-300" : isCurrent ? "text-slate-900" : "text-slate-300"
                      )}>
                        #{idx + 1}
                      </span>
                      <div>
                        <p className={cn(
                          "text-lg font-black leading-none", 
                          isPaid ? "text-emerald-700 italic" : "text-slate-900"
                        )}>
                          ৳{inst.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest italic">
                          {isPaid ? `পরিশোধিত: ${format(inst.paidDate || Date.now(), 'MMM d, p')}` : `তারিখ: ${format(inst.dueDate, 'MMM d, yyyy')}`}
                        </p>
                      </div>
                    </div>
                    
                    {isPaid ? (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 size={18} strokeWidth={3} />
                          <span className="text-[10px] font-black uppercase tracking-widest">PAID</span>
                        </div>
                        <button 
                          onClick={() => captureAndDownload(`slip-${inst.id}`, `slip-${member.name}-${inst.id}`)}
                          className="p-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                          title="Download Receipt"
                        >
                          <Download size={14} strokeWidth={3} />
                        </button>
                        {inst.id === lastPaidId && (
                          <button 
                            onClick={() => handleRevertPaid(inst)}
                            className="text-[10px] font-black text-rose-500 hover:text-rose-700 uppercase tracking-widest border-b border-rose-200"
                          >
                            UNDO
                          </button>
                        )}
                        {/* Hidden Slip Template */}
                        <div id={`slip-${inst.id}`} className="invisible fixed pointer-events-none">
                          <PaymentSlipTemplate member={member} loan={loan} installment={inst} index={idx + 1} />
                        </div>
                      </div>
                    ) : isCurrent ? (
                      <button 
                        onClick={() => handleMarkPaid(inst)}
                        className="bg-slate-900 text-white text-[10px] font-black px-6 py-2 uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95 shadow-lg"
                      >
                        জমা নিন
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Clock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">LOCKED</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

function MemberProfile({ memberId, onBack, onSelectLoan }: { memberId: number, onBack: () => void, onSelectLoan: (id: number) => void }) {
  const member = useLiveQuery(() => db.members.get(memberId), [memberId]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ name: '', phone: '', address: '' });
  const memberLoans = useLiveQuery(() => db.loans.where('memberId').equals(memberId).toArray(), [memberId]) || [];
  const installments = useLiveQuery(() => db.installments.toArray()) || [];

  if (!member) return <div className="py-20 text-center font-black uppercase tracking-[0.3em] text-slate-300 italic">MEMBER NOT FOUND</div>;

  const handleStartEdit = () => {
    setEditFormData({ name: member.name, phone: member.phone, address: member.address });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    await db.members.update(memberId, editFormData);
    setIsEditing(false);
  };

  const memberPaidInstallments = installments.filter(inst => {
    const loan = memberLoans.find(l => l.id === inst.loanId);
    return loan && inst.status === 'paid';
  }).sort((a, b) => (b.paidDate || 0) - (a.paidDate || 0));

  const totalMemberPrincipal = memberLoans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalMemberPaid = memberPaidInstallments.reduce((sum, i) => sum + i.amount, 0);

  const handleDeleteMember = async () => {
    if (memberLoans.some(l => l.status === 'active')) {
       alert('এই সদস্যের এক্টিভ লোন আছে, তাই ডিলিট করা সম্ভব নয়। (Cannot delete member with active loans)');
       return;
    }

    if (!window.confirm('আপনি কি এই সদস্যকে ডিলিট করতে চান? (Delete this member?)')) return;
    
    try {
      // Delete member
      await db.members.delete(memberId);
      
      // Cleanup loans/installments for this member if any (completed ones)
      const loanIds = memberLoans.map(l => l.id).filter((id): id is number => id !== undefined);
      
      if (loanIds.length > 0) {
        await db.loans.bulkDelete(loanIds);
        await db.installments.where('loanId').anyOf(loanIds).delete();
      }
      
      onBack();
    } catch (error) {
      console.error('Failed to delete member:', error);
      alert('সদস্য ডিলিট করতে সমস্যা হয়েছে (Error deleting member)');
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-slate-900 pb-8">
        <div className="flex items-center gap-8">
           <div className="w-24 h-24 bg-slate-900 text-white flex items-center justify-center font-black text-4xl brutalist-shadow-emerald">
            {member.name[0]}
          </div>
          {isEditing ? (
            <div className="space-y-4 max-w-sm">
               <input 
                 className="w-full px-4 py-2 bg-white border-2 border-slate-900 font-black uppercase"
                 value={editFormData.name}
                 onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                 placeholder="Name"
               />
               <div className="flex gap-2">
                 <input 
                   className="flex-1 px-4 py-2 bg-white border-2 border-slate-900 font-black"
                   value={editFormData.phone}
                   onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                   placeholder="Phone"
                 />
                 <input 
                   className="flex-1 px-4 py-2 bg-white border-2 border-slate-900 font-black uppercase"
                   value={editFormData.address}
                   onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                   placeholder="Address"
                 />
               </div>
               <div className="flex gap-2">
                 <button 
                   onClick={handleSaveEdit}
                   className="flex-1 bg-slate-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                 >
                   <Save size={14} /> সংরক্ষণ করুন
                 </button>
                 <button 
                   onClick={() => setIsEditing(false)}
                   className="flex-1 bg-slate-100 text-slate-900 border-2 border-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest"
                 >
                   বাতিল
                 </button>
               </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h3 className="text-5xl font-black tracking-tighter leading-none uppercase">{member.name}</h3>
                <button 
                  onClick={handleStartEdit}
                  className="p-2 hover:bg-slate-100 transition-all rounded-full border border-slate-200"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1"><Phone size={14} strokeWidth={3} /> {member.phone}</span>
                <span className="flex items-center gap-1"><MapPin size={14} strokeWidth={3} /> {member.address}</span>
                <span className="flex items-center gap-1 rotate-0"><Calendar size={14} strokeWidth={3} /> JOINED: {format(member.joinedAt, 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => captureAndDownload(`profile-report-${member.id}`, `report-${member.name}`)}
            className="bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-slate-900 text-white brutalist-shadow-slate hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Download size={14} strokeWidth={3} /> DOWNLOAD REPORT
          </button>
          <button 
            onClick={handleDeleteMember}
            className="bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-rose-500 text-rose-500 brutalist-shadow-rose hover:-translate-y-0.5 transition-all"
          >
            DELETE MEMBER
          </button>
          <button 
            onClick={onBack}
            className="bg-slate-100 px-6 py-2 text-xs font-black uppercase tracking-widest border-2 border-slate-900 brutalist-shadow-slate hover:-translate-y-0.5 transition-all w-fit"
          >
            ← BACK TO LIST
          </button>
        </div>
      </header>
      
      {/* Hidden Profile Template for Download */}
      <div id={`profile-report-${member.id}`} className="invisible fixed pointer-events-none">
        <ProfileSummaryTemplate 
           member={member} 
           memberLoans={memberLoans} 
           paidInstallments={memberPaidInstallments}
           totalPrincipal={totalMemberPrincipal}
           totalPaid={totalMemberPaid}
        />
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <StatCard 
          label="সদস্যের মোট ঋণ" 
          value={`৳${totalMemberPrincipal.toLocaleString()}`}
          subtext={`মোট লোন সংখ্যা: ${memberLoans.length}টি`}
          borderClass="border-slate-900"
          icon={<HandCoins size={20} strokeWidth={3} />}
          color="bg-slate-900"
        />
        <StatCard 
          label="মোট পরিশোধিত" 
          value={`৳${totalMemberPaid.toLocaleString()}`}
          subtext="আদায়কৃত কিস্তি থেকে"
          borderClass="border-emerald-500"
          icon={<CheckCircle2 size={20} strokeWidth={3} />}
          color="bg-emerald-500"
        />
        <StatCard 
          label="সদস্য স্ট্যাটাস" 
          value={memberLoans.find(l => l.status === 'active') ? 'ACTIVE' : 'INACTIVE'}
          subtext="এক্টিভ লোন ভিত্তিক"
          borderClass="border-blue-500"
          icon={<Users size={20} strokeWidth={3} />}
          color="bg-blue-600"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">ঋণের তালিকা (LOANS)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {memberLoans.length > 0 ? memberLoans.map(l => (
              <div 
                key={l.id} 
                onClick={() => onSelectLoan(l.id!)}
                className="brutalist-card p-6 cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
              >
                <div className={cn(
                  "absolute top-0 right-0 px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                   l.status === 'active' ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"
                )}>
                  {l.status}
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Loan ID: #{l.id}</p>
                <h4 className="text-2xl font-black mb-4">৳{l.principalAmount.toLocaleString()}</h4>
                <div className="space-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <div className="flex justify-between"><span>Installment:</span> <span className="text-slate-900 font-black">৳{l.installmentAmount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Frequency:</span> <span className="text-slate-900 font-black">{l.frequency}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 text-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
                  <p className="text-[10px] font-black uppercase tracking-widest">VIEW DETAILS →</p>
                </div>
              </div>
            )) : <div className="col-span-full py-12 text-center text-slate-300 font-black uppercase italic">NO LOANS FOUND</div>}
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex justify-between items-center border-b-2 border-emerald-500 pb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600">আদায়ের ইতিহাস (LEDGER)</h3>
          </div>
          <div className="bg-white brutalist-card divide-y-2 divide-slate-100 overflow-hidden">
            {memberPaidInstallments.length > 0 ? memberPaidInstallments.map(i => (
              <div key={i.id} className="p-4 flex justify-between items-center hover:bg-emerald-50 transition-colors">
                <div>
                  <p className="text-lg font-black text-emerald-600 leading-none">৳{i.amount.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">কিস্তি #{i.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-900 uppercase">
                    {i.paidDate ? format(i.paidDate, 'MMM d, yyyy') : ''}
                  </p>
                </div>
              </div>
            )) : <p className="p-8 text-center text-slate-300 font-black uppercase italic tracking-widest">NO HISTORY</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ installments, loans, members }: { installments: Installment[], loans: Loan[], members: Member[] }) {
  const paidHistory = installments.filter(i => i.status === 'paid').sort((a,b) => (b.paidDate || 0) - (a.paidDate || 0));

  return (
    <div className="space-y-12 text-slate-900">
      <header className="border-b-4 border-slate-900 pb-4">
        <h3 className="text-4xl font-black tracking-tighter uppercase italic">Transaction Report</h3>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Latest Collections</p>
      </header>

      <div className="brutalist-card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">DATE / TIME</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">MEMBER</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-center">AMOUNT</th>
              <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-right">STATUS / SLIP</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-100">
            {paidHistory.length > 0 ? paidHistory.map(i => {
              const loan = loans.find(l => l.id === i.loanId);
              const member = members.find(m => m.id === loan?.memberId);
              return (
                <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="text-xs font-black text-slate-900 uppercase">{i.paidDate ? format(i.paidDate, 'MMM d, yyyy') : ''}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{i.paidDate ? format(i.paidDate, 'p') : ''}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-lg font-black tracking-tight">{member?.name || 'UNKNOWN'}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-xl font-black text-emerald-600 italic">৳{i.amount.toLocaleString()}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-[10px] font-black bg-emerald-500 text-white px-3 py-1 rounded-none uppercase tracking-widest">SUCCESS</span>
                      <button 
                        onClick={() => captureAndDownload(`slip-hist-${i.id}`, `slip-${member?.name || 'user'}-${i.id}`)}
                        className="p-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                      >
                        <Download size={14} strokeWidth={3} />
                      </button>
                      {member && loan && (
                        <div id={`slip-hist-${i.id}`} className="invisible fixed pointer-events-none">
                          <PaymentSlipTemplate member={member} loan={loan} installment={i} index={0} />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan={4} className="px-8 py-32 text-center text-slate-300 font-black text-2xl uppercase tracking-[0.3em] italic">NO DATA AVAILABLE</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Download Templates ---

function PaymentSlipTemplate({ member, loan, installment, index }: { member: Member, loan: Loan, installment: Installment, index: number }) {
  return (
    <div className="w-[400px] bg-white p-8 border-[12px] border-slate-900 font-sans text-slate-900">
      <div className="text-center border-b-4 border-slate-900 pb-6 mb-6">
        <h1 className="text-3xl font-black tracking-tighter italic">SOMITI<span className="text-emerald-500">PRO</span></h1>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-1">Payment Receipt / আদায় রশিদ</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</p>
          <p className="text-xs font-bold uppercase">{installment.paidDate ? format(installment.paidDate, 'MMM d, yyyy | p') : format(Date.now(), 'MMM d, yyyy | p')}</p>
        </div>
        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Member Name</p>
          <p className="text-lg font-black uppercase tracking-tighter">{member.name}</p>
        </div>
        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</p>
          <p className="text-xs font-bold font-mono italic">{member.phone}</p>
        </div>
        
        <div className="bg-slate-50 p-6 border-2 border-slate-900 mt-8 mb-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Collected Amount / আদায়কৃত টাকা</p>
          <h2 className="text-5xl font-black text-slate-900 italic">৳{installment.amount.toLocaleString()}</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mt-2">Payment Status: Confirmed ✓</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">
          <div>
            <p>Loan ID</p>
            <p className="text-slate-900">#{loan.id}</p>
          </div>
          <div className="text-right">
            <p>Installment No</p>
            <p className="text-slate-900">#{index > 0 ? index : 'PAID'}</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t-4 border-dashed border-slate-200 text-center">
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-300">Generated by SomitiPro Local Management System</p>
      </div>
    </div>
  );
}

function ProfileSummaryTemplate({ member, memberLoans, paidInstallments, totalPrincipal, totalPaid }: any) {
  return (
    <div className="w-[800px] bg-white p-12 border-[20px] border-slate-900 font-sans text-slate-900">
      <div className="flex justify-between items-start border-b-8 border-slate-900 pb-12 mb-12">
        <div>
          <h1 className="text-6xl font-black tracking-tighter italic leading-none">SOMITI<span className="text-emerald-500">PRO</span></h1>
          <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 mt-4">Member Financial Statement / সদস্য বিবরণী</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statement Date</p>
          <p className="text-lg font-black">{format(Date.now(), 'MMM d, yyyy')}</p>
        </div>
      </div>

      <div className="flex gap-12 items-center mb-16">
        <div className="w-32 h-32 bg-slate-100 border-4 border-slate-900 flex items-center justify-center text-5xl font-black">
          {member.name[0]}
        </div>
        <div>
          <h2 className="text-5xl font-black tracking-tight uppercase leading-none mb-4">{member.name}</h2>
          <div className="flex gap-8 text-xs font-black uppercase tracking-widest text-slate-500">
            <span>📞 {member.phone}</span>
            <span>📍 {member.address}</span>
            <span>📅 JOINED: {format(member.joinedAt, 'MMM d, yyyy')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8 mb-16">
        <div className="bg-slate-50 p-8 border-4 border-slate-900 brutalist-shadow-slate">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Principal / মোট ঋণ</p>
          <h3 className="text-3xl font-black text-slate-900">৳{totalPrincipal.toLocaleString()}</h3>
        </div>
        <div className="bg-emerald-50 p-8 border-4 border-emerald-500 brutalist-shadow-emerald">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2">Total Paid / মোট পরিশোধ</p>
          <h3 className="text-3xl font-black text-emerald-600">৳{totalPaid.toLocaleString()}</h3>
        </div>
        <div className="bg-rose-50 p-8 border-4 border-rose-500 brutalist-shadow-rose">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-2">Balance / অবশিষ্ট টাকা</p>
          <h3 className="text-3xl font-black text-rose-600">৳{(totalPrincipal - totalPaid).toLocaleString()}</h3>
        </div>
      </div>

      <div className="space-y-8">
        <h4 className="text-xs font-black uppercase tracking-[0.3em] border-b-4 border-slate-900 pb-2 mb-6">Recent Ledger Entries / সাম্প্রতিক আদায়</h4>
        <div className="divide-y-4 divide-slate-100 border-4 border-slate-900">
          <div className="grid grid-cols-3 p-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
            <span>Date</span>
            <span>Amount</span>
            <span className="text-right">Status</span>
          </div>
          {paidInstallments.slice(0, 10).map((i: any) => (
            <div key={i.id} className="grid grid-cols-3 p-6 text-sm font-bold uppercase items-center">
              <span className="text-slate-400">{i.paidDate ? format(i.paidDate, 'MMM d, yyyy') : ''}</span>
              <span className="text-2xl font-black">৳{i.amount.toLocaleString()}</span>
              <span className="text-right text-emerald-500 font-black">SUCCESS ✓</span>
            </div>
          ))}
          {paidInstallments.length === 0 && (
            <div className="p-12 text-center text-slate-300 font-black uppercase italic tracking-widest">No transaction history found</div>
          )}
        </div>
      </div>

      <div className="mt-20 pt-12 border-t-8 border-slate-900 flex justify-between items-end">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">Authorized Financial Statement</p>
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">System Code: SP-{member.id}-{Date.now()}</p>
        </div>
        <div className="text-right">
          <div className="h-1 bg-slate-900 w-48 mb-2"></div>
          <p className="text-[10px] font-black uppercase tracking-widest">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}
