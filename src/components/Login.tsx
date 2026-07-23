import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Wrench, ShieldAlert, Cpu, Calendar, TrendingUp } from 'lucide-react';

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        // Record login history to Firestore
        try {
          await addDoc(collection(db, 'login_history'), {
            userId: result.user.uid,
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            photoURL: result.user.photoURL || '',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          });
        } catch (dbErr) {
          console.error("Error storing login history:", dbErr);
        }
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("เบราว์เซอร์ของคุณบล็อกป๊อปอัป กรุณาเปิดใช้งานป๊อปอัปสำหรับเว็บไซต์นี้เพื่อเข้าสู่ระบบ");
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError("การเชื่อมต่อถูกยกเลิก โปรดลองใหม่อีกครั้ง");
      } else {
        setError(`เกิดข้อผิดพลาด: ${err.message || "ไม่สามารถเชื่อมต่อได้"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border border-slate-200/60 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        {/* Left Side: Brand & Visual Info */}
        <div className="md:col-span-7 bg-slate-950 p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

          <div className="relative z-10 space-y-8">
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
            <div className="space-y-6 pt-6">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">แดชบอร์ดสรุปผลแบบเรียลไทม์</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    วิเคราะห์ข้อมูลสถิติ ดัชนีประสิทธิภาพการบำรุงรักษา และตรวจสอบสถานะระบบได้อย่างแม่นยำ
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wrench size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">ระบบเช็คอินหน้างานผ่านแผนที่ GPS (Google Maps)</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    ช่างเทคนิคสามารถนำทาง และเช็คอิน/เช็คเอาท์หน้างานด้วย Geofencing ควบคุมความปลอดภัย
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 shrink-0">
                  <Calendar size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">ปฏิทินวางแผนงานเชิงป้องกัน</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    จัดการปฏิทินบำรุงรักษาล่วงหน้า มอบหมายงานให้ช่างอย่างเป็นระบบ ไม่พลาดทุกตารางเวลา
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-12 border-t border-slate-900/60 text-left">
            <p className="text-[10px] text-slate-500 font-medium">© ระบบบริหารจัดการงานซ่อมบำรุงและติดตั้งเครื่องจักร</p>
          </div>
        </div>

        {/* Right Side: Authentication */}
        <div className="md:col-span-5 p-8 sm:p-12 flex flex-col justify-center text-left">
          <div className="space-y-6 max-w-sm mx-auto w-full">
            <div>
              <h3 className="text-xl font-black text-slate-950">ยินดีต้อนรับเข้าสู่ระบบ</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1.5 leading-relaxed">
                กรุณาเข้าสู่ระบบด้วยบัญชี Google เพื่อใช้งานระบบบริหารจัดการซ่อมบำรุงและติดตามใบงาน
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex gap-2 text-rose-800 text-xs leading-relaxed animate-shake">
                <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {/* Login button */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 text-slate-700 font-bold text-sm py-3 px-4 rounded-2xl cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                <span>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}</span>
              </button>

              <div className="text-center pt-2">
                <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wide uppercase">
                  Powered by Firebase Authentication
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
