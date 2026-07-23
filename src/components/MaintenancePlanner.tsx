import React, { useState, useMemo } from 'react';
import { MaintenanceTask, MaintenanceType, MaintenanceStatus, MaintenancePriority, AppUserRole } from '../types';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle, 
  Wrench, Sparkles, Plus, Info, AlertTriangle, X, User, Layers, ShieldAlert, FileText, Calendar, Building2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThaiAddressSelector } from './ThaiAddressSelector';

interface MaintenancePlannerProps {
  tasks: MaintenanceTask[];
  userRole: AppUserRole;
  onAddTask: (task: Omit<MaintenanceTask, 'id' | 'createdAt'>) => Promise<void>;
}

export default function MaintenancePlanner({ tasks, userRole, onAddTask }: MaintenancePlannerProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Form state for quick add
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickEquipment, setQuickEquipment] = useState('');
  const [quickType, setQuickType] = useState<MaintenanceType>('Preventive');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Form state for create modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [equipment, setEquipment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [departmentOrCompany, setDepartmentOrCompany] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<MaintenanceType>('Preventive');
  const [priority, setPriority] = useState<MaintenancePriority>('Medium');
  const [status, setStatus] = useState<MaintenanceStatus>('Pending');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [completedDate, setCompletedDate] = useState('');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayIndex = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    return firstDay.getDay(); // 0 (Sun) - 6 (Sat)
  }, [year, month]);

  // Tasks for the active month
  const activeMonthTasks = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    return tasks.filter(t => t.scheduledDate.startsWith(monthStr));
  }, [tasks, year, month]);

  // Map tasks to their scheduled day
  const tasksByDay = useMemo(() => {
    const map: Record<number, MaintenanceTask[]> = {};
    activeMonthTasks.forEach(task => {
      const dayNum = parseInt(task.scheduledDate.substring(8, 10), 10);
      if (!isNaN(dayNum)) {
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(task);
      }
    });
    return map;
  }, [activeMonthTasks]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    if (userRole !== 'viewer') {
      setIsQuickAddOpen(true);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle || !quickEquipment || selectedDay === null) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      await onAddTask({
        title: quickTitle,
        description: 'สร้างด่วนจากมุมมองปฏิทินวางแผนงาน',
        type: quickType,
        status: 'Pending',
        priority: 'Medium',
        equipment: quickEquipment,
        assignedTo: '',
        scheduledDate: scheduledDateStr,
        completedDate: '',
        notes: ''
      });
      setIsQuickAddOpen(false);
      setQuickTitle('');
      setQuickEquipment('');
      setQuickType('Preventive');
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกงาน');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !equipment || !scheduledDate) {
      alert('กรุณากรอกข้อมูลสำคัญให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddTask({
        title,
        description,
        type,
        status,
        priority,
        equipment,
        assignedTo,
        scheduledDate,
        completedDate: status === 'Completed' ? completedDate : '',
        notes: '',
        departmentOrCompany,
        province,
        district,
        subdistrict,
        phone
      });
      // Reset form states
      setTitle('');
      setDescription('');
      setEquipment('');
      setAssignedTo('');
      setDepartmentOrCompany('');
      setProvince('');
      setDistrict('');
      setSubdistrict('');
      setPhone('');
      setType('Preventive');
      setPriority('Medium');
      setStatus('Pending');
      setCompletedDate('');
      setIsCreateModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกงาน');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'In Progress': return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Cancelled': return 'bg-rose-50 text-rose-700 border border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
  };

  const daysOfWeek = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  // Total status count for selected month
  const summary = useMemo(() => {
    const total = activeMonthTasks.length;
    const completed = activeMonthTasks.filter(t => t.status === 'Completed').length;
    const pending = activeMonthTasks.filter(t => t.status === 'Pending' || t.status === 'In Progress').length;
    return { total, completed, pending };
  }, [activeMonthTasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid Container */}
      <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-100 shadow-xs flex flex-col no-print">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CalendarIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {thaiMonths[month]} {year + 543}
              </h3>
              <p className="text-[10px] text-slate-400">คลิกที่วันที่ในปฏิทินเพื่อเพิ่ม/วางแผนงานอย่างรวดเร็ว</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="text-xs font-semibold px-2.5 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md border border-slate-200 cursor-pointer"
            >
              วันนี้
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-slate-500 hover:bg-slate-50 rounded-md border border-slate-200 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {daysOfWeek.map((day, idx) => (
            <div key={idx} className="text-xs font-bold text-slate-400 py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid Days */}
        <div className="grid grid-cols-7 gap-1.5 flex-1">
          {/* Pad empty days at start */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} className="bg-slate-50/50 rounded-lg min-h-20 p-1 opacity-20 border border-slate-100"></div>
          ))}

          {/* Render month days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayTasks = tasksByDay[dayNum] || [];
            const isToday = 
              new Date().getDate() === dayNum && 
              new Date().getMonth() === month && 
              new Date().getFullYear() === year;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => handleDayClick(dayNum)}
                className={`group min-h-20 rounded-lg p-1.5 border transition-all cursor-pointer flex flex-col justify-between hover:shadow-xs hover:border-blue-300 relative ${
                  isToday 
                    ? 'bg-blue-50/50 border-blue-400 font-bold' 
                    : 'bg-white border-slate-100'
                }`}
              >
                {/* Day number */}
                <span className={`text-[11px] self-start px-1.5 py-0.5 rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}>
                  {dayNum}
                </span>

                {/* Day Tasks indicators */}
                <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                  {dayTasks.slice(0, 3).map((task, tidx) => (
                    <div 
                      key={tidx} 
                      className="text-[9px] px-1 py-0.5 rounded-xs text-white truncate font-medium flex items-center gap-0.5"
                      style={{ backgroundColor: task.status === 'Completed' ? '#10B981' : task.status === 'In Progress' ? '#3B82F6' : '#F59E0B' }}
                      title={`${task.title} (สถานะ: ${task.status})`}
                    >
                      <span className="w-1 h-1 bg-white rounded-full shrink-0"></span>
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[8px] text-slate-400 font-semibold pl-1">
                      + อีก {dayTasks.length - 3} งาน
                    </div>
                  )}
                </div>

                {/* Hover Add Button */}
                {userRole !== 'viewer' && (
                  <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100 text-blue-700 p-0.5 rounded-full">
                    <Plus size={10} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar: Month Planner summary & Quick Add form */}
      <div className="space-y-4 no-print">
        {/* Create Task Button */}
        {userRole !== 'viewer' && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-all cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99] duration-150"
            id="btn-planner-create-task"
            title="สร้างใบงานซ่อมบำรุงใหม่"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>สร้างใบงานซ่อมบำรุง</span>
          </button>
        )}

        {/* Month Summary Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500 animate-spin-slow" />
            สรุปเป้าหมายงานประจำเดือน
          </h3>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="block text-[10px] text-slate-400 font-semibold">งานทั้งหมด</span>
              <span className="text-sm font-bold text-slate-700">{summary.total}</span>
            </div>
            <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <span className="block text-[10px] text-emerald-600 font-semibold">เสร็จสิ้น</span>
              <span className="text-sm font-bold text-emerald-700">{summary.completed}</span>
            </div>
            <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
              <span className="block text-[10px] text-amber-600 font-semibold">รอดำเนินการ</span>
              <span className="text-sm font-bold text-amber-700">{summary.pending}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-50">
            <p className="text-xs text-slate-500 font-medium">รายการแผนงานเดือนนี้:</p>
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-50">
              {activeMonthTasks.length > 0 ? (
                activeMonthTasks.map(task => (
                  <div key={task.id} className="pt-2 first:pt-0 flex items-start gap-2 justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 line-clamp-1">{task.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span>วันที่: {task.scheduledDate}</span>
                        {task.departmentOrCompany && (
                          <span className="text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0.2 rounded-xs font-medium text-[9px] truncate max-w-[120px]" title={task.departmentOrCompany}>
                            {task.departmentOrCompany}
                          </span>
                        )}
                        {(task.subdistrict || task.district || task.province) && (
                          <span className="text-slate-600 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded-xs font-medium text-[9px] truncate max-w-[140px]" title={[task.subdistrict, task.district, task.province].filter(Boolean).join(', ')}>
                            📍 {[task.subdistrict, task.district, task.province].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {task.phone && (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded-xs font-medium text-[9px]">
                            📞 {task.phone}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${getStatusBadgeColor(task.status)}`}>
                      {task.status === 'Completed' ? 'เสร็จแล้ว' : task.status === 'In Progress' ? 'กำลังทำ' : task.status === 'Cancelled' ? 'ยกเลิก' : 'ค้างอยู่'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic py-2 text-center">ยังไม่มีแผนงานซ่อมบำรุงใดๆ ในรอบเดือนนี้</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Add Form on selected day */}
        {isQuickAddOpen && selectedDay !== null && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Plus size={14} className="text-blue-600" />
                วางแผนด่วนในวันที่ {selectedDay} {thaiMonths[month]}
              </h4>
              <button 
                onClick={() => setIsQuickAddOpen(false)} 
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ปิด
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">ชื่องานซ่อมบำรุง *</label>
                <input
                  type="text"
                  required
                  placeholder="ระบุชื่อแผนงาน เช่น ตรวจสอบตู้คอนโทรลไฟฟ้า"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">อุปกรณ์ / เครื่องจักร *</label>
                <input
                  type="text"
                  required
                  placeholder="ระบุเครื่องจักรหรือชื่ออุปกรณ์"
                  value={quickEquipment}
                  onChange={(e) => setQuickEquipment(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-600">ประเภทซ่อมบำรุง</label>
                <select
                  value={quickType}
                  onChange={(e) => setQuickType(e.target.value as MaintenanceType)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-700"
                >
                  <option value="Preventive">Preventive Maintenance (PM)</option>
                  <option value="Corrective">Corrective Maintenance (CM)</option>
                  <option value="Predictive">Predictive Maintenance (PdM)</option>
                  <option value="Calibration">Calibration (สอบเทียบ)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
              >
                <span>บันทึกและบรรจุลงตาราง</span>
              </button>
            </form>
          </motion.div>
        )}
      </div>

      {/* Create Task Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" id="planner-create-modal">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="fixed inset-0 bg-black"
            />

            {/* Modal Box */}
            <div className="flex min-h-screen items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden z-10"
              >
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Wrench size={18} className="text-blue-400" />
                    <div>
                      <h3 className="text-sm font-bold">สร้างใบงานซ่อมบำรุงใหม่</h3>
                      <p className="text-[10px] text-slate-300">กรอกข้อมูลเพื่อบันทึกลงฐานข้อมูลงานซ่อมบำรุง</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleFullSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <FileText size={13} className="text-slate-400" />
                      ชื่องานซ่อมบำรุง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ตรวจเช็คตู้คอนโทรลไฟฟ้า, ซ่อมปั๊มน้ำคอนเดนเสทชำรุด"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">รายละเอียดงานเพิ่มเติม</label>
                    <textarea
                      placeholder="ระบุวัตถุประสงค์ ขั้นตอนการทำงาน หรือจุดที่มีปัญหาชำรุด..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2.5}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Equipment */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Wrench size={13} className="text-slate-400" />
                        อุปกรณ์ / เครื่องจักร <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น เครื่องปรับอากาศ AHU-01, มอเตอร์ปั๊มลม"
                        value={equipment}
                        onChange={(e) => setEquipment(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                      />
                    </div>

                    {/* Department or Company */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Building2 size={13} className="text-slate-400" />
                        หน่วยงาน / บริษัท
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ฝ่ายธุรการ, บจก. แอร์เซอร์วิส"
                        value={departmentOrCompany}
                        onChange={(e) => setDepartmentOrCompany(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                      />
                    </div>

                    {/* Assigned To */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <User size={13} className="text-slate-400" />
                        มอบหมายงานให้ช่างซ่อมบำรุง
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ช่างมานะ, ทีมงานบำรุงรักษาพิเศษ"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Address Selection (จังหวัด / อำเภอ / ตำบล) */}
                  <ThaiAddressSelector
                    province={province}
                    district={district}
                    subdistrict={subdistrict}
                    onProvinceChange={setProvince}
                    onDistrictChange={setDistrict}
                    onSubdistrictChange={setSubdistrict}
                  />

                  {/* Phone Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      เบอร์โทรศัพท์ผู้ติดต่อ
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 081-234-5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Type */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Layers size={13} className="text-slate-400" />
                        ประเภทซ่อมบำรุง
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as MaintenanceType)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                      >
                        <option value="Preventive">Preventive Maintenance (PM)</option>
                        <option value="Corrective">Corrective Maintenance (CM)</option>
                        <option value="Predictive">Predictive Maintenance (PdM)</option>
                        <option value="Calibration">Calibration (สอบเทียบ)</option>
                        <option value="Other">Other (อื่นๆ)</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <ShieldAlert size={13} className="text-slate-400" />
                        ความสำคัญ
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as MaintenancePriority)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700 font-semibold"
                      >
                        <option value="Low">ต่ำ / ทั่วไป</option>
                        <option value="Medium">ปานกลาง</option>
                        <option value="High">สูง / เร่งด่วน</option>
                        <option value="Critical">วิกฤต (Critical)</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        สถานะงาน
                      </label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                      >
                        <option value="Pending">Pending (รอดำเนินการ)</option>
                        <option value="In Progress">In Progress (กำลังดำเนินการ)</option>
                        <option value="Completed">Completed (เสร็จสิ้นภารกิจ)</option>
                        <option value="Cancelled">Cancelled (ยกเลิกแผน)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Scheduled Date */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        กำหนดวันที่ดำเนินงาน <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700 font-mono"
                      />
                    </div>

                    {/* Completed Date */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        วันที่งานเสร็จสิ้นจริง
                      </label>
                      <input
                        type="date"
                        disabled={status !== 'Completed'}
                        value={completedDate}
                        onChange={(e) => setCompletedDate(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700 font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <span>บันทึกใบงานซ่อม</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
