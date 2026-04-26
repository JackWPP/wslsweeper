export interface ScanEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  recursive_size: number;
  is_protected: boolean;
  is_hidden: boolean;
  mod_time: string;
  permissions: string;
  child_count: number | null;
}

export interface ScanResponse {
  path: string;
  total_size: number;
  total_recursive_size: number;
  children: ScanEntry[];
  is_protected: boolean;
  scan_time_ms: number;
  error: string | null;
}

export interface ScanUpdate {
  type: 'skeleton' | 'update' | 'done';
  path?: string;
  name?: string;
  recursive_size?: number;
  total_recursive_size?: number;
  data?: ScanResponse;
}

export interface DiskInfo {
  total: number;
  used: number;
  available: number;
  percent: number;
  mount_point: string;
}

export interface MountInfo {
  mount_point: string;
  total: number;
  used: number;
  available: number;
  percent: number;
  filesystem: string;
}

export interface ValidateResponse {
  path: string;
  exists: boolean;
  is_protected: boolean;
  is_deletable: boolean;
  confirm_token: string | null;
  warning: string | null;
}

export interface DeleteResponse {
  success: boolean;
  freed_bytes: number;
  message: string;
}
