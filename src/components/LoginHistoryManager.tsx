import { useState } from 'react';
import { LoginHistory } from '../types';
import { History, Search, ArrowUpDown, Calendar, Monitor, Mail, User, ShieldCheck, Cpu, ChevronDown } from 'lucide-react';

interface LoginHistoryManagerProps {
  loginHistory: LoginHistory[];
}

export default function LoginHistoryManager({ loginHistory }: LoginHistoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleCount, setVisibleCount] = useState(15);
  const [isTableExpanded, setIsTableExpanded] = useState(true);

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
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, อุปกรณ์, หรือเบราว์เซอร์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>

          {/* Sort & Actions */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={toggleSortOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors"
              title="เรียงลำดับเวลา"
            >
              <ArrowUpDown size={13} className="text-slate-500" />
              <span>เรียงตามเวลา: {sortOrder === 'desc' ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน'}</span>
            </button>
            <button
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors shadow-2xs"
              title={isTableExpanded ? "ย่อตารางซ่อน" : "ขยายแสดงตาราง"}
            >
              <span>{isTableExpanded ? 'ย่อตารางซ่อน' : 'ขยายแสดงตาราง'}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 text-slate-500 ${isTableExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isTableExpanded && (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              {sortedHistory.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/60 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 px-4">ผู้ใช้งาน (User Profile)</th>
                      <th className="py-2.5 px-4">วัน-เวลา เข้าสู่ระบบ (Log Timestamp)</th>
                      <th className="py-2.5 px-4">ระบบและเบราว์เซอร์ (OS & Browser)</th>
                      <th className="py-2.5 px-4 text-right">รหัสบัญชี (User UID)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
                    {sortedHistory.slice(0, visibleCount).map((item) => {
                      const { os, browser } = parseUserAgent(item.userAgent);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* User Profile column */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.photoURL ? (
                                <img
                                  src={item.photoURL}
                                  alt={item.displayName || 'User'}
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                  {item.displayName?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate max-w-[180px] text-xs leading-snug">{item.displayName || 'ไม่ระบุชื่อ'}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate max-w-[180px]">
                                  <Mail size={10} className="shrink-0 text-slate-400" />
                                  <span className="truncate">{item.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Timestamp column */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-800 text-xs font-bold">
                              <Calendar size={13} className="text-slate-400 shrink-0" />
                              <span>{formatThaiDate(item.timestamp)}</span>
                            </div>
                          </td>

                          {/* OS and Browser column */}
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1 text-slate-800 font-bold">
                                <Monitor size={12} className="text-slate-400 shrink-0" />
                                <span>{os}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-medium">
                                <Cpu size={11} className="text-slate-300 shrink-0" />
                                <span>{browser}</span>
                              </div>
                            </div>
                          </td>

                          {/* User ID column */}
                          <td className="py-2.5 px-4 text-right">
                            <span 
                              className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/60 max-w-[130px] truncate inline-block align-middle"
                              title={item.userId}
                            >
                              {item.userId}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <History size={36} className="mx-auto text-slate-300" />
                  <div className="font-bold text-slate-500 text-xs">ไม่พบประวัติการเข้าใช้งานระบบ</div>
                </div>
              )}
            </div>

            {/* Mobile View Cards */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sortedHistory.length > 0 ? (
                sortedHistory.slice(0, visibleCount).map((item) => {
                  const { os, browser } = parseUserAgent(item.userAgent);
                  return (
                    <div key={item.id} className="p-3.5 space-y-2 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
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
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{item.displayName || 'ไม่ระบุชื่อ'}</div>
                            <div className="text-[10px] text-slate-400 truncate">{item.email}</div>
                          </div>
                        </div>
                        <span 
                          className="font-mono text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 max-w-[100px] truncate shrink-0"
                          title={item.userId}
                        >
                          {item.userId}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100/80">
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span>{formatThaiDate(item.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold">{os}</span>
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-semibold">{browser}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs font-bold">
                  ไม่พบประวัติการเข้าใช้งานระบบ
                </div>
              )}
            </div>

            {/* Load more controls */}
            {sortedHistory.length > visibleCount && (
              <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 15)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer transition-colors"
                >
                  แสดงข้อมูลเพิ่มเติม (+15 รายการ)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
