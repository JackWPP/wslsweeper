import type { ScanResponse, ScanUpdate, DiskInfo, MountInfo, ValidateResponse, DeleteResponse, CleanupSuggestion } from '../types';

const BASE = '';

export async function scanDirectory(path: string): Promise<ScanResponse> {
  const res = await fetch(`${BASE}/api/scan?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getDiskInfo(): Promise<DiskInfo> {
  const res = await fetch(`${BASE}/api/disk`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMounts(): Promise<MountInfo[]> {
  const res = await fetch(`${BASE}/api/mounts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validatePath(path: string): Promise<ValidateResponse> {
  const res = await fetch(`${BASE}/api/validate?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deletePath(path: string, token: string, sudoPassword?: string): Promise<DeleteResponse> {
  const res = await fetch(`${BASE}/api/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, confirm_token: token, sudo_password: sudoPassword }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCleanupSuggestions(): Promise<CleanupSuggestion[]> {
  const res = await fetch(`${BASE}/api/cleanup-suggestions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getContextCleanup(path: string): Promise<CleanupSuggestion[]> {
  const res = await fetch(`${BASE}/api/context-cleanup?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ScanProgressCallbacks {
  onSkeleton: (data: ScanResponse) => void;
  onUpdate: (path: string, recursiveSize: number, totalRecursiveSize: number, name: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export function scanDirectoryProgressive(
  path: string,
  callbacks: ScanProgressCallbacks,
): () => void {
  const source = new EventSource(`${BASE}/api/scan-progress?path=${encodeURIComponent(path)}`);

  source.onmessage = (e) => {
    try {
      const event: ScanUpdate = JSON.parse(e.data);
      if (event.type === 'skeleton' && event.data) {
        callbacks.onSkeleton(event.data);
      } else if (event.type === 'update' && event.path !== undefined) {
        callbacks.onUpdate(
          event.path,
          event.recursive_size ?? 0,
          event.total_recursive_size ?? 0,
          event.name ?? '',
        );
      } else if (event.type === 'done') {
        source.close();
        callbacks.onDone();
      }
    } catch {
      // ignore parse errors
    }
  };

  source.onerror = () => {
    source.close();
    callbacks.onError(new Error('SSE 连接中断'));
  };

  return () => source.close();
}
