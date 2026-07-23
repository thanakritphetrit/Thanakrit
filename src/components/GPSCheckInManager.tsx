import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { 
  MapPin, Navigation, Camera, CheckCircle2, LogOut, Clock, AlertTriangle, 
  RefreshCw, Search, ShieldCheck, UserCheck, CheckSquare, X, ChevronRight, ChevronDown, Eye, Calendar, Sparkles, Sliders,
  Edit3, Trash2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { MaintenanceTask, CheckInLog, AppUserRole } from '../types';
import L from 'leaflet';

interface GPSCheckInManagerProps {
  tasks: MaintenanceTask[];
  checkInLogs: CheckInLog[];
  user: User | null;
  userRole: AppUserRole;
  onCheckIn: (logData: Omit<CheckInLog, 'id' | 'createdAt'>) => Promise<string>;
  onCheckOut: (logId: string, checkOutData: Partial<CheckInLog>) => Promise<void>;
  onUpdateCheckInLog?: (logId: string, updates: Partial<CheckInLog>) => Promise<void>;
  onDeleteCheckInLog?: (logId: string) => Promise<void>;
  onUpdateTaskStatus?: (taskId: string, updates: Partial<MaintenanceTask>) => Promise<void>;
}

// Calculate distance between 2 coordinates in meters (Haversine Formula)
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export default function GPSCheckInManager({
  tasks,
  checkInLogs,
  user,
  userRole,
  onCheckIn,
  onCheckOut,
  onUpdateCheckInLog,
  onDeleteCheckInLog,
  onUpdateTaskStatus
}: GPSCheckInManagerProps) {
  // Map Ref
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // GPS State
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  // Selection & Form State
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Active check-in state
  const activeUserLog = checkInLogs.find(
    log => log.userEmail === user?.email && log.status === 'Checked-In'
  );

  // Check-Out modal
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [checkOutNotes, setCheckOutNotes] = useState('');
  const [checkOutPhoto, setCheckOutPhoto] = useState('');

  // Selected Log detail modal
  const [selectedLog, setSelectedLog] = useState<CheckInLog | null>(null);

  // Edit Log state
  const [editingLog, setEditingLog] = useState<CheckInLog | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editCheckOutNotes, setEditCheckOutNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'Checked-In' | 'Completed'>('Checked-In');
  const [editCheckInTime, setEditCheckInTime] = useState<string>('');
  const [editCheckOutTime, setEditCheckOutTime] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // History Filters & Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Checked-In' | 'Completed'>('All');
  const [logTab, setLogTab] = useState<'today' | 'history' | 'all'>('today');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isLogSectionExpanded, setIsLogSectionExpanded] = useState<boolean>(false);

  // Request & Watch GPS Position
  const fetchCurrentPosition = () => {
    if (!navigator.geolocation) {
      setGpsError('เบราว์เซอร์ของคุณไม่รองรับ Geolocation GPS');
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newCoords = { lat: latitude, lng: longitude, accuracy: Math.round(accuracy) };
        setCurrentCoords(newCoords);
        setIsLocating(false);

        // Reverse geocoding
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('กรุณาอนุญาตสิทธิ์เข้าถึงพิกัด GPS ในเบราว์เซอร์เพื่อใช้งานระบบเช็คอิน');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('ไม่สามารถดึงข้อมูลตำแหน่ง GPS ได้ในขณะนี้');
        } else {
          setGpsError('หมดเวลาในการค้นหาตำแหน่ง GPS');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );
  };

  // Reverse Geocode helper
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsFetchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th`);
      if (res.ok) {
        const data = await res.json();
        setCurrentAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setCurrentAddress(`พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setCurrentAddress(`พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  // Initial GPS fetch on component mount
  useEffect(() => {
    fetchCurrentPosition();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: Bangkok Thailand or User Coords
      const defaultLat = currentCoords?.lat || 13.7563;
      const defaultLng = currentCoords?.lng || 100.5018;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 15,
        zoomControl: true
      });

      // Standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Selected Task
  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  // Distance & Geofence Calculation
  const targetCoords = selectedTask?.targetLocation || (
    activeUserLog?.taskId ? tasks.find(t => t.id === activeUserLog.taskId)?.targetLocation : undefined
  );

  const distanceFromTarget = (currentCoords && targetCoords)
    ? calculateDistanceMeters(currentCoords.lat, currentCoords.lng, targetCoords.latitude, targetCoords.longitude)
    : null;

  const targetRadius = targetCoords?.radius || 200;
  const isInGeofence = distanceFromTarget !== null ? distanceFromTarget <= targetRadius : true;

  // Update Map Markers & View when position or task changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    // Remove target marker
    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }
    // Remove polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    // Add User Current Location Marker if available
    if (currentCoords) {
      const userIcon = L.divIcon({
        className: 'custom-user-gps-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
            <div class="w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const userMarker = L.marker([currentCoords.lat, currentCoords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
          <div class="text-xs p-1 font-sans">
            <p class="font-bold text-blue-700">📍 ตำแหน่งปัจจุบันของคุณ</p>
            <p class="text-slate-600 mt-0.5">${currentAddress || 'กำลังระบุที่อยู่...'}</p>
            <p class="text-[10px] text-slate-400 mt-1">ความแม่นยำ: ±${currentCoords.accuracy} เมตร</p>
          </div>
        `);

      userMarkerRef.current = userMarker;
    }

    // Add Target Location Marker if selected task has target location
    if (targetCoords) {
      const targetIcon = L.divIcon({
        className: 'custom-target-marker',
        html: `
          <div class="w-8 h-8 bg-rose-600 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });

      const targetMarker = L.marker([targetCoords.latitude, targetCoords.longitude], { icon: targetIcon })
        .addTo(map)
        .bindPopup(`
          <div class="text-xs p-1 font-sans">
            <p class="font-bold text-rose-700">🏢 สถานที่หน้างาน: ${targetCoords.name || selectedTask?.title || 'สถานที่ปฏิบัติงาน'}</p>
            <p class="text-slate-600 mt-0.5">รัศมี Geofence: ${targetRadius} เมตร</p>
          </div>
        `);

      targetMarkerRef.current = targetMarker;

      // Draw polyline connecting user to target
      if (currentCoords) {
        const polyline = L.polyline([
          [currentCoords.lat, currentCoords.lng],
          [targetCoords.latitude, targetCoords.longitude]
        ], {
          color: isInGeofence ? '#10b981' : '#f43f5e',
          weight: 3,
          dashArray: '6, 8',
          opacity: 0.8
        }).addTo(map);

        polylineRef.current = polyline;

        // Fit map bounds to show both markers
        const bounds = L.latLngBounds([
          [currentCoords.lat, currentCoords.lng],
          [targetCoords.latitude, targetCoords.longitude]
        ]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      }
    } else if (currentCoords) {
      map.setView([currentCoords.lat, currentCoords.lng], 16);
    }
  }, [currentCoords, selectedTaskId, activeUserLog]);

  // Handle Photo File Upload
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>, setPhotoState: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoState(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Check-In
  const handleDoCheckIn = async () => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนทำการเช็คอิน');
      return;
    }
    if (userRole === 'viewer') {
      alert('🔒 ขออภัย บัญชีของคุณมีสิทธิ์ระดับ Viewer เท่านั้น');
      return;
    }
    if (!currentCoords) {
      alert('ไม่สามารถระบุพิกัด GPS ได้ กรุณากดปุ่มค้นหาตำแหน่งอีกครั้ง');
      return;
    }
    if (!selectedTaskId) {
      alert('กรุณาเลือกงานซ่อมบำรุงที่ต้องการเช็คอินเข้าปฏิบัติงาน');
      return;
    }

    setSubmitting(true);
    try {
      const task = tasks.find(t => t.id === selectedTaskId);
      const nowIso = new Date().toISOString();

      const logData: Omit<CheckInLog, 'id' | 'createdAt'> = {
        taskId: selectedTaskId,
        taskTitle: task?.title || 'งานซ่อมบำรุงทั่วไป',
        equipment: task?.equipment || '-',
        departmentOrCompany: task?.departmentOrCompany || '-',
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'พนักงาน',
        userEmail: user.email || '',
        userPhoto: user.photoURL || '',
        userRole: userRole,

        checkInTime: nowIso,
        checkInLat: currentCoords.lat,
        checkInLng: currentCoords.lng,
        checkInAccuracy: currentCoords.accuracy || 0,
        checkInAddress: currentAddress || '',
        checkInPhoto: photoPreview || '',
        checkInNotes: notes || '',
        inGeofenceCheckIn: Boolean(isInGeofence),
        distanceFromTargetCheckIn: distanceFromTarget !== null && distanceFromTarget !== undefined ? distanceFromTarget : 0,

        status: 'Checked-In'
      };

      await onCheckIn(logData);

      // Optionally update task status to 'In Progress'
      if (onUpdateTaskStatus && selectedTaskId) {
        await onUpdateTaskStatus(selectedTaskId, {
          status: 'In Progress',
          checkInLocation: {
            latitude: currentCoords.lat,
            longitude: currentCoords.lng,
            timestamp: nowIso,
            inGeofence: Boolean(isInGeofence),
            accuracy: currentCoords.accuracy || 0,
            address: currentAddress || ''
          }
        });
      }

      setNotes('');
      setPhotoPreview('');
      setSelectedTaskId('');
      alert('✅ เช็คอินเข้าปฏิบัติงานสำเร็จ!');
    } catch (err) {
      console.error('Check-In error:', err);
      alert('เกิดข้อผิดพลาดในการเช็คอิน กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Check-Out
  const handleDoCheckOut = async () => {
    if (!activeUserLog || !activeUserLog.id) return;
    if (!currentCoords) {
      alert('ไม่สามารถระบุพิกัด GPS ได้ กรุณากดปุ่มค้นหาตำแหน่ง');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();

      // Calculate work duration in minutes
      const checkInTimeDate = new Date(activeUserLog.checkInTime).getTime();
      const nowTimeDate = new Date(nowIso).getTime();
      const durationMins = Math.max(1, Math.round((nowTimeDate - checkInTimeDate) / (1000 * 60)));

      const updates: Partial<CheckInLog> = {
        checkOutTime: nowIso,
        checkOutLat: currentCoords.lat,
        checkOutLng: currentCoords.lng,
        checkOutAccuracy: currentCoords.accuracy || 0,
        checkOutAddress: currentAddress || '',
        checkOutPhoto: checkOutPhoto || '',
        checkOutNotes: checkOutNotes || '',
        inGeofenceCheckOut: Boolean(isInGeofence),
        workDurationMinutes: durationMins,
        status: 'Completed'
      };

      await onCheckOut(activeUserLog.id, updates);

      // Optionally update task status to 'Completed'
      if (onUpdateTaskStatus && activeUserLog.taskId) {
        await onUpdateTaskStatus(activeUserLog.taskId, {
          status: 'Completed',
          completedDate: nowIso.split('T')[0],
          checkOutLocation: {
            latitude: currentCoords.lat,
            longitude: currentCoords.lng,
            timestamp: nowIso,
            inGeofence: Boolean(isInGeofence),
            accuracy: currentCoords.accuracy || 0,
            address: currentAddress || ''
          }
        });
      }

      setShowCheckOutModal(false);
      setCheckOutNotes('');
      setCheckOutPhoto('');
      alert(`🎉 เช็คเอาท์ออกจากหน้างานสำเร็จ! ระยะเวลาปฏิบัติงานรวม ${Math.floor(durationMins / 60)} ชม. ${durationMins % 60} นาที`);
    } catch (err) {
      console.error('Check-Out error:', err);
      alert('เกิดข้อผิดพลาดในการเช็คเอาท์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler: Open Edit Modal
  const handleOpenEditModal = (log: CheckInLog) => {
    setEditingLog(log);
    setEditNotes(log.checkInNotes || '');
    setEditCheckOutNotes(log.checkOutNotes || '');
    setEditStatus((log.status as 'Checked-In' | 'Completed') || 'Checked-In');
    try {
      if (log.checkInTime) {
        const d = new Date(log.checkInTime);
        const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setEditCheckInTime(isoStr);
      } else {
        setEditCheckInTime('');
      }
      if (log.checkOutTime) {
        const d = new Date(log.checkOutTime);
        const isoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setEditCheckOutTime(isoStr);
      } else {
        setEditCheckOutTime('');
      }
    } catch {
      setEditCheckInTime('');
      setEditCheckOutTime('');
    }
  };

  // Handler: Save Edit Log
  const handleSaveEdit = async () => {
    if (!editingLog || !onUpdateCheckInLog) return;
    setSavingEdit(true);
    try {
      const updates: Partial<CheckInLog> = {
        checkInNotes: editNotes,
        checkOutNotes: editCheckOutNotes,
        status: editStatus,
      };

      if (editCheckInTime) {
        updates.checkInTime = new Date(editCheckInTime).toISOString();
      }
      if (editCheckOutTime) {
        updates.checkOutTime = new Date(editCheckOutTime).toISOString();
      } else if (editStatus === 'Checked-In') {
        updates.checkOutTime = '';
        updates.workDurationMinutes = 0;
      }

      if (updates.checkInTime && updates.checkOutTime && updates.status === 'Completed') {
        const diffMs = new Date(updates.checkOutTime).getTime() - new Date(updates.checkInTime).getTime();
        updates.workDurationMinutes = Math.max(0, Math.round(diffMs / 60000));
      }

      await onUpdateCheckInLog(editingLog.id, updates);
      setEditingLog(null);
      if (selectedLog && selectedLog.id === editingLog.id) {
        setSelectedLog(prev => prev ? { ...prev, ...updates } : null);
      }
      alert('✅ แก้ไขข้อมูลประวัติเช็คอิน/เช็คเอาท์เรียบร้อยแล้ว');
    } catch (e) {
      console.error("Error updating log: ", e);
      alert('❌ เกิดข้อผิดพลาดในการปรับปรุงข้อมูล');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handler: Delete Log
  const handleDeleteLog = async (logId: string) => {
    if (!onDeleteCheckInLog) return;
    if (confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบบันทึกประวัติเช็คอิน/เช็คเอาท์รายการนี้?\n(การดำเนินการนี้จะไม่สามารถย้อนกลับได้)')) {
      setDeletingLogId(logId);
      try {
        await onDeleteCheckInLog(logId);
        if (selectedLog && selectedLog.id === logId) {
          setSelectedLog(null);
        }
        alert('🗑️ ลบประวัติเช็คอินเรียบร้อยแล้ว');
      } catch (e) {
        console.error("Error deleting log: ", e);
        alert('❌ เกิดข้อผิดพลาดในการลบข้อมูล');
      } finally {
        setDeletingLogId(null);
      }
    }
  };

  // Date helper (YYYY-MM-DD local)
  const getLocalDateString = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const todayStr = getLocalDateString(new Date().toISOString());

  // Count logs for tabs
  const logCounts = React.useMemo(() => {
    let todayCount = 0;
    let historyCount = 0;

    checkInLogs.forEach(log => {
      const logDate = getLocalDateString(log.checkInTime);
      if (log.status === 'Checked-In' || logDate === todayStr) {
        todayCount++;
      } else {
        historyCount++;
      }
    });

    return {
      today: todayCount,
      history: historyCount,
      all: checkInLogs.length
    };
  }, [checkInLogs, todayStr]);

  // Filtered Check-In Logs for table
  const filteredLogs = checkInLogs.filter(log => {
    const matchesSearch = 
      log.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.equipment && log.equipment.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.departmentOrCompany && log.departmentOrCompany.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = filterStatus === 'All' || log.status === filterStatus;

    const logDate = getLocalDateString(log.checkInTime);
    const isTodayOrActive = log.status === 'Checked-In' || logDate === todayStr;

    const matchesTab = 
      logTab === 'all' ? true :
      logTab === 'today' ? isTodayOrActive :
      !isTodayOrActive; // 'history' tab (older than 1 day / past days)

    const matchesDateFilter = !dateFilter || logDate === dateFilter;

    return matchesSearch && matchesStatus && matchesTab && matchesDateFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <MapPin size={22} />
            </div>
            <span>ระบบเช็คอิน - เช็คเอาท์เข้าปฏิบัติงานด้วย GPS Real-time</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ระบุตำแหน่งพิกัดดาวเทียมจริง ยืนยันการเข้าพื้นที่ปฏิบัติงาน (Geofence) พร้อมบันทึกภาพถ่ายและระยะเวลาการทำงาน
          </p>
        </div>

        <button
          onClick={fetchCurrentPosition}
          disabled={isLocating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0 border border-slate-200"
        >
          <RefreshCw size={15} className={isLocating ? 'animate-spin text-blue-600' : ''} />
          <span>{isLocating ? 'กำลังระบุพิกัด GPS...' : 'อัปเดตพิกัดปัจจุบัน'}</span>
        </button>
      </div>

      {/* GPS Warning Banner */}
      {gpsError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl flex items-start gap-3 text-xs">
          <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">เกิดข้อผิดพลาดในการรับพิกัด GPS</p>
            <p className="mt-0.5 text-rose-700">{gpsError}</p>
          </div>
        </div>
      )}

      {/* Active Check-in Banner (If user is currently checked in) */}
      {activeUserLog && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-5 rounded-2xl shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0">
                <UserCheck size={22} className="text-white" />
              </div>
              <div>
                <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider bg-emerald-900/40 text-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-400/30 mb-1">
                  กำลังปฏิบัติงานอยู่ที่หน้างาน (Active)
                </span>
                <h3 className="text-base font-bold text-white">{activeUserLog.taskTitle}</h3>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  เช็คอินเมื่อ: {new Date(activeUserLog.checkInTime).toLocaleString('th-TH')} • อุปกรณ์: {activeUserLog.equipment || '-'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCheckOutModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-emerald-800 font-bold text-xs rounded-xl hover:bg-emerald-50 transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
            >
              <LogOut size={16} />
              <span>เช็คเอาท์เสร็จสิ้นงาน (Check-Out)</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Layout: Map & Check-In Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Map (7 cols) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation size={18} className="text-blue-600" />
              <h3 className="font-bold text-slate-800 text-sm">แผนที่พิกัดดาวเทียมจริง (Interactive GPS Map)</h3>
            </div>
            {currentCoords && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ความแม่นยำ GPS: ±{currentCoords.accuracy}ม.
              </span>
            )}
          </div>

          {/* Leaflet Map Canvas */}
          <div className="relative w-full h-[360px] sm:h-[420px] rounded-xl overflow-hidden border border-slate-200 z-0 bg-slate-100">
            <div ref={mapContainerRef} className="w-full h-full" />

            {/* Float Info Overlay */}
            <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-lg z-[1000] text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="truncate max-w-[240px] sm:max-w-[340px]">
                  {isFetchingAddress ? 'กำลังค้นหาที่อยู่...' : currentAddress || 'กำลังโหลดพิกัด...'}
                </span>
                {distanceFromTarget !== null && (
                  <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                    isInGeofence 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {isInGeofence ? 'อยู่ในรัศมี Geofence' : `ห่างจากหน้างาน ${distanceFromTarget}ม.`}
                  </span>
                )}
              </div>
              {currentCoords && (
                <div className="text-[10px] text-slate-500 flex items-center gap-3">
                  <span>Lat: {currentCoords.lat.toFixed(6)}</span>
                  <span>Lng: {currentCoords.lng.toFixed(6)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Check-In / Check-Out Action Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
          {activeUserLog ? (
            /* Active Check-Out Panel */
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <LogOut size={20} className="text-emerald-600" />
                  <h3 className="font-bold text-slate-800 text-base">แบบฟอร์มเช็คเอาท์ (Check-Out)</h3>
                </div>
                <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                  กำลังปฏิบัติงาน
                </span>
              </div>

              <div className="space-y-4">
                {/* Active Task Info Card */}
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/50 p-3.5 rounded-xl border border-slate-200/90 space-y-2 text-xs">
                  <div className="flex justify-between items-start font-bold text-slate-800">
                    <span className="text-sm text-slate-900">{activeUserLog.taskTitle}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    <p>📍 เช็คอินเมื่อ: {new Date(activeUserLog.checkInTime).toLocaleString('th-TH')}</p>
                    <p>🛠️ อุปกรณ์: {activeUserLog.equipment || 'ไม่ระบุ'}</p>
                    <p>🏢 หน่วยงาน: {activeUserLog.departmentOrCompany || 'ไม่ระบุ'}</p>
                  </div>
                </div>

                {/* Check-Out Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    สรุปผลการทำงาน / หมายเหตุเช็คเอาท์
                  </label>
                  <textarea
                    rows={3}
                    value={checkOutNotes}
                    onChange={(e) => setCheckOutNotes(e.target.value)}
                    placeholder="ระบุสรุปผลการทำงาน เช่น ซ่อมบำรุงเปลี่ยนอะไหล่เรียบร้อย ทดสอบระบบผ่าน..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Check-Out Photo Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รูปถ่ายงานที่เสร็จสิ้น (Work Completion Photo)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer border border-slate-300 transition-colors">
                      <Camera size={16} className="text-emerald-600" />
                      <span>ถ่ายรูป / อัปโหลด</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, setCheckOutPhoto)}
                        className="hidden"
                      />
                    </label>

                    {checkOutPhoto && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300">
                        <img src={checkOutPhoto} alt="Completion Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setCheckOutPhoto('')}
                          className="absolute top-0 right-0 bg-rose-600 text-white p-0.5 rounded-bl"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Check-In Form */
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <CheckSquare size={20} className="text-blue-600" />
                <h3 className="font-bold text-slate-800 text-base">แบบฟอร์มเช็คอิน (Check-In)</h3>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Task Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เลือกใบงานซ่อมบำรุงที่ต้องการเข้าปฏิบัติงาน <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- กรุณาเลือกงานซ่อมบำรุง --</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.status}] {t.title} ({t.equipment || 'ไม่ระบุอุปกรณ์'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Task Detail Summary Card */}
                {selectedTask && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span>{selectedTask.title}</span>
                      <span className="text-blue-600 font-semibold">{selectedTask.type}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{selectedTask.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pt-1">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        อุปกรณ์: {selectedTask.equipment}
                      </span>
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        หน่วยงาน: {selectedTask.departmentOrCompany || '-'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมายเหตุ / วัตถุประสงค์การเช็คอิน
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ระบุรายละเอียด เช่น มาถึงหน้างานเตรียมเครื่องมือซ่อมบำรุง..."
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Photo Proof Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รูปถ่ายยืนยันหน้างาน (Photo Proof)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer border border-slate-300 transition-colors">
                      <Camera size={16} className="text-blue-600" />
                      <span>ถ่ายรูป / อัปโหลด</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, setPhotoPreview)}
                        className="hidden"
                      />
                    </label>

                    {photoPreview && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300">
                        <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPhotoPreview('')}
                          className="absolute top-0 right-0 bg-rose-600 text-white p-0.5 rounded-bl"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-3 border-t border-slate-100">
            {activeUserLog ? (
              <button
                onClick={handleDoCheckOut}
                disabled={submitting || !currentCoords}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <LogOut size={16} />
                )}
                <span>กดเช็คเอาท์เสร็จสิ้นงาน (Check-Out)</span>
              </button>
            ) : (
              <button
                onClick={handleDoCheckIn}
                disabled={submitting || !selectedTaskId || !currentCoords}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Navigation size={16} />
                )}
                <span>กดเช็คอินเข้าปฏิบัติงาน (Check-In)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Log Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        {/* Top Tab Bar: Today vs Historical Logs + Collapsible Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3 no-print">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => { setLogTab('today'); setIsLogSectionExpanded(true); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                logTab === 'today'
                  ? 'bg-white text-blue-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={14} className={logTab === 'today' ? 'text-blue-600' : 'text-slate-400'} />
              <span>รายการวันนี้ / กำลังทำ</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                logTab === 'today' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {logCounts.today}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setLogTab('history'); setIsLogSectionExpanded(true); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                logTab === 'history'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck size={14} className={logTab === 'history' ? 'text-emerald-600' : 'text-slate-400'} />
              <span>ประวัติย้อนหลัง (ครบ 1 วัน / เสร็จสิ้น)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                logTab === 'history' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {logCounts.history}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setLogTab('all'); setIsLogSectionExpanded(true); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                logTab === 'all'
                  ? 'bg-white text-slate-800 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={14} className={logTab === 'all' ? 'text-purple-600' : 'text-slate-400'} />
              <span>ทั้งหมด</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                {logCounts.all}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsLogSectionExpanded(!isLogSectionExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/90 text-slate-800 border border-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-2xs select-none ml-auto"
            title={isLogSectionExpanded ? "ย่อตารางซ่อน" : "ขยายแสดงตาราง"}
          >
            <span>{isLogSectionExpanded ? 'ย่อตารางซ่อน' : 'ขยายแสดงตาราง'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 text-slate-600 ${isLogSectionExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isLogSectionExpanded && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Clock size={18} className="text-blue-600" />
              <span>
                {logTab === 'today' ? 'บันทึกการเช็คอินประจำวันนี้ (Today Logs)' :
                 logTab === 'history' ? 'ประวัติการเช็คอินย้อนหลัง (Historical Check-In Logs)' :
                 'บันทึกประวัติการเช็คอินทั้งหมด (All Check-In Logs)'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {logTab === 'today' ? 'แสดงเฉพาะรายการเช็คอินวันนี้ หรืองานที่กำลังปฏิบัติอยู่ (ครบ 1 วันแล้วย้ายเข้าประวัติย้อนหลังอัตโนมัติ)' :
               'เก็บบันทึกประวัติเวลา พิกัด GPS ภาพถ่าย และพนักงานที่เข้าปฏิบัติงานย้อนหลัง'}
            </p>
          </div>

          {/* Controls & Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหางาน, พนักงาน..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 sm:w-48"
              />
            </div>

            {/* Date filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none"
                title="เลือกวันที่ต้องการดูประวัติ"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="p-0.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                  title="ล้างตัวกรองวันที่"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status dropdown */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="All">สถานะทั้งหมด</option>
              <option value="Checked-In">กำลังปฏิบัติงาน</option>
              <option value="Completed">เสร็จสิ้นงานแล้ว</option>
            </select>
          </div>
        </div>

        {/* Table View for Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[11px]">
                <th className="py-2.5 px-2">พนักงาน</th>
                <th className="py-2.5 px-2">งานซ่อมบำรุง</th>
                <th className="py-2.5 px-2">เวลาเช็คอิน</th>
                <th className="py-2.5 px-2">เวลาเช็คเอาท์</th>
                <th className="py-2.5 px-2 text-center">ระยะเวลา</th>
                <th className="py-2.5 px-2 text-center">สถานะ</th>
                <th className="py-2.5 px-2 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-medium text-xs">
                    ไม่พบรายการประวัติการเช็คอินตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* User */}
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        {log.userPhoto ? (
                          <img src={log.userPhoto} alt={log.userName} className="w-6 h-6 rounded-lg object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                            {log.userName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-[11.5px] truncate max-w-[110px]" title={log.userName}>{log.userName}</p>
                          <p className="text-[9.5px] text-slate-400 truncate max-w-[110px]">{log.userEmail}</p>
                        </div>
                      </div>
                    </td>

                    {/* Task Title */}
                    <td className="py-2.5 px-2">
                      <p className="font-bold text-slate-800 text-[11.5px] max-w-[150px] lg:max-w-[180px] truncate" title={log.taskTitle}>
                        {log.taskTitle}
                      </p>
                      <p className="text-[9.5px] text-slate-500 truncate max-w-[150px] lg:max-w-[180px]">
                        {log.equipment || log.departmentOrCompany || '-'}
                      </p>
                    </td>

                    {/* Check In Time & Geofence */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      <p className="font-semibold text-slate-800 text-[11.5px]">
                        {new Date(log.checkInTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[9.5px] text-slate-400">
                        {new Date(log.checkInTime).toLocaleDateString('th-TH')}
                      </p>
                      {log.inGeofenceCheckIn !== undefined && (
                        <span className={`inline-block text-[8.5px] font-bold px-1 py-0.2 rounded mt-0.5 ${
                          log.inGeofenceCheckIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {log.inGeofenceCheckIn ? '✓ ในระยะ' : 'นอกระยะ'}
                        </span>
                      )}
                    </td>

                    {/* Check Out Time */}
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {log.checkOutTime ? (
                        <div>
                          <p className="font-semibold text-slate-800 text-[11.5px]">
                            {new Date(log.checkOutTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[9.5px] text-slate-400">
                            {new Date(log.checkOutTime).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10.5px] italic">-</span>
                      )}
                    </td>

                    {/* Work Duration */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {log.workDurationMinutes ? (
                        <span className="font-mono text-[10.5px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {Math.floor(log.workDurationMinutes / 60)} ชม. {log.workDurationMinutes % 60} นาที
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10.5px]">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {log.status === 'Checked-In' ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          กำลังทำ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          เสร็จสิ้น
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {log.status === 'Checked-In' && (log.userId === user?.uid || userRole === 'admin') && (
                          <button
                            onClick={() => setShowCheckOutModal(true)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                            title="เช็คเอาท์"
                          >
                            <LogOut size={12} />
                            <span>เช็คเอาท์</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="ดูรายละเอียด"
                        >
                          <Eye size={12} />
                          <span className="hidden xl:inline">รายละเอียด</span>
                        </button>
                        {userRole !== 'viewer' && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(log)}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 border border-amber-200/80"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit3 size={12} />
                              <span className="hidden xl:inline">แก้ไข</span>
                            </button>
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              disabled={deletingLogId === log.id}
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-md transition-colors cursor-pointer inline-flex items-center gap-1 border border-rose-200/80 disabled:opacity-50"
                              title="ลบรายการ"
                            >
                              {deletingLogId === log.id ? (
                                <RefreshCw size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              <span className="hidden xl:inline">ลบ</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              ไม่พบรายการประวัติการเช็คอินตามเงื่อนไขที่เลือก
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-white hover:bg-slate-50/60 transition-colors space-y-2.5">
                {/* User Info & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.userPhoto ? (
                      <img src={log.userPhoto} alt={log.userName} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {log.userName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-800 truncate">{log.userName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{log.userEmail}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {log.status === 'Checked-In' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        กำลังทำงาน
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        เสร็จสิ้น
                      </span>
                    )}
                  </div>
                </div>

                {/* Task Title & Equipment */}
                <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60 space-y-0.5">
                  <p className="font-bold text-xs text-slate-800 break-words">{log.taskTitle}</p>
                  {(log.equipment || log.departmentOrCompany) && (
                    <p className="text-[10.5px] text-slate-500 truncate">
                      {log.equipment ? `อุปกรณ์: ${log.equipment}` : log.departmentOrCompany}
                    </p>
                  )}
                </div>

                {/* Times & Geofence */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-100/80">
                    <span className="text-[10px] text-emerald-700 font-bold block mb-0.5">📍 เช็คอิน</span>
                    <span className="font-bold text-slate-800 block">
                      {new Date(log.checkInTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                    <span className="text-[9.5px] text-slate-500 block">
                      {new Date(log.checkInTime).toLocaleDateString('th-TH')}
                    </span>
                    {log.inGeofenceCheckIn !== undefined && (
                      <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-1 ${
                        log.inGeofenceCheckIn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {log.inGeofenceCheckIn ? '✓ ใน Geofence' : '⚠️ นอก Geofence'}
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                    <span className="text-[10px] text-slate-500 font-bold block mb-0.5">🏁 เช็คเอาท์</span>
                    {log.checkOutTime ? (
                      <>
                        <span className="font-bold text-slate-800 block">
                          {new Date(log.checkOutTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                        <span className="text-[9.5px] text-slate-500 block">
                          {new Date(log.checkOutTime).toLocaleDateString('th-TH')}
                        </span>
                        {log.workDurationMinutes ? (
                          <span className="text-[9.5px] font-mono font-bold text-slate-600 block mt-1">
                            ⏱️ {Math.floor(log.workDurationMinutes / 60)} ชม. {log.workDurationMinutes % 60} น.
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400 text-xs italic block mt-1">ยังไม่เช็คเอาท์</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                  {log.status === 'Checked-In' && (log.userId === user?.uid || userRole === 'admin') && (
                    <button
                      onClick={() => setShowCheckOutModal(true)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                    >
                      <LogOut size={13} />
                      <span>เช็คเอาท์</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Eye size={13} />
                    <span>รายละเอียด</span>
                  </button>
                  {userRole !== 'viewer' && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(log)}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-amber-200"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        disabled={deletingLogId === log.id}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-rose-200 disabled:opacity-50"
                      >
                        {deletingLogId === log.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
          </div>
        )}
      </div>

      {/* Modal: Check-Out Popup */}
      {showCheckOutModal && activeUserLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <LogOut size={20} className="text-emerald-600" />
                <span>เช็คเอาท์เสร็จสิ้นการทำงาน (Check-Out)</span>
              </h3>
              <button
                onClick={() => setShowCheckOutModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-800">{activeUserLog.taskTitle}</p>
                <p className="text-slate-500">เช็คอินเมื่อ: {new Date(activeUserLog.checkInTime).toLocaleString('th-TH')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สรุปผลการทำงาน / หมายเหตุเช็คเอาท์
                </label>
                <textarea
                  rows={3}
                  value={checkOutNotes}
                  onChange={(e) => setCheckOutNotes(e.target.value)}
                  placeholder="เช่น ซ่อมเปลี่ยนอะไหล่เรียบร้อย อุปกรณ์ทำงานสมบูรณ์..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รูปถ่ายงานที่เสร็จสิ้น (Work Completion Photo)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer border border-slate-300">
                    <Camera size={15} className="text-emerald-600" />
                    <span>แนบรูปงานเสร็จ</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoUpload(e, setCheckOutPhoto)}
                      className="hidden"
                    />
                  </label>

                  {checkOutPhoto && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-300">
                      <img src={checkOutPhoto} alt="Completion" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowCheckOutModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDoCheckOut}
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {submitting && <RefreshCw size={14} className="animate-spin" />}
                <span>ยืนยันเช็คเอาท์</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Log Detail */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600" />
                <span>รายละเอียดบันทึกการเข้าปฏิบัติงาน GPS</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Task info */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-sm text-slate-800">{selectedLog.taskTitle}</p>
                <p className="text-slate-500">พนักงาน: {selectedLog.userName} ({selectedLog.userEmail})</p>
                <p className="text-slate-500">อุปกรณ์: {selectedLog.equipment || '-'}</p>
              </div>

              {/* Check-In Details */}
              <div className="border border-slate-200 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-bold text-emerald-700">
                  <span>📍 รายละเอียดการเช็คอิน (Check-In)</span>
                  <span>{new Date(selectedLog.checkInTime).toLocaleString('th-TH')}</span>
                </div>
                <p className="text-slate-600"><span className="font-semibold text-slate-700">สถานที่:</span> {selectedLog.checkInAddress || '-'}</p>
                <p className="text-slate-500 font-mono text-[11px]">
                  พิกัด: {selectedLog.checkInLat.toFixed(6)}, {selectedLog.checkInLng.toFixed(6)} (ความแม่นยำ: ±{selectedLog.checkInAccuracy || 0}ม.)
                </p>
                {selectedLog.checkInNotes && (
                  <p className="text-slate-600 bg-slate-50 p-2 rounded-lg italic border border-slate-100">
                    "{selectedLog.checkInNotes}"
                  </p>
                )}
                {selectedLog.checkInPhoto && (
                  <img src={selectedLog.checkInPhoto} alt="CheckIn Proof" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                )}
              </div>

              {/* Check-Out Details */}
              {selectedLog.checkOutTime && (
                <div className="border border-slate-200 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-blue-700">
                    <span>🏁 รายละเอียดการเช็คเอาท์ (Check-Out)</span>
                    <span>{new Date(selectedLog.checkOutTime).toLocaleString('th-TH')}</span>
                  </div>
                  <p className="text-slate-600"><span className="font-semibold text-slate-700">สถานที่:</span> {selectedLog.checkOutAddress || '-'}</p>
                  <p className="text-slate-500 font-mono text-[11px]">
                    พิกัด: {selectedLog.checkOutLat?.toFixed(6)}, {selectedLog.checkOutLng?.toFixed(6)}
                  </p>
                  {selectedLog.checkOutNotes && (
                    <p className="text-slate-600 bg-slate-50 p-2 rounded-lg italic border border-slate-100">
                      "{selectedLog.checkOutNotes}"
                    </p>
                  )}
                  {selectedLog.checkOutPhoto && (
                    <img src={selectedLog.checkOutPhoto} alt="CheckOut Proof" className="w-full h-40 object-cover rounded-xl border border-slate-200" />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {userRole !== 'viewer' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const logToEdit = selectedLog;
                      setSelectedLog(null);
                      handleOpenEditModal(logToEdit);
                    }}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={14} />
                    <span>แก้ไขข้อมูล</span>
                  </button>
                  <button
                    onClick={() => handleDeleteLog(selectedLog.id)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>ลบรายการ</span>
                  </button>
                </div>
              ) : <div />}
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Check-In/Check-Out Log */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Edit3 size={20} className="text-amber-600" />
                <span>แก้ไขบันทึกประวัติเช็คอิน/เช็คเอาท์</span>
              </h3>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Task Title & User */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <p className="font-bold text-slate-800 text-sm">{editingLog.taskTitle}</p>
                <p className="text-slate-500">พนักงาน: {editingLog.userName} ({editingLog.userEmail})</p>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  สถานะบันทึกการทำงาน
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'Checked-In' | 'Completed')}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                >
                  <option value="Checked-In">กำลังปฏิบัติงาน (Checked-In)</option>
                  <option value="Completed">เสร็จสิ้นงาน (Completed)</option>
                </select>
              </div>

              {/* Check-In Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  เวลาเช็คอิน (Check-In Time)
                </label>
                <input
                  type="datetime-local"
                  value={editCheckInTime}
                  onChange={(e) => setEditCheckInTime(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Check-In Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุเช็คอิน
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              {/* Check-Out Time */}
              {editStatus === 'Completed' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เวลาเช็คเอาท์ (Check-Out Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={editCheckOutTime}
                    onChange={(e) => setEditCheckOutTime(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Check-Out Notes */}
              {editStatus === 'Completed' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    หมายเหตุ / สรุปผลการเช็คเอาท์
                  </label>
                  <textarea
                    rows={2}
                    value={editCheckOutNotes}
                    onChange={(e) => setEditCheckOutNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {savingEdit && <RefreshCw size={14} className="animate-spin" />}
                <span>บันทึกการแก้ไข</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
