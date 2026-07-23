import { useState, useEffect, useMemo } from 'react';
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { db, auth } from './firebase';
import { MaintenanceTask, MonthlyInstallation, LoginHistory, UserRole, AppUserRole, CheckInLog } from './types';

// Import components
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MaintenanceManager from './components/MaintenanceManager';
import MaintenancePlanner from './components/MaintenancePlanner';
import MonthlyInstallations from './components/MonthlyInstallations';
import LoginHistoryManager from './components/LoginHistoryManager';
import AdminPanel from './components/AdminPanel';
import GPSCheckInManager from './components/GPSCheckInManager';
import Login from './components/Login';

import { RefreshCw, Wrench, ShieldAlert } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [installations, setInstallations] = useState<MonthlyInstallation[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [triggerCreateModal, setTriggerCreateModal] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [demoUser, setDemoUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    role: AppUserRole;
  } | null>(null);
  const [userRole, setUserRole] = useState<AppUserRole>('viewer');
  const [usersRoles, setUsersRoles] = useState<UserRole[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  const activeUser = useMemo<User | null>(() => {
    if (user) return user;
    if (!demoUser) return null;
    return {
      uid: demoUser.uid,
      email: demoUser.email,
      displayName: demoUser.displayName,
      photoURL: demoUser.photoURL,
      emailVerified: true,
      isAnonymous: false,
      metadata: {},
      providerData: [],
      refreshToken: '',
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => '',
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      providerId: 'demo'
    } as unknown as User;
  }, [user, demoUser?.uid, demoUser?.email, demoUser?.displayName, demoUser?.role]);

  const handleDemoLogin = async (email: string, name: string, role: AppUserRole) => {
    const cleanEmail = email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'user';
    const uid = 'demo-' + role + '-' + cleanEmail;
    setDemoUser({
      uid,
      email,
      displayName: name,
      photoURL: '',
      role
    });
    setUserRole(role);

    try {
      await setDoc(doc(db, 'user_roles', uid), {
        userId: uid,
        email: email,
        displayName: name,
        photoURL: '',
        role: role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn("Could not sync demo user role to Firestore:", err);
    }
  };

  const handleCreateTaskClick = () => {
    setActiveTab('tasks');
    setTriggerCreateModal(true);
  };

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setDemoUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      setDemoUser(null);
      await signOut(auth);
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  // Synchronize maintenance tasks in real-time
  useEffect(() => {
    if (!activeUser) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, 'maintenance_tasks'), orderBy('scheduledDate', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: MaintenanceTask[] = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as MaintenanceTask);
      });
      setTasks(tasksData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading tasks error:", error);
      setErrorMsg("ไม่สามารถเชื่อมต่อกับ Firestore ได้ กรุณาตรวจสอบกฎความปลอดภัยและการกำหนดค่า");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUser?.uid]);

  // Synchronize monthly installations in real-time
  useEffect(() => {
    if (!activeUser) {
      setInstallations([]);
      return;
    }
    const q = query(collection(db, 'monthly_installations'), orderBy('installDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const instData: MonthlyInstallation[] = [];
      snapshot.forEach((doc) => {
        instData.push({ id: doc.id, ...doc.data() } as MonthlyInstallation);
      });
      setInstallations(instData);
    }, (error) => {
      console.error("Firestore loading installations error:", error);
    });

    return () => unsubscribe();
  }, [activeUser?.uid]);

  // Synchronize login history in real-time
  useEffect(() => {
    if (!activeUser) {
      setLoginHistory([]);
      return;
    }
    const q = query(collection(db, 'login_history'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: LoginHistory[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as LoginHistory);
      });
      setLoginHistory(logsData);
    }, (error) => {
      console.error("Firestore loading login history error:", error);
    });

    return () => unsubscribe();
  }, [activeUser?.uid]);

  // Synchronize GPS Check-In logs in real-time
  useEffect(() => {
    if (!activeUser) {
      setCheckInLogs([]);
      return;
    }
    const q = collection(db, 'check_in_logs');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData: CheckInLog[] = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() } as CheckInLog);
      });
      logsData.sort((a, b) => new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime());
      setCheckInLogs(logsData);
    }, (error) => {
      console.error("Firestore loading check in logs error:", error);
    });

    return () => unsubscribe();
  }, [activeUser?.uid]);

  // Load user role and manage onboarding
  useEffect(() => {
    if (demoUser) {
      setUserRole(demoUser.role);
      return;
    }

    if (!user) {
      setUserRole('viewer');
      return;
    }

    const docRef = doc(db, 'user_roles', user.uid);
    
    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserRole(data.role as AppUserRole);
      } else {
        // If user document does not exist, initialize it
        // The owner is thanakritphetrit@gmail.com
        const isOwner = user.email === 'thanakritphetrit@gmail.com';
        const initialRole: AppUserRole = isOwner ? 'admin' : 'viewer';
        
        try {
          await setDoc(docRef, {
            userId: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: initialRole,
            updatedAt: new Date().toISOString()
          });
          setUserRole(initialRole);
        } catch (error) {
          console.error("Error setting initial user role:", error);
          setUserRole(initialRole);
        }
      }
    }, (error) => {
      console.error("Error watching user role:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, demoUser?.uid, demoUser?.role]);

  // Load all user roles for Admin Panel
  useEffect(() => {
    if (!activeUser || userRole !== 'admin') {
      setUsersRoles([]);
      return;
    }

    const q = collection(db, 'user_roles');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roles: UserRole[] = [];
      snapshot.forEach((doc) => {
        roles.push({ id: doc.id, ...doc.data() } as UserRole);
      });
      roles.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      setUsersRoles(roles);
    }, (error) => {
      console.error("Firestore loading users roles error:", error);
    });

    return () => unsubscribe();
  }, [activeUser?.uid, userRole]);

  // Handler: Add Task
  const handleAddTask = async (taskData: Omit<MaintenanceTask, 'id' | 'createdAt'>) => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการแก้ไขหรือบันทึกข้อมูลได้');
      return;
    }
    try {
      await addDoc(collection(db, 'maintenance_tasks'), {
        ...taskData,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error adding document: ", e);
      throw e;
    }
  };

  // Handler: Update Task
  const handleUpdateTask = async (id: string, updates: Partial<MaintenanceTask>) => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการแก้ไขหรือบันทึกข้อมูลได้');
      return;
    }
    try {
      const taskRef = doc(db, 'maintenance_tasks', id);
      await updateDoc(taskRef, updates);
    } catch (e) {
      console.error("Error updating document: ", e);
      throw e;
    }
  };

  // Handler: Delete Task
  const handleDeleteTask = async (id: string) => {
    if (userRole !== 'admin') {
      alert('🔒 ขออภัย สิทธิ์ในการลบข้อมูลจำกัดเฉพาะผู้ดูแลระบบ (Admin) เท่านั้น');
      return;
    }
    try {
      const taskRef = doc(db, 'maintenance_tasks', id);
      await deleteDoc(taskRef);
    } catch (e) {
      console.error("Error deleting document: ", e);
      throw e;
    }
  };

  // Handler: Add Installation
  const handleAddInstallation = async (instData: Omit<MonthlyInstallation, 'id' | 'createdAt'>) => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการแก้ไขหรือบันทึกข้อมูลได้');
      return;
    }
    try {
      await addDoc(collection(db, 'monthly_installations'), {
        ...instData,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error adding installation: ", e);
      throw e;
    }
  };

  // Handler: Update Installation
  const handleUpdateInstallation = async (id: string, updates: Partial<MonthlyInstallation>) => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการแก้ไขหรือบันทึกข้อมูลได้');
      return;
    }
    try {
      const instRef = doc(db, 'monthly_installations', id);
      await updateDoc(instRef, updates);
    } catch (e) {
      console.error("Error updating installation: ", e);
      throw e;
    }
  };

  // Handler: Delete Installation
  const handleDeleteInstallation = async (id: string) => {
    if (userRole !== 'admin') {
      alert('🔒 ขออภัย สิทธิ์ในการลบข้อมูลจำกัดเฉพาะผู้ดูแลระบบ (Admin) เท่านั้น');
      return;
    }
    try {
      const instRef = doc(db, 'monthly_installations', id);
      await deleteDoc(instRef);
    } catch (e) {
      console.error("Error deleting installation: ", e);
      throw e;
    }
  };

  // Handler: GPS Check-In
  const handleCheckIn = async (logData: Omit<CheckInLog, 'id' | 'createdAt'>): Promise<string> => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการบันทึกข้อมูลได้');
      return '';
    }
    try {
      const docRef = await addDoc(collection(db, 'check_in_logs'), {
        ...logData,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (e) {
      console.error("Error creating check-in log: ", e);
      throw e;
    }
  };

  // Handler: GPS Check-Out
  const handleCheckOut = async (logId: string, updates: Partial<CheckInLog>): Promise<void> => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถดำเนินการบันทึกข้อมูลได้');
      return;
    }
    try {
      const logRef = doc(db, 'check_in_logs', logId);
      await updateDoc(logRef, updates);
    } catch (e) {
      console.error("Error updating check-out log: ", e);
      throw e;
    }
  };

  // Handler: Update GPS Check-In/Out Log
  const handleUpdateCheckInLog = async (logId: string, updates: Partial<CheckInLog>): Promise<void> => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถแก้ไขข้อมูลได้');
      return;
    }
    try {
      const logRef = doc(db, 'check_in_logs', logId);
      await updateDoc(logRef, updates);
    } catch (e) {
      console.error("Error updating check-in log: ", e);
      throw e;
    }
  };

  // Handler: Delete GPS Check-In/Out Log
  const handleDeleteCheckInLog = async (logId: string): Promise<void> => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถลบข้อมูลได้');
      return;
    }
    try {
      const logRef = doc(db, 'check_in_logs', logId);
      await deleteDoc(logRef);
    } catch (e) {
      console.error("Error deleting check-in log: ", e);
      throw e;
    }
  };

  // Generate complete educational dummy data
  const handleGenerateDummyData = async () => {
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น ไม่สามารถสร้างข้อมูลจำลองได้');
      return;
    }
    setLoading(true);
    try {
      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');

      // Helper to generate ISO string dates dynamically
      const formatDate = (day: number) => `${yr}-${mo}-${String(day).padStart(2, '0')}`;

      // 1. Create Mock Installations
      const mockInsts: Omit<MonthlyInstallation, 'id' | 'createdAt'>[] = [
        {
          equipmentName: 'เครื่องทวนสัญญาณอินเทอร์เน็ต (Fiber Router)',
          serialNumber: 'RT-54890-X',
          model: 'UltraRouter V2',
          location: 'ห้องเครือข่ายเซิร์ฟเวอร์ ชั้น 4',
          installDate: formatDate(2),
          technician: 'นายอัครเดช รุ่งเรือง',
          warrantyPeriodMonths: 24,
          status: 'Operational',
          notes: 'ติดตั้งและทดสอบไฟสัญญาณเรียบร้อย แบนด์วิธใช้งานเต็มประสิทธิภาพ'
        },
        {
          equipmentName: 'เครื่องจักรตัดเหล็กความเร็วสูง (CNC Laser Cutter)',
          serialNumber: 'CNC-2026-991',
          model: 'LaserPro 500W',
          location: 'โรงซ่อมบำรุง อาคาร C แผนกประกอบ',
          installDate: formatDate(10),
          technician: 'บริษัท ซีเอ็นซี เทค จำกัด',
          warrantyPeriodMonths: 12,
          status: 'Pending Testing',
          notes: 'เครื่องติดตั้งแล้วเสร็จ อยู่ระหว่างรอช่างวิศวกรโรงงานมาสอบเทียบในขั้นตอนสุดท้าย'
        },
        {
          equipmentName: 'เครื่องปรับอากาศฝังฝ้า (Cassette Air Conditioner)',
          serialNumber: 'AC-CAS-78210',
          model: 'CoolAir-Inverter 36000BTU',
          location: 'ห้องประชุมใหญ่อเนกประสงค์ ชั้น 2',
          installDate: formatDate(15),
          technician: 'ช่างวีระศักดิ์ และคณะ',
          warrantyPeriodMonths: 18,
          status: 'Operational',
          notes: 'เดินระบบท่อน้ำยาและสายไฟเรียบร้อย เดินเครื่องเงียบ ทำความเย็นได้ดีมาก'
        }
      ];

      // 2. Create Mock Maintenance Tasks
      const mockTasks: Omit<MaintenanceTask, 'id' | 'createdAt'>[] = [
        {
          title: 'ล้างทำความสะอาดแอร์ฟิลเตอร์รายสัปดาห์',
          description: 'ถอดแผ่นกรองฝุ่นมาล้าง ขจัดฝุ่นละอองสะสม เพื่อประสิทธิภาพการไหลเวียนอากาศและประหยัดพลังงาน',
          type: 'Preventive',
          status: 'Completed',
          priority: 'Low',
          equipment: 'แอร์ฝังฝ้าประชุมใหญ่ ชั้น 2',
          assignedTo: 'นายอัครเดช รุ่งเรือง',
          scheduledDate: formatDate(5),
          completedDate: formatDate(5),
          notes: 'ล้างฝุ่นสะสมเรียบร้อย ทำความสะอาดกรอบหน้ากากภายนอกด้วย',
          departmentOrCompany: 'แผนกธุรการและอาคารสถานที่'
        },
        {
          title: 'ตรวจสอบระบบสำรองไฟฟ้าฉุกเฉิน (UPS Battery Test)',
          description: 'ทดสอบการสลับไฟเมื่อไฟดับ และวัดแรงดันแบตเตอรี่ตู้สำรองไฟฟ้าหลัก',
          type: 'Preventive',
          status: 'In Progress',
          priority: 'High',
          equipment: 'ตู้ UPS Server Room B',
          assignedTo: 'วิศวกรสมเกียรติ',
          scheduledDate: formatDate(14),
          completedDate: '',
          notes: 'ตรวจพบเซลล์แบตเตอรี่เริ่มเสื่อมสภาพ 1 ก้อน กำลังทำเรื่องจัดซื้อมาทดแทน',
          departmentOrCompany: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT)'
        },
        {
          title: 'เปลี่ยนน้ำมันหล่อลื่นและสายพานสายพานขับเคลื่อนหลัก',
          description: 'งานบำรุงรักษาเชิงป้องกันตามรอบเวลา 6 เดือน เพื่อถนอมเครื่องจักรตัดเหล็ก CNC ไม่ให้สึกหรอ',
          type: 'Preventive',
          status: 'Pending',
          priority: 'Medium',
          equipment: 'เครื่องตัดเหล็ก CNC Laser C',
          assignedTo: 'ช่างชาติพัฒนา',
          scheduledDate: formatDate(18),
          completedDate: '',
          notes: '',
          departmentOrCompany: 'ฝ่ายผลิต อาคาร C'
        },
        {
          title: 'ซ่อมแซมแก้ไขปั๊มน้ำหล่อเย็นขัดข้องมีเสียงดัง',
          description: 'พนักงานแจ้งว่าได้ยินเสียงดังผิดปกติคล้ายเหล็กเสียดสีระหว่างเดินเครื่องปั๊มน้ำระบบหล่อเย็น',
          type: 'Corrective',
          status: 'Pending',
          priority: 'Critical',
          equipment: 'ปั๊มน้ำหล่อเย็นระบบระบายความร้อนเบอร์ 3',
          assignedTo: 'ทีมงานซ่อมแซมเร่งด่วน',
          scheduledDate: formatDate(20),
          completedDate: '',
          notes: 'ตรวจสอบเบื้องต้นคาดว่าตลับลูกปืนแบริ่งภายในชำรุดเสียหาย ต้องถอดชิ้นส่วนมาซ่อม',
          departmentOrCompany: 'ฝ่ายวิศวกรรมสาธารณูปโภค (Utility)'
        },
        {
          title: 'สอบเทียบมาตรวัดความร้อนเครื่องอบอุตสาหกรรม',
          description: 'นำชุดเซนเซอร์มาตรฐานมาวัดทวนเทียบความถูกต้องของหน้าจอแสดงผลอุณหภูมิโรงงานประจำปี',
          type: 'Calibration',
          status: 'Pending',
          priority: 'Medium',
          equipment: 'ตู้เตาอบความร้อน Oven-01',
          assignedTo: 'สถาบันสอบเทียบมาตรฐานไทย',
          scheduledDate: formatDate(25),
          completedDate: '',
          notes: '',
          departmentOrCompany: 'ฝ่ายควบคุมคุณภาพ (QA/QC)'
        }
      ];

      // Add all to Firestore
      for (const inst of mockInsts) {
        await addDoc(collection(db, 'monthly_installations'), {
          ...inst,
          createdAt: new Date().toISOString()
        });
      }

      for (const t of mockTasks) {
        await addDoc(collection(db, 'maintenance_tasks'), {
          ...t,
          createdAt: new Date().toISOString()
        });
      }

    } catch (e) {
      console.error("Error creating mock data: ", e);
      alert("ไม่สามารถสร้างข้อมูลจำลองได้ โปรดเปิดใช้งานฐานข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4 font-sans">
        <RefreshCw className="animate-spin text-blue-600" size={36} />
        <p className="text-sm font-semibold text-slate-500">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
      </div>
    );
  }

  if (!activeUser) {
    return <Login onDemoLogin={handleDemoLogin} />;
  }

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* Top navigation */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onCreateTaskClick={userRole !== 'viewer' ? handleCreateTaskClick : undefined} 
        user={activeUser}
        userRole={userRole}
        onLogout={handleLogout}
      />

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8 overflow-x-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="animate-spin text-blue-600" size={36} />
            <p className="text-sm font-semibold text-slate-500">กำลังเชื่อมต่อฐานข้อมูลระบบซ่อมบำรุง...</p>
          </div>
        ) : errorMsg ? (
          <div className="max-w-md mx-auto bg-white p-6 rounded-2xl border border-rose-100 shadow-sm text-center space-y-4 my-12">
            <ShieldAlert size={44} className="text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">การเชื่อมต่อผิดพลาด</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-slate-100 text-slate-600 font-semibold text-xs px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              รีเฟรชหน้าเว็บอีกครั้ง
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard tasks={tasks} installations={installations} />
            )}

            {activeTab === 'tasks' && (
              <MaintenanceManager 
                tasks={tasks}
                userRole={userRole}
                currentUserEmail={activeUser?.email || ''}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onGenerateDummyData={handleGenerateDummyData}
                triggerCreateModal={triggerCreateModal}
                setTriggerCreateModal={setTriggerCreateModal}
              />
            )}

            {activeTab === 'checkin' && (
              <GPSCheckInManager
                tasks={tasks}
                checkInLogs={checkInLogs}
                user={activeUser}
                userRole={userRole}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                onUpdateCheckInLog={handleUpdateCheckInLog}
                onDeleteCheckInLog={handleDeleteCheckInLog}
                onUpdateTaskStatus={handleUpdateTask}
              />
            )}

            {activeTab === 'planner' && (
              <MaintenancePlanner 
                tasks={tasks}
                userRole={userRole}
                onAddTask={handleAddTask}
              />
            )}

            {activeTab === 'installations' && (
              <MonthlyInstallations 
                installations={installations}
                userRole={userRole}
                currentUserEmail={activeUser?.email || ''}
                onAddInstallation={handleAddInstallation}
                onUpdateInstallation={handleUpdateInstallation}
                onDeleteInstallation={handleDeleteInstallation}
              />
            )}

            {activeTab === 'login_history' && userRole === 'admin' && (
              <LoginHistoryManager loginHistory={loginHistory} />
            )}

            {activeTab === 'admin_panel' && userRole === 'admin' && (
              <AdminPanel usersRoles={usersRoles} currentUserEmail={activeUser?.email || ''} />
            )}
          </>
        )}
      </main>

      {/* Professional footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mb-16 lg:mb-0 text-center text-xs text-slate-500 font-medium no-print">
        <p>ระบบวางแผนบำรุงรักษาและซ่อมบำรุงเชิงรุก (Preventive Maintenance System) เชื่อมต่อระบบฐานข้อมูลคลาวด์เสถียรภาพสูง</p>
        <p className="mt-1 text-slate-700 font-semibold">ออกแบบโปรแกรมด้วย นายธนกฤต เพชรฤทธิ์</p>
        <p className="mt-0.5 text-[10px] text-slate-400">© {new Date().getFullYear()} Preventive Maintenance System. All rights reserved.</p>
      </footer>
    </div>
  );
}
