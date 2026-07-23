import { useState, FormEvent } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Wrench, ShieldAlert, Calendar, TrendingUp, Copy, Check, Mail, Lock, User as UserIcon, UserPlus, LogIn } from 'lucide-react';
import { AppUserRole } from '../types';

interface LoginProps {
  onDemoLogin?: (email: string, name: string, role: AppUserRole) => void;
}

export default function Login({ onDemoLogin }: LoginProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [isOperationNotAllowed, setIsOperationNotAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyDomain = () => {
    if (navigator.clipboard && currentDomain) {
      navigator.clipboard.writeText(currentDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
      return;
    }
    if (isRegisterMode && !displayName) {
      setError('กรุณากรอกชื่อ-นามสกุลผู้ใช้งาน');
      return;
    }

    setLoading(true);
    setError(null);
    setIsUnauthorizedDomain(false);
    setIsOperationNotAllowed(false);

    try {
      if (isRegisterMode) {
        // Register new user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: displayName
          });

          // Set default user role as viewer (unless owner)
          const isOwner = userCredential.user.email === 'thanakritphetrit@gmail.com';
          const initialRole: AppUserRole = isOwner ? 'admin' : 'viewer';
          try {
            await setDoc(doc(db, 'user_roles', userCredential.user.uid), {
              userId: userCredential.user.uid,
              email: userCredential.user.email || '',
              displayName: displayName || '',
              photoURL: '',
              role: initialRole,
              updatedAt: new Date().toISOString()
            });
          } catch (roleErr) {
            console.error("Error setting initial role on register:", roleErr);
          }

          try {
            await addDoc(collection(db, 'login_history'), {
              userId: userCredential.user.uid,
              email: userCredential.user.email || '',
              displayName: displayName || '',
              photoURL: '',
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent,
              authMethod: 'email_register'
            });
          } catch (dbErr) {
            console.error("Error storing login history:", dbErr);
          }
        }
      } else {
        // Sign in existing user
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
          try {
            await addDoc(collection(db, 'login_history'), {
              userId: userCredential.user.uid,
              email: userCredential.user.email || '',
              displayName: userCredential.user.displayName || displayName || userCredential.user.email || '',
              photoURL: userCredential.user.photoURL || '',
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent,
              authMethod: 'email_login'
            });
          } catch (dbErr) {
            console.error("Error storing login history:", dbErr);
          }
        }
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง หรือสลับไปสมัครสมาชิก');
      } else if (code === 'auth/email-already-in-use') {
        setError('อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลนี้หรือใช้รหัสผ่านที่เคยตั้งไว้');
      } else if (code === 'auth/weak-password') {
        setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      } else if (code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        // Fallback login if onDemoLogin is provided
        try {
          await addDoc(collection(db, 'login_history'), {
            userId: 'app-user-' + Date.now(),
            email: email,
            displayName: displayName || email.split('@')[0] || 'ผู้ใช้ระบบ',
            photoURL: '',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            authMethod: 'email_password_direct'
          });
        } catch (dbErr) {
          console.warn("Could not record login history:", dbErr);
        }

        if (onDemoLogin) {
          const nameToUse = displayName || email.split('@')[0] || 'ผู้ใช้งาน';
          const isOwner = email.toLowerCase() === 'thanakritphetrit@gmail.com';
          const roleToUse: AppUserRole = isOwner ? 'admin' : (isRegisterMode ? 'viewer' : (email.toLowerCase().includes('tech') ? 'technician' : 'viewer'));
          onDemoLogin(email, nameToUse, roleToUse);
          return;
        }
        setError('วิธีเข้าสู่ระบบด้วย Email/Password ยังไม่ได้เปิดใช้งานใน Firebase Console');
      } else if (code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setIsUnauthorizedDomain(true);
        setError(`Firebase: Error (auth/unauthorized-domain) - โดเมน ${currentDomain} ยังไม่ได้ลงทะเบียนใน Firebase Console`);
      } else {
        console.error("Unhandled Email Auth Error:", err);
        setError(`เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถทำรายการได้"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setIsUnauthorizedDomain(false);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        try {
          await addDoc(collection(db, 'login_history'), {
            userId: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            authMethod: 'google'
          });
        } catch (dbErr) {
          console.warn("Could not record login history:", dbErr);
        }
      }
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        setIsUnauthorizedDomain(true);
        setError(`Firebase: Error (auth/unauthorized-domain) - โดเมน ${currentDomain} ยังไม่ได้ลงทะเบียนใน Firebase Console`);
      } else if (code === 'auth/operation-not-allowed') {
        setIsOperationNotAllowed(true);
        if (onDemoLogin) {
          onDemoLogin('google.user@example.com', 'ผู้ใช้งาน (Google)', 'admin');
          return;
        }
        setError('วิธีเข้าสู่ระบบด้วย Google ยังไม่ได้เปิดใช้งานใน Firebase Console');
      } else if (code === 'auth/popup-blocked') {
        setError("เบราว์เซอร์ของคุณบล็อกป๊อปอัป กรุณาเปิดใช้งานป๊อปอัปสำหรับเว็บไซต์นี้เพื่อเข้าสู่ระบบ");
      } else if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        setError("การเชื่อมต่อถูกยกเลิก โปรดลองใหม่อีกครั้ง");
      } else {
        console.error("Unhandled Google Sign-In Error:", err);
        setError(`เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถเชื่อมต่อได้"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
        {/* Left Side: Brand & Visual Info */}
        <div className="md:col-span-6 bg-slate-950 p-8 sm:p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

          <div className="relative z-10 space-y-7">
            {/* Header / Logo */}
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Wrench size={22} className="animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-lg sm:text-xl block">Preventive Maintenance System</span>
                <span className="text-xs text-slate-400 block font-semibold">ระบบวางแผนบำรุงรักษาเชิงรุกและซ่อมบำรุงอัจฉริยะ (PM System)</span>
              </div>
            </div>

            {/* Value Props */}
            <div className="space-y-5 pt-4">
              <div className="flex gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                  <TrendingUp size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">แดชบอร์ดสรุปผลแบบเรียลไทม์</h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    วิเคราะห์ข้อมูลสถิติ ดัชนีประสิทธิภาพการบำรุงรักษา และตรวจสอบสถานะระบบได้อย่างแม่นยำ
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wrench size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">ระบบเช็คอินหน้างานผ่านแผนที่ GPS (Google Maps)</h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    ช่างเทคนิคสามารถนำทาง และเช็คอิน/เช็คเอาท์หน้างานด้วย Geofencing ควบคุมความปลอดภัย
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                  <Calendar size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">ปฏิทินวางแผนงานเชิงป้องกัน</h4>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    จัดการปฏิทินบำรุงรักษาล่วงหน้า มอบหมายงานให้ช่างอย่างเป็นระบบ ไม่พลาดทุกตารางเวลา
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-8 border-t border-slate-900/60 text-left">
            <p className="text-[10px] text-slate-500 font-medium">© ระบบบริหารจัดการงานซ่อมบำรุงและติดตั้งเครื่องจักร</p>
          </div>
        </div>

        {/* Right Side: Authentication */}
        <div className="md:col-span-6 p-6 sm:p-8 flex flex-col justify-center text-left">
          <div className="space-y-4 max-w-sm mx-auto w-full">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-950">
                  {isRegisterMode ? 'สร้างบัญชีผู้ใช้ใหม่' : 'ยินดีต้อนรับเข้าสู่ระบบ'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(!isRegisterMode);
                    setError(null);
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  {isRegisterMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}
                </button>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                {isRegisterMode 
                  ? 'กรอกข้อมูลเพื่อสร้างบัญชีสำหรับเข้าใช้งานระบบ PM' 
                  : 'กรุณากรอกอีเมลและรหัสผ่าน หรือเข้าสู่ระบบด้วย Google'}
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200/80 p-3 rounded-2xl space-y-1.5 text-rose-900 text-xs leading-relaxed animate-shake">
                <div className="flex items-start gap-2 font-bold text-rose-800">
                  <ShieldAlert size={15} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>เกิดข้อผิดพลาดในการเข้าสู่ระบบ</span>
                </div>
                <p className="text-[11px] text-rose-700 font-medium">{error}</p>

                {isOperationNotAllowed && (
                  <div className="pt-2 border-t border-rose-200/60 space-y-2">
                    <p className="text-[10.5px] text-slate-700 leading-normal">
                      <strong>วิธีเปิดใช้งานใน Firebase Console:</strong>
                    </p>
                    <ol className="list-decimal list-inside text-[10px] text-slate-600 space-y-1 bg-white p-2 rounded-xl border border-rose-200 font-medium">
                      <li>เปิด <strong>Firebase Console &gt; Authentication</strong></li>
                      <li>เลือกแท็บ <strong>Sign-in method</strong></li>
                      <li>คลิก <strong>Email/Password</strong> &gt; เปิดใช้งาน <strong>Enable</strong> &gt; กด <strong>Save</strong></li>
                    </ol>
                    {onDemoLogin && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => onDemoLogin(email || 'user@pm-system.com', displayName || email.split('@')[0] || 'ผู้ใช้งานระบบ', 'admin')}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <span>⚡ เข้าสู่ระบบทันทีด้วย {email || 'อีเมลนี้'} (ผ่านด่วน)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isUnauthorizedDomain && (
                  <div className="pt-2 border-t border-rose-200/60 space-y-2">
                    <p className="text-[10.5px] text-slate-700 leading-normal">
                      <strong>วิธีแก้ไข:</strong> คัดลอกโดเมนด้านล่างไปเพิ่มใน Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains
                    </p>
                    <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-rose-200">
                      <code className="text-[10px] text-slate-800 font-mono flex-1 truncate px-1">{currentDomain}</code>
                      <button
                        onClick={handleCopyDomain}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      >
                        {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isRegisterMode && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">ชื่อ-นามสกุล / ชื่อผู้ใช้งาน</label>
                  <div className="relative">
                    <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="เช่น นายธนกฤต เพชรฤทธิ์"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">อีเมล (Email)</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">รหัสผ่าน (Password)</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200/90 rounded-xl pl-9 pr-3 py-2.5 font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-md active:scale-95 disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : isRegisterMode ? (
                  <>
                    <UserPlus size={15} />
                    <span>ยืนยันการสมัครสมาชิก</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>เข้าสู่ระบบด้วย อีเมล / รหัสผ่าน</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-2 flex items-center justify-center">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">หรือ</span>
            </div>

            {/* Google Login button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all hover:shadow-xs active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>เข้าสู่ระบบด้วย Google</span>
              </button>

              <div className="text-center pt-3">
                <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wide uppercase">
                  Powered by Firebase Authentication & Firestore
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


