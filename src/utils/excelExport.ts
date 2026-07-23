import * as XLSX from 'xlsx';
import { MaintenanceTask, MonthlyInstallation } from '../types';

/**
 * Format status to Thai description
 */
const getStatusThai = (status: string) => {
  switch (status) {
    case 'Completed': return 'เสร็จสิ้นภารกิจ';
    case 'In Progress': return 'กำลังดำเนินการ';
    case 'Pending': return 'รอดำเนินการ';
    case 'Cancelled': return 'ยกเลิกแผน';
    case 'Operational': return 'ใช้งานปกติ';
    case 'Pending Testing': return 'รอดำเนินการทดสอบ';
    case 'Needs Maintenance': return 'ต้องการซ่อมบำรุง';
    default: return status;
  }
};

/**
 * Format type to Thai/English description
 */
const getTypeThai = (type: string) => {
  switch (type) {
    case 'Preventive': return 'Preventive Maintenance (PM)';
    case 'Corrective': return 'Corrective Maintenance (CM)';
    case 'Predictive': return 'Predictive Maintenance (PdM)';
    case 'Calibration': return 'Calibration (สอบเทียบ)';
    default: return 'อื่นๆ (Other)';
  }
};

/**
 * Format priority to Thai
 */
const getPriorityThai = (priority: string) => {
  switch (priority) {
    case 'Low': return 'ต่ำ';
    case 'Medium': return 'ปานกลาง';
    case 'High': return 'สูง';
    case 'Critical': return 'วิกฤต';
    default: return priority;
  }
};

/**
 * Helper to construct location address string
 */
const formatAddress = (t: MaintenanceTask) => {
  const parts = [];
  if (t.subdistrict) parts.push(`ต.${t.subdistrict}`);
  if (t.district) parts.push(`อ.${t.district}`);
  if (t.province) parts.push(`จ.${t.province}`);
  return parts.length > 0 ? parts.join(' ') : (t.checkInLocation?.address || '-');
};

/**
 * Export Maintenance Tasks to an Excel (.xlsx) file
 */
export const exportTasksToExcel = (tasks: MaintenanceTask[], filename = 'รายการงานซ่อมบำรุง.xlsx') => {
  const excelData = tasks.map((t, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสงาน': t.id || '-',
    'ชื่องาน / หัวข้อ': t.title,
    'เครื่องจักร / อุปกรณ์': t.equipment,
    'หน่วยงาน / บริษัท': t.departmentOrCompany || '-',
    'ประเภทงาน': getTypeThai(t.type),
    'ระดับความสำคัญ': getPriorityThai(t.priority),
    'ผู้รับผิดชอบ / ช่าง': t.assignedTo || 'ยังไม่ได้มอบหมาย',
    'กำหนดการ': t.scheduledDate || '-',
    'วันที่เสร็จสิ้น': t.completedDate || '-',
    'สถานะงาน': getStatusThai(t.status),
    'การอนุมัติ': t.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ',
    'ผู้อนุมัติ': t.approvedBy || '-',
    'วันที่อนุมัติ': t.approvedAt ? new Date(t.approvedAt).toLocaleDateString('th-TH') : '-',
    'สถานที่ / ที่อยู่': formatAddress(t),
    'รายละเอียดงาน': t.description || '-',
    'หมายเหตุ': t.notes || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = Object.keys(excelData[0] || {}).map(key => ({
    wch: Math.max(key.length * 2, 16)
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'งานซ่อมบำรุง');

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
};

/**
 * Export Monthly Installations to an Excel (.xlsx) file
 */
export const exportInstallationsToExcel = (installations: MonthlyInstallation[], filename = 'รายการงานติดตั้ง.xlsx') => {
  const excelData = installations.map((inst, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสการติดตั้ง': inst.id || '-',
    'ชื่ออุปกรณ์ / เครื่องจักร': inst.equipmentName,
    'ซีเรียลนัมเบอร์ (S/N)': inst.serialNumber || '-',
    'รุ่น (Model)': inst.model || '-',
    'สถานที่ติดตั้ง': inst.location || '-',
    'วันที่ติดตั้ง': inst.installDate || '-',
    'ระยะเวลารับประกัน (เดือน)': inst.warrantyPeriodMonths || 0,
    'ช่างผู้รับผิดชอบ': inst.technician || '-',
    'สถานะการติดตั้ง': getStatusThai(inst.status),
    'การอนุมัติ': inst.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ',
    'ผู้อนุมัติ': inst.approvedBy || '-',
    'หมายเหตุ': inst.notes || '-'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const colWidths = Object.keys(excelData[0] || {}).map(key => ({
    wch: Math.max(key.length * 2, 16)
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'งานติดตั้ง');

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
};

/**
 * Export Full Dashboard Summary (Multiple Sheets) to Excel (.xlsx)
 */
export const exportDashboardSummaryToExcel = (
  tasks: MaintenanceTask[],
  installations: MonthlyInstallation[],
  selectedMonth: string
) => {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary KPIs
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
  const successRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) + '%' : '0%';

  const summaryData = [
    { 'หัวข้อสรุป': 'ประจำเดือน', 'ค่า': selectedMonth },
    { 'หัวข้อสรุป': 'จำนวนงานซ่อมบำรุงทั้งหมด', 'ค่า': totalTasks },
    { 'หัวข้อสรุป': 'งานที่เสร็จสิ้น (Completed)', 'ค่า': completedTasks },
    { 'หัวข้อสรุป': 'งานกำลังดำเนินการ (In Progress)', 'ค่า': inProgressTasks },
    { 'หัวข้อสรุป': 'งานรอดำเนินการ (Pending)', 'ค่า': pendingTasks },
    { 'หัวข้อสรุป': 'อัตราความสำเร็จ (%)', 'ค่า': successRate },
    { 'หัวข้อสรุป': 'จำนวนรายการติดตั้งทั้งหมด', 'ค่า': installations.length }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'สรุปภาพรวม');

  // Sheet 2: Tasks List
  if (tasks.length > 0) {
    const tasksData = tasks.map((t, idx) => ({
      'ลำดับ': idx + 1,
      'รหัสงาน': t.id || '-',
      'ชื่องาน / หัวข้อ': t.title,
      'เครื่องจักร / อุปกรณ์': t.equipment,
      'หน่วยงาน / บริษัท': t.departmentOrCompany || '-',
      'ประเภทงาน': getTypeThai(t.type),
      'ระดับความสำคัญ': getPriorityThai(t.priority),
      'ผู้รับผิดชอบ / ช่าง': t.assignedTo || 'ยังไม่ได้มอบหมาย',
      'กำหนดการ': t.scheduledDate || '-',
      'วันที่เสร็จสิ้น': t.completedDate || '-',
      'สถานะงาน': getStatusThai(t.status),
      'การอนุมัติ': t.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ',
      'สถานที่': formatAddress(t)
    }));
    const wsTasks = XLSX.utils.json_to_sheet(tasksData);
    wsTasks['!cols'] = Object.keys(tasksData[0] || {}).map(k => ({ wch: Math.max(k.length * 2, 16) }));
    XLSX.utils.book_append_sheet(workbook, wsTasks, 'รายการงานซ่อมบำรุง');
  }

  // Sheet 3: Installations List
  if (installations.length > 0) {
    const instData = installations.map((inst, idx) => ({
      'ลำดับ': idx + 1,
      'รหัสการติดตั้ง': inst.id || '-',
      'ชื่ออุปกรณ์ / เครื่องจักร': inst.equipmentName,
      'ซีเรียลนัมเบอร์ (S/N)': inst.serialNumber || '-',
      'รุ่น (Model)': inst.model || '-',
      'สถานที่ติดตั้ง': inst.location || '-',
      'วันที่ติดตั้ง': inst.installDate || '-',
      'ระยะเวลารับประกัน (เดือน)': inst.warrantyPeriodMonths || 0,
      'ช่างผู้รับผิดชอบ': inst.technician || '-',
      'สถานะการติดตั้ง': getStatusThai(inst.status),
      'การอนุมัติ': inst.isApproved ? 'อนุมัติแล้ว' : 'รออนุมัติ'
    }));
    const wsInst = XLSX.utils.json_to_sheet(instData);
    wsInst['!cols'] = Object.keys(instData[0] || {}).map(k => ({ wch: Math.max(k.length * 2, 16) }));
    XLSX.utils.book_append_sheet(workbook, wsInst, 'รายการงานติดตั้ง');
  }

  const safeMonthName = selectedMonth.replace(/[/\\?%*:|"<>]/g, '_');
  XLSX.writeFile(workbook, `รายงานสรุปงานซ่อมบำรุง_${safeMonthName}.xlsx`);
};
