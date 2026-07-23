import { useMemo, useState } from 'react';
import { MaintenanceTask, MonthlyInstallation } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Wrench, CheckCircle2, AlertTriangle, CalendarRange, CalendarDays, Filter,
  FileText, TrendingUp, ShieldAlert, Award, ChevronRight, Printer, Layers, FileSpreadsheet,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { exportDashboardSummaryToExcel } from '../utils/excelExport';

interface DashboardProps {
  tasks: MaintenanceTask[];
  installations: MonthlyInstallation[];
}

export default function Dashboard({ tasks, installations }: DashboardProps) {
  const [filterType, setFilterType] = useState<'month' | 'range'>('month');

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  });

  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}-01`;
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
  const [isInstallationsCollapsed, setIsInstallationsCollapsed] = useState(true);
  const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(true);
  const [isStatusChartCollapsed, setIsStatusChartCollapsed] = useState(true);
  const [isTypeChartCollapsed, setIsTypeChartCollapsed] = useState(true);

  // Filter data based on selected month or date range
  const filteredTasks = useMemo(() => {
    if (filterType === 'month') {
      return tasks.filter(task => task.scheduledDate && task.scheduledDate.startsWith(selectedMonth));
    } else {
      return tasks.filter(task => {
        if (!task.scheduledDate) return false;
        const taskDate = task.scheduledDate.substring(0, 10);
        const isAfterStart = !startDate || taskDate >= startDate;
        const isBeforeEnd = !endDate || taskDate <= endDate;
        return isAfterStart && isBeforeEnd;
      });
    }
  }, [tasks, filterType, selectedMonth, startDate, endDate]);

  const filteredInstallations = useMemo(() => {
    if (filterType === 'month') {
      return installations.filter(inst => inst.installDate && inst.installDate.startsWith(selectedMonth));
    } else {
      return installations.filter(inst => {
        if (!inst.installDate) return false;
        const instDate = inst.installDate.substring(0, 10);
        const isAfterStart = !startDate || instDate >= startDate;
        const isBeforeEnd = !endDate || instDate <= endDate;
        return isAfterStart && isBeforeEnd;
      });
    }
  }, [installations, filterType, selectedMonth, startDate, endDate]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(t => t.status === 'Completed').length;
    const pendingTasks = filteredTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalInstallations = filteredInstallations.length;

    const highPriorityPending = filteredTasks.filter(
      t => (t.priority === 'High' || t.priority === 'Critical') && t.status !== 'Completed'
    ).length;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      completionRate,
      totalInstallations,
      highPriorityPending
    };
  }, [filteredTasks, filteredInstallations]);

  // Chart Data: Status breakdown
  const statusChartData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Pending': 0,
      'In Progress': 0,
      'Completed': 0,
      'Cancelled': 0
    };
    filteredTasks.forEach(t => {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status]++;
      }
    });

    return [
      { name: 'รอดำเนินการ', value: statusCounts['Pending'], color: '#F59E0B' },
      { name: 'กำลังทำ', value: statusCounts['In Progress'], color: '#3B82F6' },
      { name: 'เสร็จสิ้น', value: statusCounts['Completed'], color: '#10B981' },
      { name: 'ยกเลิก', value: statusCounts['Cancelled'], color: '#EF4444' }
    ].filter(item => item.value > 0);
  }, [filteredTasks]);

  // Chart Data: Task Type breakdown
  const typeChartData = useMemo(() => {
    const typeCounts: Record<string, number> = {
      'Preventive': 0,
      'Corrective': 0,
      'Predictive': 0,
      'Calibration': 0,
      'Other': 0
    };
    filteredTasks.forEach(t => {
      if (typeCounts[t.type] !== undefined) {
        typeCounts[t.type]++;
      }
    });

    const thaiNames: Record<string, string> = {
      'Preventive': 'Preventive Maintenance (PM)',
      'Corrective': 'Corrective Maintenance (CM)',
      'Predictive': 'Predictive Maintenance (PdM)',
      'Calibration': 'Calibration (สอบเทียบ)',
      'Other': 'อื่นๆ (Other)'
    };

    return Object.entries(typeCounts).map(([key, value]) => ({
      name: thaiNames[key] || key,
      'จำนวนงาน': value
    }));
  }, [filteredTasks]);

  // Unique months from tasks & installations for filter selection
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    
    // Default current month
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthsSet.add(currentMonth);

    tasks.forEach(t => {
      if (t.scheduledDate && t.scheduledDate.length >= 7) {
        monthsSet.add(t.scheduledDate.substring(0, 7));
      }
    });

    installations.forEach(i => {
      if (i.installDate && i.installDate.length >= 7) {
        monthsSet.add(i.installDate.substring(0, 7));
      }
    });

    return Array.from(monthsSet).sort().reverse();
  }, [tasks, installations]);

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const formatThaiMonthYear = (monthStr: string) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const thaiYear = parseInt(year, 10) + 543;
    return `${thaiMonths[monthIndex]} ${thaiYear}`;
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts;
    const thaiYear = parseInt(year, 10) + 543;
    const monthIndex = parseInt(month, 10) - 1;
    const monthName = thaiMonths[monthIndex] || month;
    return `${parseInt(day, 10)} ${monthName} ${thaiYear}`;
  };

  const getPeriodLabel = () => {
    if (filterType === 'month') {
      return formatThaiMonthYear(selectedMonth);
    }
    if (startDate && endDate) {
      if (startDate === endDate) return formatThaiDate(startDate);
      return `${formatThaiDate(startDate)} ถึง ${formatThaiDate(endDate)}`;
    }
    if (startDate) {
      return `ตั้งแต่ ${formatThaiDate(startDate)}`;
    }
    if (endDate) {
      return `ถึง ${formatThaiDate(endDate)}`;
    }
    return 'ข้อมูลทั้งหมด';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    const originalTitle = document.title;
    const periodStr = getPeriodLabel().replace(/[\s\t]+/g, '_');
    document.title = `รายงานสรุปงานซ่อมบำรุง_${periodStr}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  const handleExportExcel = () => {
    exportDashboardSummaryToExcel(filteredTasks, filteredInstallations, getPeriodLabel());
  };

  return (
    <div className="space-y-6">
      {/* Filters and Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarRange className="text-blue-600 shrink-0" size={20} />
              <span className="whitespace-nowrap sm:whitespace-normal">แดชบอร์ดสรุปผลการทำงานซ่อมบำรุง</span>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 shrink-0">ช่วงเวลาข้อมูล:</span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50/90 px-2.5 py-0.5 rounded-lg border border-blue-200/80 shrink-0">
                {getPeriodLabel()}
              </span>
            </div>
          </div>

          {/* Action buttons with uniform height, font, and paddings */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterCollapsed(prev => !prev)}
              className={`h-9 px-3.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 border shrink-0 ${
                isFilterCollapsed 
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/80' 
                  : 'bg-blue-600 text-white border-blue-600 shadow-2xs'
              }`}
              title={isFilterCollapsed ? "ขยายตัวกรองช่วงเวลา" : "ย่อตัวกรองช่วงเวลา"}
            >
              <Filter size={15} />
              <span>ตัวกรองช่วงเวลา</span>
              {isFilterCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>

            <button
              onClick={handlePrint}
              className="h-9 px-3.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              id="btn-print-report"
              title="พิมพ์หน้านี้โดยตรง"
            >
              <Printer size={15} />
              <span>พิมพ์หน้าเว็บ</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="h-9 px-3.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
              id="btn-export-excel"
              title="ส่งออกรายงานและข้อมูลเป็นไฟล์ Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} />
              <span>ส่งออก Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="h-9 px-3.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
              id="btn-export-pdf"
              title="ส่งออกเอกสารสรุปงานเป็น PDF สำหรับพิมพ์"
            >
              <FileText size={15} />
              <span>ส่งออก PDF</span>
            </button>
          </div>
        </div>

        {/* Filter controls bar */}
        {!isFilterCollapsed && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/60">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Mode Switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterType('month')}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterType === 'month'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <CalendarRange size={14} />
                  <span>เลือกตามเดือน</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('range')}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    filterType === 'range'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <CalendarDays size={14} />
                  <span>กำหนดช่วงวันที่</span>
                </button>
              </div>

              {/* Separator */}
              <div className="hidden md:block h-6 w-px bg-slate-200/80 shrink-0" />

              {/* Controls based on filter type */}
              {filterType === 'month' ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 shrink-0">เลือกเดือน:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="h-9 text-xs font-bold bg-white border border-slate-300 text-slate-800 rounded-xl px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer"
                  >
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{formatThaiMonthYear(m)}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">เริ่มต้น:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border border-slate-300 text-slate-800 rounded-xl px-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer"
                    />
                  </div>

                  <span className="text-xs text-slate-400 font-bold px-0.5">–</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-700 whitespace-nowrap">สิ้นสุดวันที่:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 text-xs font-bold bg-white border border-slate-300 text-slate-800 rounded-xl px-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick presets (only shown when range mode active) */}
            {filterType === 'range' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 mr-0.5 hidden lg:inline">ตัวเลือกด่วน:</span>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = today.getMonth();
                    const lastDay = new Date(year, month + 1, 0).getDate();
                    setStartDate(`${year}-${String(month + 1).padStart(2, '0')}-01`);
                    setEndDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
                  }}
                  className="h-9 text-xs font-semibold bg-white border border-slate-200/90 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 px-3 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  เดือนนี้
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 7);
                    setStartDate(start.toISOString().split('T')[0]);
                    setEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="h-9 text-xs font-semibold bg-white border border-slate-200/90 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 px-3 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  7 วันล่าสุด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - 30);
                    setStartDate(start.toISOString().split('T')[0]);
                    setEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="h-9 text-xs font-semibold bg-white border border-slate-200/90 text-slate-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 px-3 rounded-xl transition-all cursor-pointer shadow-2xs"
                >
                  30 วันล่าสุด
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        {/* Total Tasks Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Wrench size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">แผนงานซ่อมบำรุงทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalTasks} <span className="text-xs font-normal text-slate-400">รายการ</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">รวมงานซ่อมแซมและบำรุงรักษาเชิงป้องกัน</p>
          </div>
        </motion.div>

        {/* Completion Rate Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={22} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-medium">อัตราความสำเร็จ (KPI)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-800">{stats.completionRate}%</span>
              <span className="text-xs text-slate-400">({stats.completedTasks}/{stats.totalTasks})</span>
            </div>
            {/* Simple progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
          </div>
        </motion.div>

        {/* Monthly Installations Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4"
        >
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <CalendarRange size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">งานติดตั้งเครื่องจักรใหม่</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalInstallations} <span className="text-xs font-normal text-slate-400">ชุด</span></p>
            <p className="text-[10px] text-slate-400 mt-0.5">ติดตั้ง ตั้งค่า และเริ่มใช้งานในเดือนนี้</p>
          </div>
        </motion.div>

        {/* Urgent Pending Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex items-center gap-4"
        >
          <div className={`p-3 rounded-xl ${stats.highPriorityPending > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">งานค้างวิกฤต/เร่งด่วน</p>
            <p className={`text-2xl font-bold ${stats.highPriorityPending > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {stats.highPriorityPending} <span className="text-xs font-normal text-slate-400">งาน</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">ความสำคัญสูงถึงวิกฤตที่ยังไม่เสร็จ</p>
          </div>
        </motion.div>
      </div>

      {/* Visual Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Status Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col transition-all">
          <div 
            onClick={() => setIsStatusChartCollapsed(prev => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              <span>สัดส่วนสถานะงานซ่อมบำรุง</span>
            </h3>
            <button 
              type="button"
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              title={isStatusChartCollapsed ? "ขยาย" : "ย่อ"}
            >
              {isStatusChartCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>

          {!isStatusChartCollapsed && (
            <div className="mt-4 flex-1 min-h-[280px] flex items-center justify-center">
              {statusChartData.length > 0 ? (
                <div className="w-full h-full flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="w-full sm:w-1/2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} งาน`, 'จำนวน']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 shrink-0">
                    {statusChartData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="font-medium">{item.name}:</span>
                        <span>{item.value} งาน</span>
                        <span className="text-slate-400">({Math.round((item.value / stats.totalTasks) * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  ไม่มีข้อมูลงานซ่อมบำรุงในเดือนนี้
                </div>
              )}
            </div>
          )}
        </div>

        {/* Type Breakdown Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col transition-all">
          <div 
            onClick={() => setIsTypeChartCollapsed(prev => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              <span>จำนวนงานแยกตามประเภทการบำรุงรักษา</span>
            </h3>
            <button 
              type="button"
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              title={isTypeChartCollapsed ? "ขยาย" : "ย่อ"}
            >
              {isTypeChartCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>

          {!isTypeChartCollapsed && (
            <div className="mt-4 flex-1 min-h-[280px]">
              {stats.totalTasks > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={typeChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: '#64748B', fontSize: 10 }} 
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fill: '#64748B', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="จำนวนงาน" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs min-h-[200px]">
                  ไม่มีข้อมูลประเภทงานซ่อมบำรุงในเดือนนี้
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Installation & Overdue Table Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
        {/* Recent Installations in selected month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col transition-all">
          <div 
            onClick={() => setIsInstallationsCollapsed(prev => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <CalendarRange size={16} className="text-purple-500" />
              <span>รายการติดตั้งใหม่ประจำเดือน</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full font-bold border border-purple-100/80">
                {filteredInstallations.length} รายการ
              </span>
              <button 
                type="button"
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title={isInstallationsCollapsed ? "ขยาย" : "ย่อ"}
              >
                {isInstallationsCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>

          {!isInstallationsCollapsed && (
            <div className="mt-3 flex-1 overflow-x-auto">
              {filteredInstallations.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">อุปกรณ์/โมเดล</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">สถานที่ติดตั้ง</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">วันที่</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredInstallations.slice(0, 5).map((inst, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2.5">
                          <div className="text-xs font-medium text-slate-700">{inst.equipmentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">S/N: {inst.serialNumber}</div>
                        </td>
                        <td className="py-2.5 text-xs text-slate-600">{inst.location}</td>
                        <td className="py-2.5 text-xs text-slate-500">{inst.installDate}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            inst.status === 'Operational' ? 'bg-emerald-50 text-emerald-600' :
                            inst.status === 'Pending Testing' ? 'bg-amber-50 text-amber-600' :
                            'bg-rose-50 text-rose-600'
                          }`}>
                            {inst.status === 'Operational' ? 'ใช้งานได้ปกติ' :
                             inst.status === 'Pending Testing' ? 'รอนำเข้าระบบ' :
                             'ต้องซ่อมบำรุง'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ไม่มีบันทึกการติดตั้งอุปกรณ์ใหม่ในเดือนนี้
                </div>
              )}
            </div>
          )}
        </div>

        {/* High-priority Pending Maintenance Tasks */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col transition-all">
          <div 
            onClick={() => setIsOverdueCollapsed(prev => !prev)}
            className="flex items-center justify-between cursor-pointer select-none group"
          >
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" />
              <span>งานค้างเร่งด่วนที่ต้องเร่งจัดการ</span>
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full font-bold border border-rose-100/80">
                {filteredTasks.filter(t => t.priority === 'High' || t.priority === 'Critical').length} รายการ
              </span>
              <button 
                type="button"
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title={isOverdueCollapsed ? "ขยาย" : "ย่อ"}
              >
                {isOverdueCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            </div>
          </div>

          {!isOverdueCollapsed && (
            <div className="mt-3 flex-1 overflow-x-auto">
              {filteredTasks.filter(t => (t.priority === 'High' || t.priority === 'Critical') && t.status !== 'Completed').length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">ชื่องาน/อุปกรณ์</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">ผู้รับผิดชอบ</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">กำหนดส่ง</th>
                      <th className="py-2.5 text-[11px] font-semibold text-slate-400">ความสำคัญ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredTasks
                      .filter(t => (t.priority === 'High' || t.priority === 'Critical') && t.status !== 'Completed')
                      .slice(0, 5)
                      .map((task, index) => (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="py-2.5">
                            <div className="text-xs font-medium text-slate-700">{task.title}</div>
                            <div className="text-[10px] text-slate-400">อุปกรณ์: {task.equipment}</div>
                          </td>
                          <td className="py-2.5 text-xs text-slate-600">{task.assignedTo || 'ไม่ได้ระบุ'}</td>
                          <td className="py-2.5 text-xs text-slate-500 font-mono">{task.scheduledDate}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              task.priority === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {task.priority === 'Critical' ? 'วิกฤต' : 'สูง'}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ยอดเยี่ยม! ไม่มีงานซ่อมบำรุงค้างในระดับวิกฤตหรือความสำคัญสูง
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY REPORT LAYOUT */}
      <div className="hidden print:block p-8 bg-white text-slate-800">
        <div className="border-b-2 border-slate-800 pb-5 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">รายงานสรุปผลงานซ่อมบำรุงและติดตั้งประจำเดือน</h1>
            <p className="text-sm text-slate-500 mt-1">
              ประจำรอบเดือน: <span className="font-semibold text-slate-800">{formatThaiMonthYear(selectedMonth)}</span>
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')}</p>
            <p>ระบบ Maintenance Planner & Tracker (เพื่อการศึกษา)</p>
          </div>
        </div>

        {/* Stats summary section */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-xs text-slate-500 font-medium">แผนงานซ่อมบำรุงทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalTasks} <span className="text-sm font-normal text-slate-500">งาน</span></p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-xs text-slate-500 font-medium">เสร็จสิ้นเรียบร้อย</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.completedTasks} <span className="text-sm font-normal text-slate-500">งาน</span></p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-xs text-slate-500 font-medium">อัตราความสำเร็จ (Completion Rate)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.completionRate}%</p>
          </div>
          <div className="border border-slate-200 p-4 rounded-lg">
            <p className="text-xs text-slate-500 font-medium">ติดตั้งอุปกรณ์ใหม่ประจำเดือน</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.totalInstallations} <span className="text-sm font-normal text-slate-500">เครื่อง</span></p>
          </div>
        </div>

        {/* Detailed Installations Section */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-300 pb-1 mb-3">1. รายการติดตั้งอุปกรณ์ใหม่ในเดือนนี้</h2>
          {filteredInstallations.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 border-r border-slate-200">อุปกรณ์ / โมเดล</th>
                  <th className="p-2 border-r border-slate-200">หมายเลขซีเรียล</th>
                  <th className="p-2 border-r border-slate-200">สถานที่ติดตั้ง</th>
                  <th className="p-2 border-r border-slate-200">วันที่ติดตั้ง</th>
                  <th className="p-2 border-r border-slate-200">ช่างเทคนิค</th>
                  <th className="p-2">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInstallations.map((inst, index) => (
                  <tr key={index}>
                    <td className="p-2 border-r border-slate-200 font-medium">{inst.equipmentName} / {inst.model || '-'}</td>
                    <td className="p-2 border-r border-slate-200 font-mono">{inst.serialNumber}</td>
                    <td className="p-2 border-r border-slate-200">{inst.location}</td>
                    <td className="p-2 border-r border-slate-200">{inst.installDate}</td>
                    <td className="p-2 border-r border-slate-200">{inst.technician || '-'}</td>
                    <td className="p-2 font-medium">
                      {inst.status === 'Operational' ? 'ใช้งานได้ปกติ' :
                       inst.status === 'Pending Testing' ? 'อยู่ระหว่างทดสอบ' : 'ต้องซ่อมบำรุง'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-400 italic">ไม่มีรายการติดตั้งอุปกรณ์ใหม่ในเดือนนี้</p>
          )}
        </div>

        {/* Detailed Maintenance Section */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-300 pb-1 mb-3">2. ตารางงานซ่อมบำรุงทั้งหมดประจำเดือน</h2>
          {filteredTasks.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-2 border-r border-slate-200">ชื่องาน</th>
                  <th className="p-2 border-r border-slate-200">อุปกรณ์</th>
                  <th className="p-2 border-r border-slate-200">ประเภทงาน</th>
                  <th className="p-2 border-r border-slate-200">ผู้รับผิดชอบ</th>
                  <th className="p-2 border-r border-slate-200">กำหนดการ</th>
                  <th className="p-2 border-r border-slate-200">ความสำคัญ</th>
                  <th className="p-2">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTasks.map((task, index) => (
                  <tr key={index}>
                    <td className="p-2 border-r border-slate-200 font-medium">{task.title}</td>
                    <td className="p-2 border-r border-slate-200">{task.equipment}</td>
                    <td className="p-2 border-r border-slate-200">
                      {task.type === 'Preventive' ? 'Preventive Maintenance' :
                       task.type === 'Corrective' ? 'Corrective Maintenance' :
                       task.type === 'Predictive' ? 'Predictive Maintenance' :
                       task.type === 'Calibration' ? 'Calibration' : 'อื่นๆ'}
                    </td>
                    <td className="p-2 border-r border-slate-200">{task.assignedTo || '-'}</td>
                    <td className="p-2 border-r border-slate-200">{task.scheduledDate}</td>
                    <td className="p-2 border-r border-slate-200">{task.priority}</td>
                    <td className="p-2 font-semibold">
                      {task.status === 'Completed' ? 'เสร็จสิ้น' :
                       task.status === 'Pending' ? 'รอดำเนินการ' :
                       task.status === 'In Progress' ? 'กำลังดำเนินการ' : 'ยกเลิก'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-slate-400 italic">ไม่มีบันทึกงานซ่อมบำรุงในเดือนนี้</p>
          )}
        </div>

        {/* Signature Line */}
        <div className="mt-12 flex justify-between items-center text-xs">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 h-10 mb-2"></div>
            <p>ผู้รายงาน / เจ้าหน้าที่ซ่อมบำรุง</p>
          </div>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 h-10 mb-2"></div>
            <p>ผู้ตรวจสอบ / หัวหน้างาน</p>
          </div>
        </div>
      </div>
    </div>
  );
}
