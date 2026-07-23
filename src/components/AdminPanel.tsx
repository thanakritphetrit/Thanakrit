import { useState } from 'react';
import { UserRole, AppUserRole } from '../types';
import { Shield, ShieldAlert, ShieldCheck, Users, Search, RefreshCw, Info, Check, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface AdminPanelProps {
  usersRoles: UserRole[];
  currentUserEmail: string;
}

export default function AdminPanel({ usersRoles, currentUserEmail }: AdminPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: 'success' | 'error' | null }>({});

  const handleRoleChange = async (userRole: UserRole, newRole: AppUserRole) => {
    const docId = userRole.id || userRole.userId;
    if (!docId) return;

    // Check to prevent self-demotion
    if (userRole.email === currentUserEmail && newRole !== 'admin') {
      const confirmDemote = window.confirm(
        '⚠️ คุณกำลังเปลี่ยนสิทธิ์ของตนเองจาก Admin เป็นระดับอื่น ซึ่งจะทำให้คุณเสียสิทธิ์ในการจัดการผู้ใช้อื่นและดูบันทึกประวัติการเข้าสู่ระบบ ยืนยันการเปลี่ยนแปลงนี้หรือไม่?'
      );
      if (!confirmDemote) return;
    }

    setUpdatingUserId(userRole.userId);
    setSaveStatus(prev => ({ ...prev, [userRole.userId]: null }));

    try {
      const docRef = doc(db, 'user_roles', docId);
      await setDoc(docRef, {
        userId: userRole.userId,
        email: userRole.email,
        displayName: userRole.displayName || '',
        photoURL: userRole.photoURL || '',
        role: newRole,
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

  const handleDeleteUserRole = async (userRole: UserRole) => {
    const docId = userRole.id || userRole.userId;
    if (!docId) return;

    if (userRole.email === currentUserEmail && usersRoles.filter(u => u.email === currentUserEmail).length === 1) {
      const confirmSelf = window.confirm('⚠️ คุณกำลังจะลบบัญชีสิทธิ์การใช้งานอันเดียวของคุณ ยืนยันการลบหรือไม่?');
      if (!confirmSelf) return;
    } else {
      const confirmDelete = window.confirm(
        `คุณต้องการลบบัญชีสิทธิ์ผู้ใช้ ${userRole.displayName || userRole.email} (UID: ${userRole.userId}) ออกจากระบบใช่หรือไม่?`
      );
      if (!confirmDelete) return;
    }

    setUpdatingUserId(userRole.userId);

    try {
      await deleteDoc(doc(db, 'user_roles', docId));
    } catch (error) {
      console.error('Error deleting user role:', error);
      alert('เกิดข้อผิดพลาดในการลบรายการผู้ใช้งาน');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Track email counts for detecting duplicate login accounts
  const emailCounts = usersRoles.reduce((acc, u) => {
    if (u.email) {
      const e = u.email.toLowerCase();
      acc[e] = (acc[e] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Filter users based on search
  const filteredUsers = usersRoles.filter((user) => {
    const term = searchTerm.toLowerCase();
    const name = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const role = (user.role || '').toLowerCase();
    const uid = (user.userId || '').toLowerCase();

    return name.includes(term) || email.includes(term) || role.includes(term) || uid.includes(term);
  });

  // Calculate statistics
  const totalUsers = usersRoles.length;
  const adminCount = usersRoles.filter(u => u.role === 'admin').length;
  const techCount = usersRoles.filter(u => u.role === 'technician').length;
  const viewerCount = usersRoles.filter(u => u.role === 'viewer').length;

  return (
    <div className="space-y-6 text-left font-sans">
      {/* Header and Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Shield className="text-rose-600" size={24} />
            <span>ระบบจัดการสิทธิ์ผู้ใช้งาน (Access Control Center)</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            กำหนดระดับสิทธิ์ให้พนักงานซ่อมบำรุงในทีม เพื่อควบคุมการมองเห็นและการเพิ่ม ลบ แก้ไขข้อมูลในฐานข้อมูล
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-rose-800 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg font-bold w-fit">
          <ShieldAlert size={14} className="stroke-[3]" />
          <span>ศูนย์ควบคุมสิทธิ์ (Security Policy active)</span>
        </div>
      </div>

      {/* Role Descriptions Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Admin Card Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <div className="p-2 bg-rose-50 rounded-xl">
              <Shield size={18} />
            </div>
            <span className="text-xs font-black">ผู้ดูแลระบบ (Admin)</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            มีสิทธิ์การใช้งานสูงสุดแบบเบ็ดเสร็จ (Full Control) สามารถ เพิ่ม แก้ไข และลบงานทั้งหมดได้ รวมทั้งเข้าถึงประวัติความปลอดภัยและการจัดการสิทธิ์พนักงานได้เท่านั้น
          </p>
        </div>

        {/* Technician Card Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <div className="p-2 bg-blue-50 rounded-xl">
              <RefreshCw size={18} />
            </div>
            <span className="text-xs font-black">ช่างเทคนิค (Technician)</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            มีสิทธิ์การปฏิบัติงาน (Operator) สามารถเปิดใบงานใหม่ แก้ไขข้อมูลใบงาน ดำเนินการเช็คอิน/เช็คเอาท์หน้างานด้วย GPS ได้ แต่<strong>ไม่ได้รับอนุญาตให้ลบข้อมูลงานซ่อมบำรุง</strong>
          </p>
        </div>

        {/* Viewer Card Info */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-600">
            <div className="p-2 bg-slate-50 rounded-xl">
              <Info size={18} />
            </div>
            <span className="text-xs font-black">ผู้เข้าดูข้อมูล (Viewer)</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            มีสิทธิ์การอ่านข้อมูลอย่างเดียว (Read-Only) สามารถดูแดชบอร์ด รายการงาน ปฏิทินปฏิบัติงาน และรายการติดตั้งอุปกรณ์ได้ แต่<strong>ไม่สามารถเพิ่ม ลบ หรือแก้ไขข้อมูลใดๆ ได้เลย</strong>
          </p>
        </div>
      </div>

      {/* Stats Counters Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Registered Users */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center gap-3">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl shrink-0">
            <Users size={18} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">พนักงานทั้งหมด</span>
            <span className="text-lg font-black text-slate-800 block">{totalUsers} บัญชี</span>
          </div>
        </div>

        {/* Admins */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ผู้ดูแล (Admin)</span>
            <span className="text-lg font-black text-rose-600 block">{adminCount} บัญชี</span>
          </div>
        </div>

        {/* Technicians */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <RefreshCw size={18} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ช่างเทคนิค</span>
            <span className="text-lg font-black text-blue-600 block">{techCount} บัญชี</span>
          </div>
        </div>

        {/* Viewers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs text-center sm:text-left flex flex-col sm:flex-row items-center gap-3">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl shrink-0">
            <Info size={18} />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ผู้เข้าชม (Viewer)</span>
            <span className="text-lg font-black text-slate-600 block">{viewerCount} บัญชี</span>
          </div>
        </div>
      </div>

      {/* Main Table and Filter section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
        {/* Search header */}
        <div className="p-5 border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="ค้นหาพนักงานด้วยชื่อ, อีเมล หรือสิทธิ์..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Users list */}
        <div className="overflow-x-auto">
          {filteredUsers.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/60 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-6">ผู้ใช้งาน (User Profile)</th>
                  <th className="py-3 px-6">อีเมล (Email Address)</th>
                  <th className="py-3 px-6">สิทธิ์ปัจจุบัน (Current Role)</th>
                  <th className="py-3 px-6">กำหนดสิทธิ์ใหม่ (Manage Permissions)</th>
                  <th className="py-3 px-6 text-right">อัปเดตล่าสุด</th>
                  <th className="py-3 px-6 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.email === currentUserEmail;
                  const isUpdating = updatingUserId === user.userId;
                  const status = saveStatus[user.userId || ''];
                  const isDuplicateEmail = user.email && emailCounts[user.email.toLowerCase()] > 1;

                  return (
                    <tr key={user.id || user.userId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Profile Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'User'}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {user.displayName?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{user.displayName || 'ไม่ระบุชื่อ'}</span>
                              {isCurrentUser && (
                                <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[8px] font-bold px-1.5 py-0.5 rounded-sm">
                                  คุณ (You)
                                </span>
                              )}
                              {isDuplicateEmail && (
                                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-bold px-1.5 py-0.5 rounded-sm" title="มีรายการอีเมลซ้ำจากหลาย UID / การลงชื่อเข้าใช้ซ้ำ">
                                  ⚠️ บัญชีซ้ำ
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono block">UID: {user.userId}</span>
                          </div>
                        </div>
                      </td>

                      {/* Email Column */}
                      <td className="py-4 px-6 font-mono text-slate-600">
                        {user.email}
                      </td>

                      {/* Current Role Column */}
                      <td className="py-4 px-6">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200/50 text-[10px] font-bold uppercase">
                            <Shield size={10} />
                            <span>Admin</span>
                          </span>
                        ) : user.role === 'technician' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/50 text-[10px] font-bold uppercase">
                            <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '6s' }} />
                            <span>Technician</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200/50 text-[10px] font-bold uppercase">
                            <Info size={10} />
                            <span>Viewer</span>
                          </span>
                        )}
                      </td>

                      {/* Manage Permissions Selector */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <select
                            disabled={isUpdating}
                            value={user.role}
                            onChange={(e) => handleRoleChange(user, e.target.value as AppUserRole)}
                            className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-bold text-slate-700 py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          >
                            <option value="admin">ผู้ดูแล (Admin)</option>
                            <option value="technician">ช่างเทคนิค (Technician)</option>
                            <option value="viewer">ผู้เข้าชม (Viewer)</option>
                          </select>

                          {isUpdating && (
                            <RefreshCw className="animate-spin text-blue-600 shrink-0" size={14} />
                          )}

                          {status === 'success' && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md font-bold">
                              <Check size={11} className="stroke-[3]" />
                              <span>บันทึกแล้ว</span>
                            </span>
                          )}

                          {status === 'error' && (
                            <span className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 px-2 py-1 rounded-md font-bold">
                              ล้มเหลว
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Updated Column */}
                      <td className="py-4 px-6 text-right font-mono text-[10px] text-slate-400">
                        {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : 'ยังไม่มีการอัปเดต'}
                      </td>

                      {/* Action Delete Column */}
                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteUserRole(user)}
                          disabled={isUpdating}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          title="ลบสิทธิ์ผู้ใช้นี้ออกจากระบบ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Users size={40} className="mx-auto text-slate-300" />
              <div className="font-bold text-slate-500 text-sm">ไม่พบข้อมูลผู้ใช้งาน</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                ไม่มีผู้ใช้งานใดตรงกับคำค้นหาของคุณ โปรดลองปรับปรุงคำค้นหาอีกครั้ง
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
