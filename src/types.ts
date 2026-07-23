export type MaintenanceType = 'Preventive' | 'Corrective' | 'Predictive' | 'Calibration' | 'Other';
export type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
export type MaintenancePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MaintenanceTask {
  id?: string;
  title: string;
  description: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  equipment: string;
  assignedTo: string;
  scheduledDate: string; // YYYY-MM-DD
  completedDate: string; // YYYY-MM-DD
  notes: string;
  createdAt: string;
  departmentOrCompany?: string; // หน่วยงาน / บริษัท
  province?: string; // จังหวัด
  district?: string; // อำเภอ
  subdistrict?: string; // ตำบล
  phone?: string; // เบอร์โทร
  targetLocation?: {
    latitude: number;
    longitude: number;
    radius?: number; // meters, default 200
    name?: string;
  };
  checkInLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    inGeofence?: boolean;
    accuracy?: number;
    address?: string;
  };
  checkOutLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    inGeofence?: boolean;
    accuracy?: number;
    address?: string;
  };
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export type InstallationStatus = 'Operational' | 'Pending Testing' | 'Needs Maintenance';

export interface MonthlyInstallation {
  id?: string;
  equipmentName: string;
  serialNumber: string;
  model: string;
  location: string;
  installDate: string; // YYYY-MM-DD
  technician: string;
  warrantyPeriodMonths: number;
  status: InstallationStatus;
  notes: string;
  createdAt: string;
  isApproved?: boolean;
  approvedBy?: string;
  approvedAt?: string;
}

export interface LoginHistory {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  timestamp: string; // ISO date string
  userAgent: string;
}

export type AppUserRole = 'admin' | 'technician' | 'viewer';

export interface UserRole {
  id?: string;
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: AppUserRole;
  updatedAt: string; // ISO date string
}

export interface CheckInLog {
  id?: string;
  taskId?: string;
  taskTitle: string;
  equipment?: string;
  departmentOrCompany?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  userRole?: AppUserRole;
  
  // Check-In Details
  checkInTime: string; // ISO string
  checkInLat: number;
  checkInLng: number;
  checkInAccuracy?: number;
  checkInAddress?: string;
  checkInPhoto?: string;
  checkInNotes?: string;
  inGeofenceCheckIn?: boolean;
  distanceFromTargetCheckIn?: number; // meters

  // Check-Out Details
  checkOutTime?: string; // ISO string
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutAccuracy?: number;
  checkOutAddress?: string;
  checkOutPhoto?: string;
  checkOutNotes?: string;
  inGeofenceCheckOut?: boolean;
  workDurationMinutes?: number;
  
  // Status
  status: 'Checked-In' | 'Completed';
  createdAt: string;
}

