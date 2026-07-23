import React, { useState, useMemo } from 'react';
import { MonthlyInstallation, InstallationStatus, AppUserRole } from '../types';
import { 
  Plus, Search, Edit2, Trash2, CalendarRange, MapPin, 
  User, Sparkles, AlertTriangle, ShieldCheck, Tag, X, Clock, HelpCircle, FileText, ChevronDown, FileSpreadsheet 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportInstallationsToExcel } from '../utils/excelExport';

interface MonthlyInstallationsProps {
  installations: MonthlyInstallation[];
  userRole: AppUserRole;
  currentUserEmail: string;
  onAddInstallation: (installation: Omit<MonthlyInstallation, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateInstallation: (id: string, updates: Partial<MonthlyInstallation>) => Promise<void>;
  onDeleteInstallation: (id: string) => Promise<void>;
}

export default function MonthlyInstallations({
  installations,
  userRole,
  currentUserEmail,
  onAddInstallation,
  onUpdateInstallation,
  onDeleteInstallation
}: MonthlyInstallationsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInstallation, setEditingInstallation] = useState<MonthlyInstallation | null>(null);

  // Form Fields
  const [equipmentName, setEquipmentName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [model, setModel] = useState('');
  const [location, setLocation] = useState('');
  const [installDate, setInstallDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [technician, setTechnician] = useState('');
  const [warrantyPeriodMonths, setWarrantyPeriodMonths] = useState<number>(12);
  const [status, setStatus] = useState<InstallationStatus>('Operational');
  const [notes, setNotes] = useState('');
  const [isApproved, setIsApproved] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEquipmentName('');
    setSerialNumber('');
    setModel('');
    setLocation('');
    const today = new Date();
    setInstallDate(today.toISOString().split('T')[0]);
    setTechnician('');
    setWarrantyPeriodMonths(12);
    setStatus('Operational');
    setNotes('');
    setIsApproved(false);
    setEditingInstallation(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inst: MonthlyInstallation) => {
    if (inst.isApproved && userRole !== 'admin') {
      alert('🔒 ขออภัย บันทึกการติดตั้งนี้ได้รับการอนุมัติแล้ว เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขข้อมูลได้');
      return;
    }
    setEditingInstallation(inst);
    setEquipmentName(inst.equipmentName);
    setSerialNumber(inst.serialNumber);
    setModel(inst.model || '');
    setLocation(inst.location);
    setInstallDate(inst.installDate);
    setTechnician(inst.technician || '');
    setWarrantyPeriodMonths(inst.warrantyPeriodMonths);
    setStatus(inst.status);
    setNotes(inst.notes || '');
    setIsApproved(inst.isApproved || false);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentName || !serialNumber || !location || !installDate) {
      alert('กรุณากรอกข้อมูลที่สำคัญให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: any = {
        equipmentName,
        serialNumber,
        model,
        location,
        installDate,
        technician,
        warrantyPeriodMonths: Number(warrantyPeriodMonths),
        status,
        notes,
        isApproved: userRole === 'admin' ? isApproved : (editingInstallation ? (editingInstallation.isApproved || false) : false)
      };

      if (userRole === 'admin') {
        if (isApproved) {
          data.approvedBy = editingInstallation?.approvedBy || currentUserEmail;
          data.approvedAt = editingInstallation?.approvedAt || new Date().toISOString();
        } else {
          data.approvedBy = '';
          data.approvedAt = '';
        }
      }

      if (editingInstallation && editingInstallation.id) {
        await onUpdateInstallation(editingInstallation.id, data);
      } else {
        await onAddInstallation(data);
      }
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      await onDeleteInstallation(id);
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute warranty status and expiration date
  const getWarrantyDetails = (installDateStr: string, periodMonths: number) => {
    if (!installDateStr) return { dateStr: '-', isExpired: true };
    
    const start = new Date(installDateStr);
    const end = new Date(start.setMonth(start.getMonth() + periodMonths));
    
    const today = new Date();
    const isExpired = today > end;
    
    const endYearThai = end.getFullYear() + 543;
    const endMonth = String(end.getMonth() + 1).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');

    return {
      dateStr: `${endDay}/${endMonth}/${endYearThai}`,
      isExpired
    };
  };

  // Filter and Search Installations
  const filteredInstallations = useMemo(() => {
    return installations.filter(inst => {
      const matchesSearch = 
        inst.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inst.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inst.model && inst.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        inst.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inst.technician && inst.technician.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = filterStatus === 'all' || inst.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [installations, searchTerm, filterStatus]);

  const getStatusBadge = (status: InstallationStatus) => {
    switch (status) {
      case 'Operational':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Pending Testing':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Needs Maintenance':
        return 'bg-rose-50 text-rose-700 border-rose-100';
    }
  };

  const getStatusThai = (status: InstallationStatus) => {
    switch (status) {
      case 'Operational': return 'ใช้งานปกติ';
      case 'Pending Testing': return 'รอดำเนินการทดสอบ';
      case 'Needs Maintenance': return 'ต้องได้รับการซ่อมบำรุง';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and filter bar */}
      <div className="bg-white p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3.5 items-center justify-between no-print">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ชื่อเครื่องจักร, ซีเรียลนัมเบอร์, สถานที่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-xl pl-9.5 pr-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all font-medium text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 px-3 py-2 rounded-xl border border-slate-200/80 transition-all">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-0 text-slate-700 text-xs font-semibold focus:ring-0 focus:outline-hidden cursor-pointer"
            >
              <option value="all">สถานะติดตั้ง: ทั้งหมด</option>
              <option value="Operational">ใช้งานได้ปกติ</option>
              <option value="Pending Testing">รอดำเนินการทดสอบ</option>
              <option value="Needs Maintenance">ต้องการซ่อมบำรุง</option>
            </select>
          </div>

          <button
            onClick={() => exportInstallationsToExcel(filteredInstallations, `รายการงานติดตั้ง_${new Date().toISOString().slice(0,10)}`)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs hover:shadow-md active:scale-95"
            title="ส่งออกรายการงานติดตั้งเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>ส่งออก Excel</span>
          </button>

          {userRole !== 'viewer' && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs hover:shadow-md active:scale-95"
            >
              <Plus size={15} />
              <span>ลงทะเบียนการติดตั้ง</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid List of Installations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
        {filteredInstallations.length > 0 ? (
          filteredInstallations.map((inst) => {
            const warranty = getWarrantyDetails(inst.installDate, inst.warrantyPeriodMonths);
            return (
              <motion.div
                key={inst.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between hover:border-purple-300 transition-colors"
              >
                <div>
                  {/* Top line with status and type */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Tag size={11} />
                      S/N: {inst.serialNumber}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Approval Status Toggle for Admin */}
                      {userRole === 'admin' ? (
                        <button
                          onClick={async () => {
                            const nextApproved = !inst.isApproved;
                            try {
                              await onUpdateInstallation(inst.id!, {
                                isApproved: nextApproved,
                                approvedBy: nextApproved ? currentUserEmail : '',
                                approvedAt: nextApproved ? new Date().toISOString() : ''
                              });
                            } catch (error) {
                              console.error("Error toggling installation approval:", error);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer transition-all hover:shadow-2xs active:scale-95 border ${
                            inst.isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/80'
                              : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/80'
                          }`}
                          title="คลิกเพื่อสลับสถานะอนุมัติ / รออนุมัติ"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${inst.isApproved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                          <span>{inst.isApproved ? 'อนุมัติแล้ว ✓' : 'รออนุมัติ ⏳'}</span>
                          <ChevronDown size={10} className="text-slate-400 opacity-60 ml-0.5" />
                        </button>
                      ) : inst.isApproved ? (
                        <span 
                          className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[9.5px] font-bold px-2 py-0.5 rounded-full"
                          title={`อนุมัติโดย: ${inst.approvedBy || ''} เมื่อ ${inst.approvedAt ? new Date(inst.approvedAt).toLocaleDateString('th-TH') : ''}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          อนุมัติแล้ว
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 text-[9.5px] font-bold px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          รออนุมัติ
                        </span>
                      )}

                      {/* Installation Status Select for Admin */}
                      {userRole === 'admin' ? (
                        <div className="relative inline-flex items-center" title="คลิกเพื่อเปลี่ยนสถานะติดตั้ง">
                          <select
                            value={inst.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as InstallationStatus;
                              try {
                                await onUpdateInstallation(inst.id!, {
                                  status: newStatus
                                });
                              } catch (error) {
                                console.error("Error updating installation status:", error);
                              }
                            }}
                            className={`text-[10.5px] font-bold px-3 py-0.5 pr-6 rounded-full border cursor-pointer appearance-none outline-none shadow-2xs transition-all active:scale-95 ${getStatusBadge(inst.status)}`}
                          >
                            <option value="Operational">🟢 ใช้งานปกติ (Operational)</option>
                            <option value="Under Maintenance">🟡 อยู่ระหว่างซ่อมบำรุง</option>
                            <option value="Pending">🕒 รอการตรวจสอบ (Pending)</option>
                            <option value="Decommissioned">🔴 ยกเลิกใช้งาน (Decommissioned)</option>
                          </select>
                          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                        </div>
                      ) : (
                        <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full ${getStatusBadge(inst.status)}`}>
                          {getStatusThai(inst.status)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Machine Name and Model */}
                  <h4 className="text-sm font-bold text-slate-800 line-clamp-1 text-left">{inst.equipmentName}</h4>
                  {inst.model && (
                    <p className="text-[11px] text-slate-500 font-medium text-left">โมเดล: {inst.model}</p>
                  )}

                  {/* Description / metadata details */}
                  <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-50 pt-3 text-left">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span>สถานที่ติดตั้ง: <span className="font-semibold text-slate-700">{inst.location}</span></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <CalendarRange size={13} className="text-slate-400 shrink-0" />
                      <span>วันที่ติดตั้ง: <span className="font-semibold text-slate-700">{inst.installDate}</span></span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-slate-400 shrink-0" />
                      <span>ช่างผู้ติดตั้ง: <span className="font-semibold text-slate-700">{inst.technician || 'ไม่ระบุชื่อ'}</span></span>
                    </div>
                  </div>

                  {/* Warranty Information Box */}
                  <div className={`mt-3 p-2.5 rounded-lg border text-[11px] flex items-center gap-2 text-left ${
                    warranty.isExpired 
                      ? 'bg-rose-50 border-rose-100 text-rose-700' 
                      : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  }`}>
                    {warranty.isExpired ? (
                      <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                    ) : (
                      <ShieldCheck size={14} className="shrink-0 text-emerald-500" />
                    )}
                    <div>
                      <span className="font-bold">ประกันสิ้นสุด: </span>
                      <span>{warranty.dateStr}</span>
                      <span className="block text-[10px] text-slate-400">
                        ({inst.warrantyPeriodMonths} เดือน - {warranty.isExpired ? 'หมดประกันแล้ว' : 'อยู่ในประกัน'})
                      </span>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {inst.notes && (
                    <p className="mt-3 text-[10px] text-slate-400 bg-slate-50 p-2 rounded-md line-clamp-2 text-left">
                      <span className="font-bold">หมายเหตุ: </span>{inst.notes}
                    </p>
                  )}
                </div>

                {/* Edit and Delete Buttons */}
                {userRole !== 'viewer' && (
                  <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end gap-1.5 items-center flex-wrap">
                    <button
                      onClick={() => handleOpenEdit(inst)}
                      className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold"
                    >
                      <Edit2 size={12} />
                      <span>แก้ไขข้อมูล</span>
                    </button>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => setDeleteId(inst.id || null)}
                        className="flex items-center gap-1 text-[11px] text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1.5 rounded-lg transition-colors cursor-pointer font-semibold"
                      >
                        <Trash2 size={12} />
                        <span>ลบรายการ</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-slate-400 text-xs bg-white rounded-xl border border-slate-100 shadow-xs">
            ไม่พบข้อมูลบันทึกการติดตั้งอุปกรณ์ใหม่ในขณะนี้
          </div>
        )}
      </div>

      {/* Create / Edit Modal Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarRange size={16} className="text-purple-600" />
                  {editingInstallation ? 'แก้ไขรายละเอียดการติดตั้งเครื่องจักร' : 'บันทึกประวัติการติดตั้งอุปกรณ์ใหม่'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Equipment Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <FileText size={13} className="text-slate-400" />
                    ชื่ออุปกรณ์ / เครื่องจักรหลัก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เครื่องปรับอากาศกลางอาคาร, เครื่องเชื่อมบอร์ด PCB ออโต้"
                    value={equipmentName}
                    onChange={(e) => setEquipmentName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">โมเดล / รุ่น</label>
                    <input
                      type="text"
                      placeholder="เช่น MX-2400-P, Series 7"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>

                  {/* Serial Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Tag size={13} className="text-slate-400" />
                      หมายเลขซีเรียล (Serial Number) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น SN-8742-192-A"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Location */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <MapPin size={13} className="text-slate-400" />
                      สถานที่ติดตั้ง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ห้องเซิร์ฟเวอร์ ชั้น 3, อาคารผลิตแผนก C"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>

                  {/* Technician */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <User size={13} className="text-slate-400" />
                      ช่างเทคนิคผู้ทำการติดตั้ง
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น นายปริญญา และทีม"
                      value={technician}
                      onChange={(e) => setTechnician(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Install Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <CalendarRange size={13} className="text-slate-400" />
                      วันที่เข้าดำเนินการติดตั้ง <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={installDate}
                      onChange={(e) => setInstallDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700 font-mono"
                    />
                  </div>

                  {/* Warranty Period */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <ShieldCheck size={13} className="text-slate-400" />
                      ระยะรับประกันสินค้า (เดือน)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={warrantyPeriodMonths}
                      onChange={(e) => setWarrantyPeriodMonths(Number(e.target.value))}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" />
                    สถานะหลังทำการติดตั้ง
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InstallationStatus)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700 font-semibold"
                  >
                    <option value="Operational" className="text-emerald-600">Operational (เปิดใช้งานปกติทันที)</option>
                    <option value="Pending Testing" className="text-amber-600">Pending Testing (อยู่ระหว่างรอนำเข้าระบบ/ทดสอบ)</option>
                    <option value="Needs Maintenance" className="text-rose-600">Needs Maintenance (ตรวจพบความเสียหาย/ต้องบำรุงรักษาเพิ่มเติม)</option>
                  </select>
                </div>

                {/* Admin Approval Section */}
                {userRole === 'admin' && (
                  <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-4 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <span>✓ อนุมัติบันทึกการติดตั้งนี้ (Admin Approval)</span>
                      </span>
                      <p className="text-[10px] text-emerald-600 font-medium">เมื่ออนุมัติแล้ว ข้อมูลนี้จะถูกบันทึกเป็น "อนุมัติแล้ว" และจะจำกัดการแก้ไขเฉพาะผู้ดูแลระบบ</p>
                      {editingInstallation?.approvedBy && (
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">อนุมัติโดย: {editingInstallation.approvedBy} ({editingInstallation.approvedAt ? new Date(editingInstallation.approvedAt).toLocaleDateString('th-TH') : ''})</p>
                      )}
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={isApproved} 
                        onChange={(e) => setIsApproved(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">หมายเหตุเพิ่มเติม</label>
                  <textarea
                    placeholder="ระบุเงื่อนไขการติดตั้ง อุปกรณ์เสริมที่แถมมา หรือข้อควรระวังในการบำรุงรักษาเครื่อง..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-medium text-slate-700"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    {isSubmitting && <Clock size={13} className="animate-spin" />}
                    <span>{editingInstallation ? 'บันทึกข้อมูลการแก้ไข' : 'ลงทะเบียนสำเร็จ'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-xl shadow-xl border border-slate-100 p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <AlertTriangle size={24} />
                <h4 className="text-sm font-bold">ยืนยันการลบประวัติติดตั้ง?</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                คุณแน่ใจว่าต้องการลบประวัติการติดตั้งอุปกรณ์นี้? รายการบำรุงรักษาอื่นจะไม่ถูกทำลาย แต่ประวัติการติดตั้งและเวลาเริ่มประกันชิ้นนี้จะสูญหายถาวร
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => deleteId && handleDelete(deleteId)}
                  disabled={isSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  {isSubmitting && <Clock size={13} className="animate-spin" />}
                  <span>ยืนยันการลบ</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
