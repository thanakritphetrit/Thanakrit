import { useState } from 'react';
import { LoginHistory } from '../types';
import { History, Search, ArrowUpDown, Calendar, Monitor, Mail, User, ShieldCheck, Cpu } from 'lucide-react';

interface LoginHistoryManagerProps {
  loginHistory: LoginHistory[];
}

export default function LoginHistoryManager({ loginHistory }: LoginHistoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleCount, setVisibleCount] = useState(15);

  // Parse User Agent into readable OS & Browser
  const parseUserAgent = (ua: string): { os: string; browser: string } => {
    if (!ua) return { os: 'ไม่ทราบระบบปฏิบัติการ', browser: 'ไม่ทราบเบราว์เซอร์' };
    
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    // Detect Browser
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome') && !ua.includes('Chromium')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Trident') || ua.includes('MSIE')) browser = 'Internet Explorer';
    
    return { os, browser };
  };

  // Filter history based on search term
  const filteredHistory = loginHistory.filter((item) => {
    const term = searchTerm.toLowerCase();
    const displayName = (item.displayName || '').toLowerCase();
    const email = (item.email || '').toLowerCase();
    const userId = (item.userId || '').toLowerCase();
    const { os, browser } = parseUserAgent(item.userAgent);
    
    return (
      displayName.includes(term) ||
      email.includes(term) ||
      userId.includes(term) ||
      os.toLowerCase().includes(term) ||
      browser.toLowerCase().includes(term)
    );
  });

  // Sort history based on timestamp
  const sortedHistory = [...filteredHistory].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });

  // Format date time helper
  const formatThaiDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' น.';
    } catch {
      return isoString;
    }
  };

  // Calculate high level stats
  const totalLogs = loginHistory.length;
  const uniqueUsersCount = new Set(loginHistory.map(h => h.userId)).size;
  const lastLoginTime = loginHistory.length > 0 ? formatThaiDate(loginHistory[0].timestamp) : 'ไม่มีข้อมูล';

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header and Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="text-blue-600" size={24} />
            <span>ประวัติการเข้าใช้งานระบบ (Login History Logs)</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            รายงานการเข้าสู่ระบบผ่าน Google Sign-In แบบเรียลไทม์ เพื่อตรวจสอบความปลอดภัยและประวัติการทำงานของพนักงาน
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg font-bold w-fit">
          <ShieldCheck size={14} className="stroke-[3]" />
          <span>บันทึกความปลอดภัยแบบเรียลไทม์ (Secure Logs)</span>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Sign-ins */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
            <History size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">จำนวนการเข้าสู่ระบบทั้งหมด</span>
            <span className="text-2xl font-black text-slate-800 block mt-0.5">{totalLogs} ครั้ง</span>
          </div>
        </div>

        {/* Active Unique Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl">
            <User size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ผู้ใช้งานที่มีความเคลื่อนไหว</span>
            <span className="text-2xl font-black text-slate-800 block mt-0.5">{uniqueUsersCount} บัญชี</span>
          </div>
        </div>

        {/* Last Sign-in */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Calendar size={22} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">เข้าสู่ระบบล่าสุดเมื่อ</span>
            <span className="text-xs font-black text-slate-700 block mt-1.5 truncate max-w-[210px]" title={lastLoginTime}>
              {lastLoginTime}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table and Filter section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        {/* Controls header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, อุปกรณ์, หรือเบราว์เซอร์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>

          {/* Sort & Actions */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors"
              title="เรียงลำดับเวลา"
            >
              <ArrowUpDown size={14} className="text-slate-500" />
              <span>เรียงตามเวลา: {sortOrder === 'desc' ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน'}</span>
            </button>
          </div>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          {sortedHistory.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/60 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-6">ผู้ใช้งาน (User Profile)</th>
                  <th className="py-3 px-6">วัน-เวลา เข้าสู่ระบบ (Log Timestamp)</th>
                  <th className="py-3 px-6">ระบบและเบราว์เซอร์ (OS & Browser)</th>
                  <th className="py-3 px-6">รหัสบัญชี (User UID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
                {sortedHistory.slice(0, visibleCount).map((item) => {
                  const { os, browser } = parseUserAgent(item.userAgent);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* User Profile column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {item.photoURL ? (
                            <img
                              src={item.photoURL}
                              alt={item.displayName || 'User'}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {item.displayName?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{item.displayName || 'ไม่ระบุชื่อ'}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Mail size={11} className="shrink-0" />
                              <span>{item.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Timestamp column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-slate-800">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatThaiDate(item.timestamp)}</span>
                        </div>
                      </td>

                      {/* OS and Browser column */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <Monitor size={13} className="text-slate-400" />
                            <span>{os}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <Cpu size={11} className="text-slate-300" />
                            <span>{browser}</span>
                          </div>
                        </div>
                      </td>

                      {/* User ID column */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200/50">
                          {item.userId}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <History size={40} className="mx-auto text-slate-300 animate-pulse" />
              <div className="font-bold text-slate-500 text-sm">ไม่พบประวัติการเข้าใช้งานระบบ</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                ไม่พบผลลัพธ์ที่ตรงกับคำค้นหาของคุณ หรือยังไม่มีประวัติการเข้าใช้งานเก็บในฐานข้อมูล ณ ขณะนี้
              </p>
            </div>
          )}
        </div>

        {/* Load more controls */}
        {sortedHistory.length > visibleCount && (
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
            <button
              onClick={() => setVisibleCount(prev => prev + 15)}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer transition-colors"
            >
              แสดงข้อมูลเพิ่มเติม (+15 รายการ)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
