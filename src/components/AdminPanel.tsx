import { useState, FormEvent } from 'react';
import { UserRole, AppUserRole } from '../types';
import { 
  Shield, 
  ShieldAlert, 
  Users, 
  Search, 
  RefreshCw, 
  Info, 
  Check, 
  Trash2, 
  UserPlus, 
  X, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Mail,
  User as UserIcon,
  HelpCircle
} from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface AdminPanelProps {
  usersRoles: UserRole[];
  currentUserEmail: string;
}

export default function AdminPanel({ usersRoles, currentUserEmail }: AdminPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | AppUserRole>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({});
  
  // UI states
  const [showMatrix, setShowMatrix] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // Add user form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppUserRole>('viewer');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null);

  // Demote/Delete confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'demote' | 'delete';
    userRole?: UserRole;
    pendingRole?: AppUserRole;
  }>({ isOpen: false, type: 'delete' });

  // Handle changing user role
  const executeRoleChange = async (userRole: UserRole, targetRole: AppUserRole) => {
    const docId = userRole.id || userRole.userId;
    if (!docId) return;

    setUpdatingUserId(userRole.userId);
    setSaveStatus(prev => ({ ...prev, [userRole.userId]: null }));

    try {
      const docRef = doc(db, 'user_roles', docId);
      await setDoc(docRef, {
        userId: userRole.userId,
        email: userRole.email,
        displayName: userRole.displayName || '',
        photoURL: userRole.photoURL || '',
        role: targetRole,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveStatus(prev => ({ ...prev, [userRole.userId]: 'success' }));
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [userRole.userId]: null }));
      }, 3000);
    } catch (error) {
      console.error('Error changing user role:', error);
      setSaveStatus(prev => ({ ...prev, [userRole.userId]: 'error' }));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRoleChange = (userRole: UserRole, targetRole: AppUserRole) => {
    if (userRole.role === targetRole) return; // No change

    // Check if self-demotion from Admin
    if (userRole.email === currentUserEmail && userRole.role === 'admin' && targetRole !== 'admin') {
      setConfirmModal({
        isOpen: true,
        type: 'demote',
        userRole,
        pendingRole: targetRole
      });
      return;
    }

    executeRoleChange(userRole, targetRole);
  };

  // Handle deleting a user role record
  const executeDeleteUserRole = async (userRole: UserRole) => {
    const docId = userRole.id || userRole.userId;
    if (!docId) return;

    setUpdatingUserId(userRole.userId);

    try {
      await deleteDoc(doc(db, 'user_roles', docId));
    } catch (error) {
      console.error('Error deleting user role:', error);
      alert('เกิดข้อผิดพลาดในการลบสิทธิ์ผู้ใช้งาน');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteClick = (userRole: UserRole) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      userRole
    });
  };

  // Add new pre-granted user role
  const handleAddUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setAddUserError('กรุณากรอกอีเมลผู้ใช้งาน');
      return;
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const cleanDocId = 'user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');

    setIsSubmittingNewUser(true);
    setAddUserError(null);
    setAddUserSuccess(null);

    try {
      const docRef = doc(db, 'user_roles', cleanDocId);
      await setDoc(docRef, {
        userId: cleanDocId,
        email: cleanEmail,
        displayName: newName.trim() || cleanEmail.split('@')[0],
        photoURL: '',
        role: newRole,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setAddUserSuccess(`เพิ่มกำหนดสิทธิ์ล่วงหน้าให้ ${cleanEmail} เรียบร้อยแล้ว`);
      setNewEmail('');
      setNewName('');
      setNewRole('viewer');

      setTimeout(() => {
        setShowAddUserModal(false);
        setAddUserSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error adding user role:', err);
      setAddUserError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || ''));
    } finally {
      setIsSubmittingNewUser(false);
    }
  };

  // Track duplicate emails
  const emailCounts = usersRoles.reduce((acc, u) => {
    if (u.email) {
      const e = u.email.toLowerCase();
      acc[e] = (acc[e] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter logic
  const filteredUsers = usersRoles.filter((user) => {
    // Role filter
    if (selectedRoleFilter !== 'all' && user.role !== selectedRoleFilter) {
      return false;
    }

    // Search term filter
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    const name = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    const uid = (user.userId || '').toLowerCase();

    return name.includes(term) || email.includes(term) || role.includes(term) || uid.includes(term);
  });

  // Role Statistics
  const totalUsers = usersRoles.length;
  const adminCount = usersRoles.filter(u => u.role === 'admin').length;
  const techCount = usersRoles.filter(u => u.role === 'technician').length;
  const viewerCount = usersRoles.filter(u => u.role === 'viewer').length;

  return (
    <div className="space-y-6 text-left font-sans max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner & Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-lg border border-slate-700/50 relative overflow-hidden">
        {/* Ambient subtle glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl backdrop-blur-md">
                <Shield size={26} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  ระบบจัดการสิทธิ์ผู้ใช้งาน
                  <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
                    Access Control Center
                  </span>
                </h2>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  กำหนดระดับสิทธิ์ให้ทีมงาน เพื่อควบคุมการเพิ่ม ลบ แก้ไข และสิทธิ์เข้าถึงระบบซ่อมบำรุง
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowMatrix(!showMatrix)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-600/60 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <HelpCircle size={15} className="text-amber-400" />
              <span>{showMatrix ? 'ซ่อนตารางเปรียบเทียบสิทธิ์' : 'ตารางเปรียบเทียบสิทธิ์'}</span>
              {showMatrix ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md hover:shadow-rose-600/30 transition-all cursor-pointer border border-rose-400/30"
            >
              <UserPlus size={16} />
              <span>เพิ่มผู้ใช้งาน / กำหนดสิทธิ์ล่วงหน้า</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Quick Filter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card: All Users */}
        <button
          type="button"
          onClick={() => setSelectedRoleFilter('all')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedRoleFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${selectedRoleFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
              <Users size={18} />
            </div>
            <span className={`text-2xl font-black ${selectedRoleFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
              {totalUsers}
            </span>
          </div>
          <div className="font-extrabold text-xs">พนักงานทั้งหมด</div>
          <div className={`text-[10px] font-medium mt-0.5 ${selectedRoleFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>
            รวมบัญชีทั้งหมดในระบบ
          </div>
        </button>

        {/* Card: Admin */}
        <button
          type="button"
          onClick={() => setSelectedRoleFilter('admin')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedRoleFilter === 'admin'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white hover:bg-rose-50/50 text-slate-800 border-slate-200/80 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${selectedRoleFilter === 'admin' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <Shield size={18} />
            </div>
            <span className={`text-2xl font-black ${selectedRoleFilter === 'admin' ? 'text-white' : 'text-rose-600'}`}>
              {adminCount}
            </span>
          </div>
          <div className="font-extrabold text-xs flex items-center gap-1">
            ผู้ดูแลระบบ (Admin)
          </div>
          <div className={`text-[10px] font-medium mt-0.5 ${selectedRoleFilter === 'admin' ? 'text-rose-100' : 'text-slate-500'}`}>
            สิทธิ์จัดการสูงสุด (Full Control)
          </div>
        </button>

        {/* Card: Technician */}
        <button
          type="button"
          onClick={() => setSelectedRoleFilter('technician')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedRoleFilter === 'technician'
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-500/30'
              : 'bg-white hover:bg-blue-50/50 text-slate-800 border-slate-200/80 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${selectedRoleFilter === 'technician' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <RefreshCw size={18} />
            </div>
            <span className={`text-2xl font-black ${selectedRoleFilter === 'technician' ? 'text-white' : 'text-blue-600'}`}>
              {techCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">ช่างเทคนิค (Technician)</div>
          <div className={`text-[10px] font-medium mt-0.5 ${selectedRoleFilter === 'technician' ? 'text-blue-100' : 'text-slate-500'}`}>
            ปฏิบัติงาน & เช็คอิน GPS หน้างาน
          </div>
        </button>

        {/* Card: Viewer */}
        <button
          type="button"
          onClick={() => setSelectedRoleFilter('viewer')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            selectedRoleFilter === 'viewer'
              ? 'bg-slate-700 text-white border-slate-700 shadow-md ring-2 ring-slate-600/30'
              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/80 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={`p-2 rounded-xl ${selectedRoleFilter === 'viewer' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Info size={18} />
            </div>
            <span className={`text-2xl font-black ${selectedRoleFilter === 'viewer' ? 'text-white' : 'text-slate-700'}`}>
              {viewerCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">ผู้เข้าชม (Viewer)</div>
          <div className={`text-[10px] font-medium mt-0.5 ${selectedRoleFilter === 'viewer' ? 'text-slate-200' : 'text-slate-500'}`}>
            สิทธิ์อ่านอย่างเดียว (Read-Only)
          </div>
        </button>
      </div>

      {/* 3. Permissions Comparison Matrix Accordion */}
      {showMatrix && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <h3 className="font-black text-sm text-slate-900">ตารางเปรียบเทียบสิทธิ์การใช้งาน (Permissions Matrix)</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              ระดับสิทธิ์มีผลทันทีต่อการมองเห็นปุ่มและเมนูในแอปพลิเคชัน
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-4 rounded-l-xl">ฟังก์ชั่นงาน / สิทธิ์การเข้าถึง</th>
                  <th className="py-2.5 px-4 text-center text-rose-700 bg-rose-50/50">🛡️ ผู้ดูแล (Admin)</th>
                  <th className="py-2.5 px-4 text-center text-blue-700 bg-blue-50/50">🛠️ ช่างเทคนิค (Technician)</th>
                  <th className="py-2.5 px-4 text-center text-slate-700 bg-slate-100/50 rounded-r-xl">👁️ ผู้เข้าชม (Viewer)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">เข้าถึงแดชบอร์ด, รายงานสรุป, ปฏิทินปฏิบัติงาน และรายการติดตั้งอุปกรณ์</td>
                  <td className="py-3 px-4 text-center bg-rose-50/20 text-emerald-600 font-bold">✓ สิทธิ์อ่านเต็ม</td>
                  <td className="py-3 px-4 text-center bg-blue-50/20 text-emerald-600 font-bold">✓ สิทธิ์อ่านเต็ม</td>
                  <td className="py-3 px-4 text-center bg-slate-50/30 text-emerald-600 font-bold">✓ สิทธิ์อ่านเต็ม</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">เช็คอิน / เช็คเอาท์ GPS หน้างาน พร้อมอัปโหลดรูปภาพหลักฐาน</td>
                  <td className="py-3 px-4 text-center bg-rose-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-blue-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-slate-50/30 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">เปิดใบงานใหม่, อัปเดตสถานะงานซ่อมบำรุง และลงบันทึกการทำงาน</td>
                  <td className="py-3 px-4 text-center bg-rose-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-blue-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-slate-50/30 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">ลบข้อมูลใบงานซ่อมบำรุง / บันทึกประวัติ</td>
                  <td className="py-3 px-4 text-center bg-rose-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-blue-50/20 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-slate-50/30 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-800">เข้าถึงระบบจัดการสิทธิ์ผู้ใช้งาน (Access Control Center)</td>
                  <td className="py-3 px-4 text-center bg-rose-50/20 text-emerald-600 font-bold">✓ อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-blue-50/20 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                  <td className="py-3 px-4 text-center bg-slate-50/30 text-rose-500 font-bold">✕ ไม่อนุญาต</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Search and User Management Controls */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, สิทธิ์ หรือ UID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold text-slate-800 placeholder-slate-400 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'all'
                  ? 'bg-slate-900 text-white font-extrabold shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              ทั้งหมด ({totalUsers})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('admin')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'admin'
                  ? 'bg-rose-600 text-white font-extrabold shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              🛡️ Admin ({adminCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('technician')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'technician'
                  ? 'bg-blue-600 text-white font-extrabold shadow-2xs'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🛠️ ช่างเทคนิค ({techCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('viewer')}
              className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedRoleFilter === 'viewer'
                  ? 'bg-slate-700 text-white font-extrabold shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              👁️ ผู้เข้าชม ({viewerCount})
            </button>
          </div>
        </div>

        {/* 5. Users List - Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          {filteredUsers.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-6">ผู้ใช้งาน (User Profile)</th>
                  <th className="py-3.5 px-6">อีเมล (Email)</th>
                  <th className="py-3.5 px-6">กำหนดสิทธิ์ทันที (1-Click Change)</th>
                  <th className="py-3.5 px-6 text-right">อัปเดตล่าสุด</th>
                  <th className="py-3.5 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.email === currentUserEmail;
                  const isUpdating = updatingUserId === user.userId;
                  const status = saveStatus[user.userId || ''];
                  const isDuplicateEmail = user.email && emailCounts[user.email.toLowerCase()] > 1;

                  return (
                    <tr key={user.id || user.userId} className="hover:bg-slate-50/60 transition-colors">
                      {/* User Profile Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'User'}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-xs uppercase shrink-0 border border-slate-200">
                              {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{user.displayName || 'ไม่ระบุชื่อ'}</span>
                              {isCurrentUser && (
                                <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                                  คุณ (You)
                                </span>
                              )}
                              {isDuplicateEmail && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-md" title="อีเมลนี้มีหลาย UID ในฐานข้อมูล">
                                  ⚠️ บัญชีซ้ำ
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">UID: {user.userId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-6 font-mono text-slate-600 font-bold">
                        {user.email || '-'}
                      </td>

                      {/* Segmented Control Role Buttons */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shrink-0">
                            {/* Admin Pill */}
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleRoleChange(user, 'admin')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                user.role === 'admin'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <Shield size={12} />
                              <span>Admin</span>
                            </button>

                            {/* Technician Pill */}
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleRoleChange(user, 'technician')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                user.role === 'technician'
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <RefreshCw size={12} />
                              <span>ช่างเทคนิค</span>
                            </button>

                            {/* Viewer Pill */}
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleRoleChange(user, 'viewer')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                user.role === 'viewer'
                                  ? 'bg-slate-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                              }`}
                            >
                              <Info size={12} />
                              <span>ผู้เข้าชม</span>
                            </button>
                          </div>

                          {/* Loading or status feedback */}
                          {isUpdating && (
                            <RefreshCw size={14} className="animate-spin text-blue-600 shrink-0 ml-1" />
                          )}

                          {status === 'success' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xl font-extrabold animate-in fade-in duration-200">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>บันทึกแล้ว</span>
                            </span>
                          )}

                          {status === 'error' && (
                            <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl font-extrabold">
                              บันทึกล้มเหลว
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="py-4 px-6 text-right font-mono text-[10px] text-slate-400 font-bold">
                        {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : 'ยังไม่อัปเดต'}
                      </td>

                      {/* Delete button */}
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(user)}
                          disabled={isUpdating}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          title="ลบสิทธิ์ผู้ใช้งานนี้"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* 6. Users List - Mobile Card View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => {
              const isCurrentUser = user.email === currentUserEmail;
              const isUpdating = updatingUserId === user.userId;
              const status = saveStatus[user.userId || ''];

              return (
                <div key={user.id || user.userId} className="p-4 space-y-3 bg-white">
                  {/* Top user row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User'}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center text-sm uppercase shrink-0">
                          {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </div>
                      )}
                      <div>
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{user.displayName || 'ไม่ระบุชื่อ'}</span>
                          {isCurrentUser && (
                            <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                              คุณ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono font-medium">{user.email || '-'}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteClick(user)}
                      disabled={isUpdating}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Role Segmented Buttons for Mobile */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">สิทธิ์การใช้งาน:</div>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleRoleChange(user, 'admin')}
                        className={`py-2 text-xs font-black rounded-lg transition-all text-center cursor-pointer ${
                          user.role === 'admin'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        🛡️ Admin
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleRoleChange(user, 'technician')}
                        className={`py-2 text-xs font-black rounded-lg transition-all text-center cursor-pointer ${
                          user.role === 'technician'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        🛠️ ช่าง
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleRoleChange(user, 'viewer')}
                        className={`py-2 text-xs font-black rounded-lg transition-all text-center cursor-pointer ${
                          user.role === 'viewer'
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        👁️ Viewer
                      </button>
                    </div>
                  </div>

                  {/* Status Toast Notification */}
                  {status === 'success' && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>อัปเดตสิทธิ์เรียบร้อยแล้ว</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* MODAL 1: Add User / Grant Role Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowAddUserModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">เพิ่มสิทธิ์ผู้ใช้งานล่วงหน้า</h3>
                <p className="text-xs text-slate-500 font-medium">
                  กำหนดสิทธิ์ให้อีเมลล่วงหน้า เพื่อให้มีสิทธิ์ทันทีเมื่อเข้าสู่ระบบ
                </p>
              </div>
            </div>

            {addUserError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                <span>{addUserError}</span>
              </div>
            )}

            {addUserSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{addUserSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" />
                  <span>อีเมลผู้ใช้งาน (Email Address) *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="เช่น user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800"
                />
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <UserIcon size={14} className="text-slate-400" />
                  <span>ชื่อ-นามสกุล / ชื่อเรียก (Display Name)</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น สมชาย ใจดี"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium text-slate-800"
                />
              </div>

              {/* Role Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 block">
                  ระดับสิทธิ์ที่ต้องการมอบให้ (Select Role) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRole('viewer')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      newRole === 'viewer'
                        ? 'bg-slate-800 text-white border-slate-800 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="text-xs">👁️ Viewer</div>
                    <div className={`text-[9px] font-normal mt-0.5 ${newRole === 'viewer' ? 'text-slate-300' : 'text-slate-400'}`}>ดูอย่างเดียว</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('technician')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      newRole === 'technician'
                        ? 'bg-blue-600 text-white border-blue-600 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="text-xs">🛠️ ช่างเทคนิค</div>
                    <div className={`text-[9px] font-normal mt-0.5 ${newRole === 'technician' ? 'text-blue-100' : 'text-slate-400'}`}>เช็คอิน/ปฏิบัติงาน</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      newRole === 'admin'
                        ? 'bg-rose-600 text-white border-rose-600 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="text-xs">🛡️ Admin</div>
                    <div className={`text-[9px] font-normal mt-0.5 ${newRole === 'admin' ? 'text-rose-100' : 'text-slate-400'}`}>สิทธิ์จัดการเต็ม</div>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNewUser}
                  className="px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingNewUser ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>บันทึกสิทธิ์</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Self-Demotion or Deletion Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit">
              <AlertTriangle size={24} />
            </div>

            {confirmModal.type === 'demote' ? (
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900">ยืนยันการลดสิทธิ์ตนเอง</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  คุณกำลังจะเปลี่ยนสิทธิ์ของคุณเองจาก <strong className="text-rose-600">Admin</strong> เป็น <strong className="text-blue-600">{confirmModal.pendingRole}</strong>
                  <br />
                  การดำเนินการนี้จะทำให้คุณเสียสิทธิ์ในการเข้าถึงหน้าจัดการสิทธิ์ทันที ยืนยันหรือไม่?
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900">ยืนยันการลบสิทธิ์ผู้ใช้งาน</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  คุณต้องการลบบัญชีสิทธิ์ของ <strong className="text-slate-900">{confirmModal.userRole?.displayName || confirmModal.userRole?.email}</strong> ออกจากระบบจัดการสิทธิ์หรือไม่?
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, type: 'delete' })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === 'demote' && confirmModal.userRole && confirmModal.pendingRole) {
                    executeRoleChange(confirmModal.userRole, confirmModal.pendingRole);
                  } else if (confirmModal.type === 'delete' && confirmModal.userRole) {
                    executeDeleteUserRole(confirmModal.userRole);
                  }
                  setConfirmModal({ isOpen: false, type: 'delete' });
                }}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-xs"
              >
                ยืนยันทำรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-16 text-center text-slate-400 space-y-3">
      <Users size={40} className="mx-auto text-slate-300" />
      <div className="font-bold text-slate-600 text-sm">ไม่พบข้อมูลผู้ใช้งาน</div>
      <p className="text-xs text-slate-400 max-w-xs mx-auto font-medium">
        ไม่มีรายการใดตรงกับคำค้นหาหรือตัวกรองของคุณ โปรดลองปรับปรุงคำค้นหาอีกครั้ง
      </p>
    </div>
  );
}
