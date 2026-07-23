import React, { useState, useMemo, useEffect } from 'react';
import { MaintenanceTask, MaintenanceType, MaintenanceStatus, MaintenancePriority, AppUserRole } from '../types';
import { 
  Plus, Search, Edit2, Trash2, Check, X, Filter, AlertCircle, 
  Clock, ShieldAlert, Wrench, RefreshCw, Layers, Calendar, User, FileText, Building2, ChevronDown, FileSpreadsheet, MapPin 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ThaiAddressSelector } from './ThaiAddressSelector';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { exportTasksToExcel } from '../utils/excelExport';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

// Haversine formula for distance calculation in meters
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Client-side Reverse Geocoding helper
const geocodeCoords = (lat: number, lng: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!(window as any).google || !(window as any).google.maps) {
      resolve('');
      return;
    }
    const geocoder = new (window as any).google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
      if (status === 'OK' && results?.[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve('');
      }
    });
  });
};

// Google Maps Key Instructions Component
function GoogleMapsKeyInstruction() {
  return (
    <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-4 max-w-md mx-auto text-slate-800 my-4 text-left">
      <div className="text-center">
        <span className="text-3xl">🔑</span>
        <h3 className="text-sm font-bold mt-2">ต้องการรหัส Google Maps API Key</h3>
        <p className="text-xs text-slate-500 mt-1 font-medium">กรุณาตั้งค่าเพื่อใช้งานระบบแผนที่และพิกัดนำทาง</p>
      </div>
      <div className="text-xs space-y-2.5 bg-white p-3.5 rounded-lg border border-slate-100 leading-relaxed font-medium text-slate-700">
        <p><strong>ขั้นตอนที่ 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener" className="text-blue-600 underline font-semibold">รับรหัส API Key จาก Google Cloud</a></p>
        <p><strong>ขั้นตอนที่ 2:</strong> เพิ่มรหัสลงใน AI Studio Secrets ของคุณ:</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-600">
          <li>เปิดเมนู <strong>Settings</strong> (ไอคอนรูปฟันเฟือง ⚙️ มุมบนขวา)</li>
          <li>เลือกแท็บ <strong>Secrets</strong></li>
          <li>พิมพ์ชื่อตัวแปร: <code>GOOGLE_MAPS_PLATFORM_KEY</code> แล้วกด <strong>Enter</strong></li>
          <li>วางรหัส API Key ของคุณในช่องขวา แล้วกด <strong>Enter</strong></li>
        </ul>
        <p className="text-[10px] text-amber-600 font-semibold bg-amber-50 p-2 rounded-md leading-relaxed">⚠️ เมื่อบันทึกค่าแล้ว ระบบจะทำการรีบิวด์และใช้งานแผนที่ได้อัตโนมัติทันที</p>
      </div>
    </div>
  );
}

// Google Maps Circle implementation inside @vis.gl/react-google-maps
function MapCircle({ center, radius }: { center: { lat: number; lng: number }; radius: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !center) return;
    const circle = new (window as any).google.maps.Circle({
      map,
      center,
      radius,
      strokeColor: '#2563eb', // blue-600
      strokeOpacity: 0.7,
      strokeWeight: 1.5,
      fillColor: '#3b82f6', // blue-500
      fillOpacity: 0.15,
    });
    return () => {
      circle.setMap(null);
    };
  }, [map, center, radius]);
  return null;
}

// Map picker for target location
function MapPicker({
  lat,
  lng,
  radius,
  onChange
}: {
  lat: number;
  lng: number;
  radius: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (map) {
      map.setCenter({ lat, lng });
    }
  }, [map, lat, lng]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placesLib || !searchQuery || !map) return;
    setSearching(true);
    placesLib.Place.searchByText({
      textQuery: searchQuery,
      fields: ['displayName', 'location'],
      locationBias: map.getCenter(),
      maxResultCount: 1,
    }).then(({ places }) => {
      setSearching(false);
      if (places?.[0]?.location) {
        const loc = places[0].location;
        const newLat = loc.lat();
        const newLng = loc.lng();
        onChange(newLat, newLng);
      } else {
        alert('ไม่พบสถานที่ที่ค้นหา');
      }
    }).catch((err) => {
      setSearching(false);
      console.error(err);
      alert('เกิดข้อผิดพลาดขณะค้นหาสถานที่');
    });
  };

  const handleMapClick = (e: any) => {
    if (e.detail?.latLng) {
      onChange(e.detail.latLng.lat, e.detail.latLng.lng);
    }
  };

  return (
    <div className="space-y-2 text-left">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="🔍 ค้นหาสถานที่หรือพิกัดบน Google Map..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 text-xs bg-white border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg cursor-pointer shrink-0 disabled:opacity-50"
        >
          {searching ? 'กำลังค้นหา...' : 'ค้นหา'}
        </button>
      </div>
      <div className="h-60 rounded-xl overflow-hidden border border-slate-200 relative">
        <Map
          defaultZoom={15}
          defaultCenter={{ lat, lng }}
          onClick={handleMapClick}
          mapId="MAP_PICKER_ID"
          gestureHandling="greedy"
          disableDefaultUI={true}
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={{ lat, lng }}>
            <Pin background="#2563eb" glyphColor="#fff" />
          </AdvancedMarker>
          <MapCircle center={{ lat, lng }} radius={radius} />
        </Map>
        <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-[10px] text-white px-2 py-1 rounded-md">
          คลิกเลือกจุดบนแผนที่เพื่อปักหมุดพิกัดปฏิบัติงาน
        </div>
      </div>
    </div>
  );
}

interface MaintenanceManagerProps {
  tasks: MaintenanceTask[];
  userRole: AppUserRole;
  currentUserEmail: string;
  onAddTask: (task: Omit<MaintenanceTask, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<MaintenanceTask>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onGenerateDummyData: () => Promise<void>;
  triggerCreateModal?: boolean;
  setTriggerCreateModal?: (trigger: boolean) => void;
}

export default function MaintenanceManager({
  tasks,
  userRole,
  currentUserEmail,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onGenerateDummyData,
  triggerCreateModal,
  setTriggerCreateModal
}: MaintenanceManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [type, setType] = useState<MaintenanceType>('Preventive');
  const [status, setStatus] = useState<MaintenanceStatus>('Pending');
  const [priority, setPriority] = useState<MaintenancePriority>('Medium');
  const [equipment, setEquipment] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [departmentOrCompany, setDepartmentOrCompany] = useState('');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [phone, setPhone] = useState('');

  // Google Maps target coordinate fields
  const [hasTargetLocation, setHasTargetLocation] = useState(false);
  const [targetLat, setTargetLat] = useState('13.7563');
  const [targetLng, setTargetLng] = useState('100.5018');
  const [targetRadius, setTargetRadius] = useState(200);

  // Active check-in task states
  const [activeGPSCheckTask, setActiveGPSCheckTask] = useState<MaintenanceTask | null>(null);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');

  const [scheduledDate, setScheduledDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [completedDate, setCompletedDate] = useState('');
  const [notes, setNotes] = useState('');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trigger modal open from external callback (Navbar)
  useEffect(() => {
    if (triggerCreateModal) {
      handleOpenCreate();
      if (setTriggerCreateModal) {
        setTriggerCreateModal(false);
      }
    }
  }, [triggerCreateModal, setTriggerCreateModal]);

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.departmentOrCompany || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || task.type === filterType;
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

      return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });
  }, [tasks, searchTerm, filterType, filterStatus, filterPriority]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsApproved(false);
    setType('Preventive');
    setStatus('Pending');
    setPriority('Medium');
    setEquipment('');
    setAssignedTo('');
    setDepartmentOrCompany('');
    setProvince('');
    setDistrict('');
    setSubdistrict('');
    setPhone('');
    const today = new Date();
    setScheduledDate(today.toISOString().split('T')[0]);
    setCompletedDate('');
    setNotes('');
    setEditingTask(null);
    setHasTargetLocation(false);
    setTargetLat('13.7563');
    setTargetLng('100.5018');
    setTargetRadius(200);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (task: MaintenanceTask) => {
    if (task.isApproved && userRole !== 'admin') {
      alert('🔒 ขออภัย ใบงานนี้ผ่านการอนุมัติแล้ว เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขข้อมูลได้');
      return;
    }
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setIsApproved(task.isApproved || false);
    setType(task.type);
    setStatus(task.status);
    setPriority(task.priority);
    setEquipment(task.equipment);
    setAssignedTo(task.assignedTo);
    setDepartmentOrCompany(task.departmentOrCompany || '');
    setProvince(task.province || '');
    setDistrict(task.district || '');
    setSubdistrict(task.subdistrict || '');
    setPhone(task.phone || '');
    setScheduledDate(task.scheduledDate);
    setCompletedDate(task.completedDate || '');
    setNotes(task.notes || '');

    if (task.targetLocation) {
      setHasTargetLocation(true);
      setTargetLat(task.targetLocation.latitude.toString());
      setTargetLng(task.targetLocation.longitude.toString());
      setTargetRadius(task.targetLocation.radius || 200);
    } else {
      setHasTargetLocation(false);
      setTargetLat('13.7563');
      setTargetLng('100.5018');
      setTargetRadius(200);
    }

    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !equipment || !scheduledDate) {
      alert('กรุณากรอกข้อมูลสำคัญ (หัวข้อ, อุปกรณ์ และวันที่กำหนดการ)');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskData: any = {
        title,
        description,
        type,
        status,
        priority,
        equipment,
        assignedTo,
        scheduledDate,
        completedDate: status === 'Completed' ? (completedDate || new Date().toISOString().split('T')[0]) : '',
        notes,
        departmentOrCompany,
        province,
        district,
        subdistrict,
        phone,
        isApproved: userRole === 'admin' ? isApproved : (editingTask ? (editingTask.isApproved || false) : false)
      };

      if (userRole === 'admin') {
        if (isApproved) {
          taskData.approvedBy = editingTask?.approvedBy || currentUserEmail;
          taskData.approvedAt = editingTask?.approvedAt || new Date().toISOString();
        } else {
          taskData.approvedBy = '';
          taskData.approvedAt = '';
        }
      }

      if (hasTargetLocation) {
        taskData.targetLocation = {
          latitude: parseFloat(targetLat) || 13.7563,
          longitude: parseFloat(targetLng) || 100.5018,
          radius: targetRadius,
          name: departmentOrCompany || equipment || title
        };
      } else {
        taskData.targetLocation = null;
      }

      if (editingTask && editingTask.id) {
        await onUpdateTask(editingTask.id, taskData);
      } else {
        await onAddTask(taskData);
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
      await onDeleteTask(id);
      setDeleteId(null);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetectGPS = () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการดึงพิกัด GPS');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setCurrentLat(uLat);
        setCurrentLng(uLng);
        setGpsLoading(false);

        // Calculate distance if target is set
        if (activeGPSCheckTask?.targetLocation) {
          const dist = getDistanceInMeters(
            uLat,
            uLng,
            activeGPSCheckTask.targetLocation.latitude,
            activeGPSCheckTask.targetLocation.longitude
          );
          setDistance(dist);
        }

        // Try to reverse geocode
        try {
          const addr = await geocodeCoords(uLat, uLng);
          setCurrentAddress(addr || 'พิกัดปัจจุบันของคุณ');
        } catch (e) {
          console.error(e);
          setCurrentAddress('พิกัดปัจจุบันของคุณ');
        }
      },
      (err) => {
        console.error(err);
        setGpsError(`ไม่สามารถระบุตำแหน่งของคุณได้: ${err.message}`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (activeGPSCheckTask) {
      setCurrentLat(null);
      setCurrentLng(null);
      setDistance(null);
      setGpsError(null);
      setCurrentAddress('');
      handleDetectGPS();
    }
  }, [activeGPSCheckTask]);

  const handleCheckIn = async () => {
    if (!activeGPSCheckTask || !activeGPSCheckTask.id || currentLat === null || currentLng === null) return;
    setIsSubmitting(true);
    try {
      const radius = activeGPSCheckTask.targetLocation?.radius || 200;
      const dist = distance !== null ? distance : getDistanceInMeters(
        currentLat,
        currentLng,
        activeGPSCheckTask.targetLocation?.latitude || 13.7563,
        activeGPSCheckTask.targetLocation?.longitude || 100.5018
      );

      const checkInLocation = {
        latitude: currentLat,
        longitude: currentLng,
        timestamp: new Date().toISOString(),
        inGeofence: dist <= radius,
        address: currentAddress || 'พิกัด GPS'
      };

      await onUpdateTask(activeGPSCheckTask.id, {
        checkInLocation,
        status: 'In Progress'
      });

      alert('เช็คอินงานปฏิบัติการเสร็จสมบูรณ์!');
      setActiveGPSCheckTask(null);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกเช็คอิน');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeGPSCheckTask || !activeGPSCheckTask.id || currentLat === null || currentLng === null) return;
    setIsSubmitting(true);
    try {
      const radius = activeGPSCheckTask.targetLocation?.radius || 200;
      const dist = distance !== null ? distance : getDistanceInMeters(
        currentLat,
        currentLng,
        activeGPSCheckTask.targetLocation?.latitude || 13.7563,
        activeGPSCheckTask.targetLocation?.longitude || 100.5018
      );

      const checkOutLocation = {
        latitude: currentLat,
        longitude: currentLng,
        timestamp: new Date().toISOString(),
        inGeofence: dist <= radius,
        address: currentAddress || 'พิกัด GPS'
      };

      await onUpdateTask(activeGPSCheckTask.id, {
        checkOutLocation,
        status: 'Completed',
        completedDate: new Date().toISOString().split('T')[0]
      });

      alert('เช็คเอาท์และปิดใบงานบำรุงรักษาเสร็จสมบูรณ์!');
      setActiveGPSCheckTask(null);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกเช็คเอาท์');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeStyle = (type: MaintenanceType) => {
    switch (type) {
      case 'Preventive': return 'bg-blue-50/80 text-blue-700 border-blue-200/80';
      case 'Corrective': return 'bg-rose-50/80 text-rose-700 border-rose-200/80';
      case 'Predictive': return 'bg-indigo-50/80 text-indigo-700 border-indigo-200/80';
      case 'Calibration': return 'bg-amber-50/80 text-amber-700 border-amber-200/80';
      default: return 'bg-slate-50/80 text-slate-700 border-slate-200/80';
    }
  };

  const getTypeThai = (type: MaintenanceType) => {
    switch (type) {
      case 'Preventive': return 'Preventive (PM)';
      case 'Corrective': return 'Corrective (CM)';
      case 'Predictive': return 'Predictive (PdM)';
      case 'Calibration': return 'Calibration (สอบเทียบ)';
      default: return 'อื่นๆ (Other)';
    }
  };

  const getStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-300/80 shadow-2xs">
            <Clock size={11} className="text-amber-500 animate-pulse shrink-0" />
            <span>รอดำเนินการ</span>
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-300/80 shadow-2xs">
            <RefreshCw size={11} className="text-blue-500 animate-spin shrink-0" style={{ animationDuration: '3s' }} />
            <span>กำลังดำเนินการ</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-300/80 shadow-2xs">
            <Check size={11} className="text-emerald-500 stroke-[3] shrink-0" />
            <span>เสร็จสิ้นภารกิจ</span>
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center whitespace-nowrap gap-1.5 text-[10.5px] font-bold px-2.5 py-1 rounded-xl bg-rose-50 text-rose-900 border border-rose-300/80 shadow-2xs">
            <X size={11} className="text-rose-500 stroke-[3] shrink-0" />
            <span>ยกเลิกแผน</span>
          </span>
        );
    }
  };

  const getStatusThai = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Pending': return 'รอดำเนินการ';
      case 'In Progress': return 'กำลังดำเนินการ';
      case 'Completed': return 'เสร็จสิ้นภารกิจ';
      case 'Cancelled': return 'ยกเลิกแผน';
    }
  };

  const getPriorityStyle = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'Low': return 'bg-slate-100 text-slate-600 border border-slate-200/60 font-semibold';
      case 'Medium': return 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold';
      case 'High': return 'bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold';
      case 'Critical': return 'bg-rose-50 text-rose-800 border border-rose-200/60 font-bold';
    }
  };

  const getPriorityThai = (priority: MaintenancePriority) => {
    switch (priority) {
      case 'Low': return 'ปกติ / ต่ำ';
      case 'Medium': return 'ปานกลาง';
      case 'High': return 'ความสำคัญสูง';
      case 'Critical': return 'วิกฤตเร่งด่วน';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between no-print">
        <div className="relative w-full xl:w-64 shrink-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหา ชื่องาน, อุปกรณ์, ช่าง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 text-xs bg-slate-50/80 border border-slate-200 rounded-xl pl-9.5 pr-3 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0 shrink-0">
          <div className="h-10 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 px-2.5 rounded-xl border border-slate-200/80 transition-all shrink-0">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent border-0 text-slate-700 text-xs font-semibold focus:ring-0 focus:outline-hidden cursor-pointer"
            >
              <option value="all">ประเภท: ทั้งหมด</option>
              <option value="Preventive">Preventive Maintenance (PM)</option>
              <option value="Corrective">Corrective Maintenance (CM)</option>
              <option value="Predictive">Predictive Maintenance (PdM)</option>
              <option value="Calibration">Calibration (สอบเทียบ)</option>
              <option value="Other">อื่นๆ</option>
            </select>
          </div>

          <div className="h-10 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 px-2.5 rounded-xl border border-slate-200/80 transition-all shrink-0">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent border-0 text-slate-700 text-xs font-semibold focus:ring-0 focus:outline-hidden cursor-pointer"
            >
              <option value="all">สถานะ: ทั้งหมด</option>
              <option value="Pending">รอดำเนินการ</option>
              <option value="In Progress">กำลังดำเนินการ</option>
              <option value="Completed">เสร็จสิ้น</option>
              <option value="Cancelled">ยกเลิก</option>
            </select>
          </div>

          <div className="h-10 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 px-2.5 rounded-xl border border-slate-200/80 transition-all shrink-0">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-transparent border-0 text-slate-700 text-xs font-semibold focus:ring-0 focus:outline-hidden cursor-pointer"
            >
              <option value="all">ความสำคัญ: ทั้งหมด</option>
              <option value="Low">ต่ำ</option>
              <option value="Medium">ปานกลาง</option>
              <option value="High">สูง</option>
              <option value="Critical">วิกฤต</option>
            </select>
          </div>

          <button
            onClick={() => exportTasksToExcel(filteredTasks, `รายการงานซ่อมบำรุง_${new Date().toISOString().slice(0,10)}`)}
            className="h-10 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs hover:shadow-md active:scale-95 whitespace-nowrap"
            title="ส่งออกรายการงานซ่อมบำรุงเป็นไฟล์ Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>ส่งออก Excel</span>
          </button>

          {userRole !== 'viewer' && (
            <button
              onClick={handleOpenCreate}
              className="h-10 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-xs hover:shadow-md active:scale-95 whitespace-nowrap"
            >
              <Plus size={15} />
              <span>สร้างใบงานซ่อมบำรุง</span>
            </button>
          )}
        </div>
      </div>

      {/* Database Empty Alert / Generate Dummy Button */}
      {tasks.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl text-center no-print max-w-xl mx-auto space-y-3 mt-6">
          <Wrench size={40} className="text-blue-500 mx-auto animate-bounce" />
          <h3 className="text-sm font-semibold text-blue-800">ยินดีต้อนรับสู่ระบบจำลองการซ่อมบำรุงเพื่อการศึกษา!</h3>
          <p className="text-xs text-blue-600 leading-relaxed">
            ในขณะนี้ยังไม่มีข้อมูลงานบำรุงรักษาซ่อมบำรุงเก็บไว้ในฐานข้อมูล Firebase Firestore ของคุณ {userRole !== 'viewer' ? 'คุณสามารถเริ่มเพิ่มงานเอง หรือคลิกปุ่มด้านล่างเพื่อสุ่มชุดข้อมูลจำลองเพื่อการศึกษา (Dummy Data) ไปทดลองเรียนรู้ระบบได้ทันที' : 'กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินหรือช่างเพื่อเริ่มสร้างงานบำรุงรักษาซ่อมบำรุง'}
          </p>
          {userRole !== 'viewer' && (
            <button
              onClick={onGenerateDummyData}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>สร้างข้อมูลจำลองเพื่อการศึกษา</span>
            </button>
          )}
        </div>
      )}

      {/* Task List Table/Grid */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="py-3.5 px-4.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">ชื่องานซ่อมบำรุง / อุปกรณ์</th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">ประเภทงาน</th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">ระดับความสำคัญ</th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">ผู้รับผิดชอบ / ช่าง</th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">กำหนดการ</th>
                  <th className="py-3.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">สถานะและการอนุมัติ</th>
                  <th className="py-3.5 px-4.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-3.5 px-4.5 max-w-sm align-top">
                        <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{task.description}</div>
                        )}
                        
                        {/* Equipment & Contact Badges */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          {task.equipment && (
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200/60 whitespace-nowrap">
                              อุปกรณ์: {task.equipment}
                            </span>
                          )}
                          {task.departmentOrCompany && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium whitespace-nowrap">
                              <Building2 size={11} />
                              <span>{task.departmentOrCompany}</span>
                            </span>
                          )}
                          {(task.subdistrict || task.district || task.province) && (
                            <span className="bg-slate-50 text-slate-600 border border-slate-200/60 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium whitespace-nowrap">
                              <MapPin size={11} className="text-slate-400" />
                              <span>{[task.subdistrict, task.district, task.province].filter(Boolean).join(', ')}</span>
                            </span>
                          )}
                          {task.phone && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-md font-mono font-medium whitespace-nowrap">
                              📞 {task.phone}
                            </span>
                          )}
                        </div>

                        {/* GPS Target Location & Check-In / Out Status Badges */}
                        {(task.targetLocation || task.checkInLocation || task.checkOutLocation) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {task.targetLocation && (
                              <span 
                                className="inline-flex items-center gap-1 text-blue-800 bg-blue-50/90 px-2 py-0.5 rounded-md border border-blue-200/80 font-medium whitespace-nowrap"
                                title={`พิกัดเป้าหมาย: ${task.targetLocation.latitude}, ${task.targetLocation.longitude} (รัศมี ${task.targetLocation.radius}ม.)`}
                              >
                                🎯 พิกัดเป้าหมาย
                              </span>
                            )}

                            {task.checkInLocation && task.checkOutLocation ? (
                              <span className="inline-flex items-center text-[10px] bg-white border border-slate-200/90 rounded-md overflow-hidden font-medium shadow-2xs whitespace-nowrap">
                                <span 
                                  className="inline-flex items-center gap-1 bg-emerald-50/90 text-emerald-900 px-2 py-0.5 border-r border-slate-200/80"
                                  title={`สถานที่เช็คอิน: ${task.checkInLocation.address || 'ไม่ระบุสถานที่'}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  เช็คอิน: {new Date(task.checkInLocation.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} {new Date(task.checkInLocation.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                  {task.checkInLocation.inGeofence ? (
                                    <span className="text-emerald-600 font-bold ml-0.5">✓ ใน Geofence</span>
                                  ) : (
                                    <span className="text-amber-600 font-bold ml-0.5">⚠️ นอก Geofence</span>
                                  )}
                                </span>
                                <span 
                                  className="inline-flex items-center gap-1 bg-indigo-50/90 text-indigo-900 px-2 py-0.5"
                                  title={`สถานที่เช็คเอาท์: ${task.checkOutLocation.address || 'ไม่ระบุสถานที่'}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                  เช็คเอาท์: {new Date(task.checkOutLocation.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} {new Date(task.checkOutLocation.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                  {task.checkOutLocation.inGeofence ? (
                                    <span className="text-indigo-600 font-bold ml-0.5">✓ ใน Geofence</span>
                                  ) : (
                                    <span className="text-amber-600 font-bold ml-0.5">⚠️ นอก Geofence</span>
                                  )}
                                </span>
                              </span>
                            ) : (
                              <>
                                {task.checkInLocation && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50/90 px-2 py-0.5 rounded-md border border-emerald-200/80 font-medium whitespace-nowrap"
                                    title={`สถานที่เช็คอิน: ${task.checkInLocation.address || 'ไม่ระบุสถานที่'}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    เช็คอิน: {new Date(task.checkInLocation.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} {new Date(task.checkInLocation.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                    {task.checkInLocation.inGeofence ? (
                                      <span className="text-emerald-600 font-bold ml-0.5">✓ ใน Geofence</span>
                                    ) : (
                                      <span className="text-amber-600 font-bold ml-0.5">⚠️ นอก Geofence</span>
                                    )}
                                  </span>
                                )}

                                {task.checkOutLocation && (
                                  <span 
                                    className="inline-flex items-center gap-1 text-indigo-800 bg-indigo-50/90 px-2 py-0.5 rounded-md border border-indigo-200/80 font-medium whitespace-nowrap"
                                    title={`สถานที่เช็คเอาท์: ${task.checkOutLocation.address || 'ไม่ระบุสถานที่'}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                    เช็คเอาท์: {new Date(task.checkOutLocation.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })} {new Date(task.checkOutLocation.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                    {task.checkOutLocation.inGeofence ? (
                                      <span className="text-indigo-600 font-bold ml-0.5">✓ ใน Geofence</span>
                                    ) : (
                                      <span className="text-amber-600 font-bold ml-0.5">⚠️ นอก Geofence</span>
                                    )}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 align-top pt-4.5 whitespace-nowrap">
                        <span className={`inline-flex items-center whitespace-nowrap text-[11px] font-semibold border px-2.5 py-1 rounded-xl ${getTypeStyle(task.type)} shadow-2xs`}>
                          {getTypeThai(task.type)}
                        </span>
                      </td>
                      <td className="py-4 px-4 align-top pt-4.5 whitespace-nowrap">
                        <span className={`inline-flex items-center whitespace-nowrap text-[11px] px-2.5 py-1 rounded-xl ${getPriorityStyle(task.priority)} shadow-2xs`}>
                          {getPriorityThai(task.priority)}
                        </span>
                      </td>
                      <td className="py-4 px-4 align-top pt-4.5 text-xs text-slate-700 font-medium whitespace-nowrap">
                        {task.assignedTo ? (
                          <span className="inline-flex items-center whitespace-nowrap gap-1.5 bg-slate-100/90 text-slate-700 px-2.5 py-1 rounded-xl border border-slate-200/60 font-semibold text-xs">
                            <User size={12} className="text-slate-400" />
                            {task.assignedTo}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs whitespace-nowrap">ยังไม่ได้มอบหมาย</span>
                        )}
                      </td>
                      <td className="py-4 px-4 align-top pt-4.5 whitespace-nowrap">
                        <div className="inline-flex items-center whitespace-nowrap gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                          <Calendar size={12} className="text-slate-400 shrink-0" />
                          <span className="text-xs font-mono text-slate-700 font-bold">{task.scheduledDate}</span>
                        </div>
                        {task.completedDate && (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center whitespace-nowrap gap-1">
                            <Check size={11} className="stroke-[3] shrink-0" />
                            <span>เสร็จเมื่อ: {task.completedDate}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 align-top pt-4.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1.5 w-[140px]">
                          {/* Task Status Pill / Select */}
                          {userRole === 'admin' ? (
                            <div className="relative inline-flex items-center w-full" title="คลิกเพื่อเปลี่ยนสถานะงานซ่อมบำรุง">
                              <select
                                value={task.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value as MaintenanceStatus;
                                  try {
                                    await onUpdateTask(task.id!, {
                                      status: newStatus,
                                      completedDate: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : task.completedDate
                                    });
                                  } catch (error) {
                                    console.error("Error updating status:", error);
                                  }
                                }}
                                className={`w-full whitespace-nowrap text-[11px] font-bold px-2.5 py-1.5 pr-6 rounded-xl border cursor-pointer appearance-none outline-none shadow-2xs transition-all active:scale-95 ${
                                  task.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300/80 hover:bg-emerald-100/80 focus:ring-2 focus:ring-emerald-500/20'
                                    : task.status === 'In Progress'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300/80 hover:bg-blue-100/80 focus:ring-2 focus:ring-blue-500/20'
                                    : task.status === 'Cancelled'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300/80 hover:bg-rose-100/80 focus:ring-2 focus:ring-rose-500/20'
                                    : 'bg-amber-50 text-amber-900 border-amber-300/80 hover:bg-amber-100/80 focus:ring-2 focus:ring-amber-500/20'
                                }`}
                              >
                                <option value="Pending">🕒 รอดำเนินการ</option>
                                <option value="In Progress">🔄 กำลังดำเนินการ</option>
                                <option value="Completed">✓ เสร็จสิ้นภารกิจ</option>
                                <option value="Cancelled">✕ ยกเลิกแผน</option>
                              </select>
                              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60 text-slate-600" />
                            </div>
                          ) : (
                            <div className="w-full">{getStatusBadge(task.status)}</div>
                          )}

                          {/* Approval Status Toggle Button for Admin */}
                          <div className="w-full">
                            {userRole === 'admin' ? (
                              <button
                                onClick={async () => {
                                  const nextApproved = !task.isApproved;
                                  try {
                                    await onUpdateTask(task.id!, {
                                      isApproved: nextApproved,
                                      approvedBy: nextApproved ? currentUserEmail : '',
                                      approvedAt: nextApproved ? new Date().toISOString() : ''
                                    });
                                  } catch (error) {
                                    console.error("Error toggling approval:", error);
                                  }
                                }}
                                className={`w-full flex items-center justify-between whitespace-nowrap text-[10.5px] font-bold px-2.5 py-1 rounded-xl cursor-pointer transition-all hover:shadow-2xs active:scale-95 border ${
                                  task.isApproved
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/80'
                                    : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/80'
                                }`}
                                title="คลิกเพื่อสลับสถานะอนุมัติ / รออนุมัติ"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.isApproved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                  <span>{task.isApproved ? 'อนุมัติแล้ว ✓' : 'รออนุมัติ ⏳'}</span>
                                </span>
                                <ChevronDown size={10} className="text-slate-400 opacity-60 ml-0.5" />
                              </button>
                            ) : task.isApproved ? (
                              <span 
                                className="w-full flex items-center justify-center whitespace-nowrap gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[9.5px] font-bold px-2.5 py-0.5 rounded-xl"
                                title={`อนุมัติโดย: ${task.approvedBy || ''} เมื่อ ${task.approvedAt ? new Date(task.approvedAt).toLocaleDateString('th-TH') : ''}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                อนุมัติแล้ว
                              </span>
                            ) : (
                              <span className="w-full flex items-center justify-center whitespace-nowrap gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 text-[9.5px] font-bold px-2.5 py-0.5 rounded-xl">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                รออนุมัติ
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Dynamic GPS Check-In / Check-Out Actions (Admin & Technician Only) */}
                          {task.targetLocation && userRole !== 'viewer' && (
                            <div className="mr-1">
                              {!task.checkInLocation ? (
                                <button
                                  onClick={() => setActiveGPSCheckTask(task)}
                                  className="flex items-center gap-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-md transition-all cursor-pointer shadow-xs hover:-translate-y-0.5 shrink-0"
                                  title="เช็คอินสถานที่ปฏิบัติงานผ่าน GPS"
                                >
                                  <span>📍 เช็คอิน GPS</span>
                                </button>
                              ) : !task.checkOutLocation ? (
                                <button
                                  onClick={() => setActiveGPSCheckTask(task)}
                                  className="flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-md transition-all cursor-pointer shadow-xs hover:-translate-y-0.5 shrink-0 animate-pulse"
                                  title="เช็คเอาท์สถานที่ปฏิบัติงานและปิดใบงาน"
                                >
                                  <span>🏁 เช็คเอาท์ GPS</span>
                                </button>
                              ) : null}
                            </div>
                          )}

                          {userRole !== 'viewer' && (
                            <button
                              onClick={() => handleOpenEdit(task)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขใบงาน"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          
                          {userRole === 'admin' && (
                            <button
                              onClick={() => setDeleteId(task.id || null)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบงาน"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                      ไม่พบข้อมูลแผนงานซ่อมบำรุงที่ตรงกับตัวกรองของคุณ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
            >
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Wrench size={16} className="text-blue-500" />
                  {editingTask ? 'แก้ไขรายละเอียดแผนงานซ่อมบำรุง' : 'สร้างแผนงานซ่อมบำรุงใหม่'}
                </h3>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <FileText size={13} className="text-slate-400" />
                    ชื่องานซ่อมบำรุง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ล้างฟิลเตอร์เครื่องปรับอากาศประจำสัปดาห์, เปลี่ยนสายพานเครื่องปั่นไฟ"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">รายละเอียดงานเพิ่มเติม</label>
                  <textarea
                    placeholder="อธิบายขั้นตอนงาน ผลลัพธ์ที่ต้องการ หรือปัญหาที่ตรวจพบ..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
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
                      placeholder="เช่น แอร์คอยล์เปลือย AHU-02, เครื่องปั่นไฟหลัก"
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
                      placeholder="เช่น นายอภิสิทธิ์, บจก. แอร์เซอร์วิส"
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
                      <option value="Low" className="text-slate-500">ต่ำ / ทั่วไป</option>
                      <option value="Medium" className="text-blue-600">ปานกลาง</option>
                      <option value="High" className="text-amber-600">สูง / เร่งด่วน</option>
                      <option value="Critical" className="text-rose-600 font-bold">วิกฤต (Critical)</option>
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

                {/* Admin Approval Section */}
                {userRole === 'admin' && (
                  <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-4 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <span>✓ อนุมัติแผนงานซ่อมบำรุงนี้ (Admin Approval)</span>
                      </span>
                      <p className="text-[10px] text-emerald-600 font-medium">เมื่ออนุมัติแล้ว แผนงานจะถูกบันทึกเป็น "อนุมัติแล้ว" และจะจำกัดการแก้ไขเฉพาะผู้ดูแลระบบ</p>
                      {editingTask?.approvedBy && (
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">อนุมัติโดย: {editingTask.approvedBy} ({editingTask.approvedAt ? new Date(editingTask.approvedAt).toLocaleDateString('th-TH') : ''})</p>
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
                  <label className="text-xs font-semibold text-slate-700">หมายเหตุ / สรุปผลหลังงานซ่อม</label>
                  <textarea
                    placeholder="เช่น ตรวจสอบพบสารทำความเย็นรั่วซึมเล็กน้อย ได้ทำการแก้ไขอุดรอยรั่วเรียบร้อย..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium text-slate-700"
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
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSubmitting && <RefreshCw size={13} className="animate-spin" />}
                    <span>{editingTask ? 'บันทึกการแก้ไข' : 'สร้างแผนงาน'}</span>
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
                <AlertCircle size={24} />
                <h4 className="text-sm font-bold">ยืนยันการลบแผนงาน?</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบใบงานซ่อมบำรุงนี้? เมื่อทำรายการแล้ว ข้อมูลนี้จะถูกลบออกจากฐานข้อมูล Firebase อย่างถาวร และไม่สามารถกู้คืนได้
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
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>ยืนยันลบข้อมูล</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GPS/Google Maps Check-In & Check-Out Modal */}
      <AnimatePresence>
        {activeGPSCheckTask && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-100 overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 size={16} className="text-emerald-500" />
                  <span>เช็คอินสถานที่ปฏิบัติงาน (Google Maps Sign-In)</span>
                </h3>
                <button
                  onClick={() => setActiveGPSCheckTask(null)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Task brief */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-left text-xs">
                  <div>
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">ชื่องานบำรุงรักษา</div>
                    <div className="font-bold text-slate-800 mt-0.5">{activeGPSCheckTask.title}</div>
                    <div className="text-slate-500 mt-1 font-semibold">อุปกรณ์: {activeGPSCheckTask.equipment}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">ผู้รับผิดชอบ & พื้นที่</div>
                    <div className="font-semibold text-slate-700 mt-0.5">{activeGPSCheckTask.assignedTo || 'ยังไม่ได้ระบุช่าง'}</div>
                    <div className="text-slate-500 mt-1 font-semibold">
                      {[activeGPSCheckTask.subdistrict, activeGPSCheckTask.district, activeGPSCheckTask.province].filter(Boolean).join(', ') || 'ไม่ได้ระบุที่อยู่'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  {/* Left Column: Map */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="text-xs font-bold text-slate-700 text-left">📍 แผนที่แสดงตำแหน่งและพิกัด GPS จริง</div>
                    
                    {hasValidKey ? (
                      <div className="h-72 w-full rounded-xl overflow-hidden border border-slate-200 relative">
                        <APIProvider apiKey={API_KEY}>
                          <Map
                            defaultZoom={15}
                            defaultCenter={{
                              lat: activeGPSCheckTask.targetLocation?.latitude || 13.7563,
                              lng: activeGPSCheckTask.targetLocation?.longitude || 100.5018
                            }}
                            mapId="CHECK_IN_MAP_ID"
                            gestureHandling="greedy"
                            disableDefaultUI={true}
                            style={{ width: '100%', height: '100%' }}
                          >
                            {/* Target Pin */}
                            <AdvancedMarker
                              position={{
                                lat: activeGPSCheckTask.targetLocation?.latitude || 13.7563,
                                lng: activeGPSCheckTask.targetLocation?.longitude || 100.5018
                              }}
                            >
                              <Pin background="#ea4335" borderColor="#b31412" glyphColor="#fff" />
                            </AdvancedMarker>

                            {/* Geofencing circle around target */}
                            <MapCircle
                              center={{
                                lat: activeGPSCheckTask.targetLocation?.latitude || 13.7563,
                                lng: activeGPSCheckTask.targetLocation?.longitude || 100.5018
                              }}
                              radius={activeGPSCheckTask.targetLocation?.radius || 200}
                            />

                            {/* User's current detected location pin */}
                            {currentLat !== null && currentLng !== null && (
                              <AdvancedMarker position={{ lat: currentLat, lng: currentLng }}>
                                <Pin background="#1a73e8" borderColor="#1557b0" glyphColor="#fff">
                                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                </Pin>
                              </AdvancedMarker>
                            )}
                          </Map>
                        </APIProvider>
                        <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-[9px] text-white px-2.5 py-1 rounded-md leading-none">
                          🔴 หมุดแดง = เป้าหมาย | 🔵 หมุดน้ำเงิน = คุณอยู่ที่นี่ (รัศมีวงกลม Geofence = {activeGPSCheckTask.targetLocation?.radius || 200}ม.)
                        </div>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                        <GoogleMapsKeyInstruction />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Status & GPS Dashboard */}
                  <div className="md:col-span-2 space-y-4 text-left">
                    <div className="text-xs font-bold text-slate-700">🛰️ รายงานพิกัดและระบบ Geofencing</div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs">
                      {/* GPS Tracking status */}
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-slate-500 font-semibold">สถานะสัญญาณ GPS:</span>
                        {gpsLoading ? (
                          <span className="flex items-center gap-1 text-blue-600 font-bold animate-pulse">
                            <RefreshCw size={11} className="animate-spin" /> ค้นหาพิกัด...
                          </span>
                        ) : gpsError ? (
                          <span className="text-rose-600 font-bold flex items-center gap-1">
                            <AlertCircle size={11} /> ขัดข้อง
                          </span>
                        ) : currentLat !== null ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span> เชื่อมต่อพิกัด
                          </span>
                        ) : (
                          <span className="text-slate-400">ไม่ได้เชื่อมต่อ</span>
                        )}
                      </div>

                      {/* Distance info */}
                      {currentLat !== null && distance !== null && (
                        <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                          <span className="text-slate-500 font-semibold">ระยะห่างเป้าหมาย:</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">
                            {distance >= 1000 ? `${(distance / 1000).toFixed(2)} กม.` : `${distance} เมตร`}
                          </span>
                        </div>
                      )}

                      {/* Geofence Check badge */}
                      {currentLat !== null && activeGPSCheckTask.targetLocation && distance !== null && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <span className="text-slate-500 font-semibold">ตรวจสอบความปลอดภัย Geofence:</span>
                          {distance <= (activeGPSCheckTask.targetLocation.radius || 200) ? (
                            <span className="inline-flex items-center gap-1 w-full justify-center bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-1.5 rounded-lg text-[11px]">
                              <Check size={12} className="stroke-[3]" /> ยืนยันพิกัด: อยู่ในขอบเขตปฏิบัติงาน
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 w-full justify-center bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-1.5 rounded-lg text-[11px]">
                                <AlertCircle size={12} /> คำเตือน: นอกขอบเขตปฏิบัติงาน
                              </span>
                              <p className="text-[9px] text-amber-600 leading-relaxed font-semibold">
                                พิกัดของคุณห่างเกินรัศมีที่กำหนดไว้ ({activeGPSCheckTask.targetLocation.radius}ม.) ช่างอาจปฏิบัติงานนอกพื้นที่หรือเสาสัญญาณพิกัดคลาดเคลื่อน
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Display coordinates */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">รายละเอียดตำแหน่งของคุณ</div>
                        {currentLat !== null && currentLng !== null ? (
                          <div className="space-y-1">
                            <div className="font-mono text-[10px] bg-white p-1.5 rounded border border-slate-200 font-semibold leading-relaxed">
                              LAT: {currentLat.toFixed(6)}<br />
                              LNG: {currentLng.toFixed(6)}
                            </div>
                            {currentAddress && (
                              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{currentAddress}</p>
                            )}
                          </div>
                        ) : gpsError ? (
                          <p className="text-[10px] text-rose-500 leading-relaxed font-semibold">{gpsError}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic font-semibold">อยู่ระหว่างการร้องขอการเข้าถึงพิกัด GPS...</p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDetectGPS}
                      disabled={gpsLoading}
                      className="w-full text-xs bg-slate-100 hover:bg-slate-200 border border-slate-300 py-2 rounded-lg text-slate-700 font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />
                      <span>อัปเดตและดึงพิกัด GPS ของฉันอีกครั้ง</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between no-print">
                <button
                  type="button"
                  onClick={() => setActiveGPSCheckTask(null)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  ย้อนกลับ / ยกเลิก
                </button>

                <div>
                  {!activeGPSCheckTask.checkInLocation ? (
                    <button
                      type="button"
                      onClick={handleCheckIn}
                      disabled={currentLat === null || isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Check size={14} className="stroke-[3]" />
                      )}
                      <span>บันทึกยืนยัน เช็คอิน (Check-In)</span>
                    </button>
                  ) : !activeGPSCheckTask.checkOutLocation ? (
                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={currentLat === null || isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-all cursor-pointer shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-1.5"
                    >
                      {isSubmitting ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Check size={14} className="stroke-[3]" />
                      )}
                      <span>บันทึกยืนยัน เช็คเอาท์ (Check-Out) & ปิดใบงาน</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
