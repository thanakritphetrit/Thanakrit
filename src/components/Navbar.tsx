import { Wrench, Calendar, TrendingUp, Cpu, Plus, History, Shield, LogOut, User as UserIcon, MapPin } from 'lucide-react';
import { User } from 'firebase/auth';
import { AppUserRole } from '../types';
import { motion } from 'motion/react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onCreateTaskClick?: () => void;
  user: User | null;
  userRole: AppUserRole;
  onLogout: () => void;
}

export default function Navbar({ activeTab, setActiveTab, onCreateTaskClick, user, userRole, onLogout }: NavbarProps) {
  const allTabs = [
    { id: 'tasks', name: 'จัดการงานซ่อมบำรุง', icon: Wrench },
    { id: 'checkin', name: 'เช็คอิน GPS หน้างาน', icon: MapPin },
    { id: 'planner', name: 'ปฏิทินวางแผนงาน', icon: Calendar },
    { id: 'installations', name: 'ติดตั้งอุปกรณ์รายเดือน', icon: Cpu },
    { id: 'dashboard', name: 'แดชบอร์ดสรุปผล', icon: TrendingUp },
    { id: 'login_history', name: 'ประวัติเข้าระบบ', icon: History, adminOnly: true },
    { id: 'admin_panel', name: 'จัดการสิทธิ์ผู้ใช้', icon: Shield, adminOnly: true },
  ];

  const tabs = allTabs.filter(tab => !tab.adminOnly || userRole === 'admin');

  const getRoleBadge = (role: AppUserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="text-[9px] font-bold text-rose-300 bg-rose-950/60 border border-rose-800/80 px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider shadow-[0_0_10px_rgba(244,63,94,0.15)] flex items-center gap-1 shrink-0 select-none">
            <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse"></span>
            Admin
          </span>
        );
      case 'technician':
        return (
          <span className="text-[9px] font-bold text-sky-300 bg-sky-950/60 border border-sky-800/80 px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider shadow-[0_0_10px_rgba(14,165,233,0.15)] flex items-center gap-1 shrink-0 select-none">
            <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse"></span>
            Tech
          </span>
        );
      case 'viewer':
        return (
          <span className="text-[9px] font-bold text-slate-300 bg-slate-850/60 border border-slate-750 px-1.5 sm:px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shrink-0 select-none">
            <span className="w-1 h-1 rounded-full bg-slate-400"></span>
            Viewer
          </span>
        );
      default:
        return null;
    }
  };

  const getTabShortName = (tabId: string) => {
    switch (tabId) {
      case 'tasks': return 'ใบงาน';
      case 'checkin': return 'เช็คอิน';
      case 'planner': return 'ปฏิทิน';
      case 'installations': return 'ติดตั้ง';
      case 'dashboard': return 'แดชบอร์ด';
      case 'login_history': return 'ประวัติ';
      case 'admin_panel': return 'สิทธิ์ผู้ใช้';
      default: return '';
    }
  };

  return (
    <>
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl text-white shadow-lg no-print border-b border-slate-800/80 w-full max-w-full">
        {/* Top Header Main Row */}
        <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-3">
            {/* Logo and Brand */}
            <div className="flex items-center gap-2.5 sm:gap-3 group select-none shrink-0 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300 shrink-0">
                <Wrench size={16} className="sm:hidden stroke-[2.5]" />
                <Wrench size={18} className="hidden sm:block stroke-[2.5]" />
              </div>
              <div className="text-left leading-tight min-w-0">
                <span className="font-extrabold tracking-tight text-xs sm:text-base block text-white truncate max-w-[160px] xs:max-w-[200px] sm:max-w-none">
                  <span className="sm:hidden">PM System</span>
                  <span className="hidden sm:inline">Preventive Maintenance</span>
                </span>
                <span className="text-[9px] sm:text-[11px] text-slate-400 block font-medium truncate">
                  ระบบซ่อมบำรุง
                </span>
              </div>
            </div>

            {/* Right Action Items */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {onCreateTaskClick && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onCreateTaskClick}
                  className="hidden sm:flex items-center gap-1.5 h-9 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/20 border border-blue-400/30 select-none whitespace-nowrap"
                  id="navbar-btn-create"
                  title="สร้างใบงานซ่อมบำรุงใหม่"
                >
                  <Plus size={15} className="stroke-[3]" />
                  <span>สร้างใบงานซ่อมบำรุง</span>
                </motion.button>
              )}

              {/* User Profile Info & Logout */}
              {user && (
                <div className="flex items-center gap-2 sm:gap-2.5 h-8 sm:h-9 bg-slate-950/80 px-2.5 sm:px-3 rounded-xl border border-slate-800/80 shrink-0">
                  <div className="text-left leading-tight">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-[11px] sm:text-xs font-bold text-slate-100 block truncate max-w-[90px] xs:max-w-[120px] sm:max-w-[160px]" title={user.displayName || user.email || ''}>
                        {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                      </span>
                      {getRoleBadge(userRole)}
                    </div>
                  </div>

                  <div className="h-3 w-px bg-slate-800 shrink-0" />

                  <button 
                    onClick={onLogout} 
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 p-1 rounded-md"
                    title="ออกจากระบบ"
                  >
                    <LogOut size={13} className="stroke-[2.2]" />
                    <span className="hidden md:inline">ออกระบบ</span>
                  </button>

                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || "User"}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover border border-slate-700 shrink-0 hidden xs:block"
                    />
                  ) : (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white uppercase shrink-0 hidden xs:flex">
                      <UserIcon size={10} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Bar Navigation Row (Desktop & Tablet) */}
        <div className="hidden lg:block bg-slate-950/90 border-t border-slate-800/80 py-1.5 px-3 sm:px-6">
          <div className="max-w-[1440px] w-full mx-auto flex items-center justify-center">
            <nav className="flex items-center gap-1 bg-slate-900/95 p-1 rounded-2xl border border-slate-800/80 overflow-x-auto no-scrollbar max-w-full shadow-md">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none whitespace-nowrap shrink-0 ${
                      isActive 
                        ? 'text-white' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                    title={tab.name}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md shadow-blue-500/25 -z-10 border border-blue-400/30"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon size={15} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/98 backdrop-blur-2xl border-t border-slate-800 px-1 py-1 no-print shadow-[0_-8px_30px_rgba(0,0,0,0.4)] pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around gap-0.5 overflow-x-auto no-scrollbar max-w-lg mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-150 cursor-pointer flex-1 min-w-[46px] max-w-[68px] active:scale-95 ${
                  isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileBottomTab"
                    className="absolute inset-0 bg-blue-500/20 rounded-xl border border-blue-500/40 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={16} className={`transition-transform duration-150 ${isActive ? 'scale-110 text-blue-400 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className={`text-[9px] mt-0.5 font-bold tracking-tighter truncate w-full text-center ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {getTabShortName(tab.id)}
                </span>
              </button>
            );
          })}

          {/* Quick Floating-style Mobile Create Task Button */}
          {onCreateTaskClick && (
            <button
              onClick={onCreateTaskClick}
              className="flex items-center justify-center p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold cursor-pointer shadow-md shadow-blue-600/30 active:scale-90 transition-transform shrink-0 border border-blue-400/30 ml-0.5"
              title="สร้างใบงานใหม่"
            >
              <Plus size={16} className="stroke-[3]" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
