import type { DiskInfo, MountInfo, ScanResponse } from '../types';
import { formatBytes } from '../utils/formatBytes';
import { HardDrive, Clock, Folder, File, Shield, Loader2 } from 'lucide-react';

interface Props {
  disk: DiskInfo | null;
  mounts: MountInfo[];
  scanResult: ScanResponse | null;
  scanningCount: number;
  scannedCount: number;
  currentScanningName: string;
  isScanning: boolean;
}

function DiskBar({ disk }: { disk: DiskInfo | MountInfo }) {
  const percent = disk.percent;
  const barColor = percent > 90 ? 'var(--accent-red)'
    : percent > 75 ? 'var(--accent-amber)'
    : 'var(--accent-blue)';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {disk.mount_point}
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: barColor }}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <div style={{
        height: 6,
        background: 'var(--bg-tertiary)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 4,
      }}>
        <div style={{
          width: `${Math.min(percent, 100)}%`,
          height: '100%',
          background: barColor,
          borderRadius: 3,
          transition: 'width 300ms ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
        <span>已用 {formatBytes(disk.used)}</span>
        <span>可用 {formatBytes(disk.available)}</span>
      </div>
    </div>
  );
}

export function SidebarInfo({ disk, mounts, scanResult, scanningCount, scannedCount, currentScanningName, isScanning }: Props) {
  const dirs = scanResult?.children.filter(c => c.is_dir) || [];
  const files = scanResult?.children.filter(c => !c.is_dir) || [];
  const protectedCount = scanResult?.children.filter(c => c.is_protected).length || 0;
  const scanPercent = scanningCount > 0 ? Math.round((scannedCount / scanningCount) * 100) : 0;

  return (
    <div style={{
      width: 240,
      minWidth: 240,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      padding: '16px 14px',
      gap: 16,
    }}>
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 12,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          <HardDrive size={14} />
          磁盘使用
        </div>
        {disk && <DiskBar disk={disk} />}
        {mounts.length > 1 && (
          <div style={{ marginTop: 8 }}>
            {mounts.filter(m => m.mount_point !== '/').map(m => (
              <DiskBar key={m.mount_point} disk={m} />
            ))}
          </div>
        )}
      </div>

      {scanResult && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: 16,
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 12,
          }}>
            当前目录
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            路径
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text-primary)',
            fontFamily: 'monospace',
            marginBottom: 12,
            wordBreak: 'break-all',
            lineHeight: 1.4,
          }}>
            {scanResult.path}
          </div>

          {scanResult.total_recursive_size > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>总大小</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-blue-light)' }}>
                {formatBytes(scanResult.total_recursive_size)}
              </div>
            </div>
          )}

          {isScanning && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              marginBottom: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Loader2 size={14} className="animate-pulse" style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  正在计算: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentScanningName}</span>
                </span>
              </div>
              <div style={{
                height: 4,
                background: 'var(--bg-primary)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${scanPercent}%`,
                  height: '100%',
                  background: 'var(--accent-amber)',
                  borderRadius: 2,
                  transition: 'width 300ms ease',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 4,
              }}>
                <span>进度 {scannedCount}/{scanningCount}</span>
                <span>{scanPercent}%</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <Folder size={12} style={{ color: 'var(--accent-blue-light)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>目录</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {dirs.length}
              </div>
            </div>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <File size={12} style={{ color: 'var(--accent-green-light)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>文件</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {files.length}
              </div>
            </div>
          </div>

          {protectedCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--accent-red-light)',
              marginBottom: 8,
            }}>
              <Shield size={13} />
              {protectedCount} 个受保护路径
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            <Clock size={13} />
            扫描耗时 {scanResult.scan_time_ms.toFixed(0)}ms
          </div>
        </div>
      )}

      <div style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid var(--border-color)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        右键点击可删除 · 点击目录钻入
      </div>
    </div>
  );
}
