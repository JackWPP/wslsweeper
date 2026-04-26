import { useState, useEffect, useRef, useCallback } from 'react';
import { getDiskInfo, getMounts, validatePath, deletePath, scanDirectoryProgressive } from './api/client';
import type { ScanEntry, DiskInfo, MountInfo, ScanResponse } from './types';
import { BreadcrumbBar } from './components/BreadcrumbBar';
import { TreeMapCanvas } from './components/TreeMapCanvas';
import { SidebarInfo } from './components/SidebarInfo';
import { CleanupPanel } from './components/CleanupPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { formatBytes } from './utils/formatBytes';
import { Trash2, X, HardDrive, Sparkles } from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState('/');
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);
  const [disk, setDisk] = useState<DiskInfo | null>(null);
  const [mounts, setMounts] = useState<MountInfo[]>([]);
  const [scanningPaths, setScanningPaths] = useState<Set<string>>(new Set());
  const [scanningCount, setScanningCount] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [currentScanningName, setCurrentScanningName] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ entry: ScanEntry; x: number; y: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ entry: ScanEntry; token: string; needsSudo: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'info' | 'cleanup'>('info');
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const cancelScanRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getDiskInfo().then(setDisk).catch(() => {});
    getMounts().then(setMounts).catch(() => {});
  }, []);

  useEffect(() => {
    loadPath('/');
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const loadPath = useCallback((path: string) => {
    if (cancelScanRef.current) {
      cancelScanRef.current();
      cancelScanRef.current = null;
    }

    setError(null);
    setContextMenu(null);
    setScanningPaths(new Set());
    setScanningCount(0);
    setScannedCount(0);
    setCurrentScanningName('');
    setIsScanning(true);
    setCurrentPath(path);

    const cancel = scanDirectoryProgressive(path, {
      onSkeleton: (data) => {
        setScanResult(data);
        const dirPaths = new Set(data.children.filter(c => c.is_dir).map(c => c.path));
        setScanningPaths(dirPaths);
        setScanningCount(dirPaths.size);
      },
      onUpdate: (updatePath, recursiveSize, totalRecursiveSize, name) => {
        setScanResult(prev => {
          if (!prev) return prev;
          const nextChildren = prev.children.map(c =>
            c.path === updatePath ? { ...c, recursive_size: recursiveSize } : c
          );
          return {
            ...prev,
            children: nextChildren,
            total_recursive_size: totalRecursiveSize,
          };
        });
        setScanningPaths(prev => {
          const next = new Set(prev);
          next.delete(updatePath);
          return next;
        });
        setScannedCount(prev => prev + 1);
        setCurrentScanningName(name);
      },
      onDone: () => {
        setIsScanning(false);
        setScanningPaths(new Set());
        setCurrentScanningName('');
        cancelScanRef.current = null;
      },
      onError: (err) => {
        setError(err.message);
        setIsScanning(false);
        setScanningPaths(new Set());
        cancelScanRef.current = null;
      },
    });

    cancelScanRef.current = cancel;
  }, []);

  const handleContextMenu = useCallback((entry: ScanEntry, e: React.MouseEvent) => {
    setContextMenu({ entry, x: e.clientX, y: e.clientY });
  }, []);

  const handleDeleteClick = useCallback(async (entry: ScanEntry) => {
    setContextMenu(null);
    try {
      const validation = await validatePath(entry.path);
      if (!validation.is_deletable) {
        alert(validation.warning || '无法删除此文件');
        return;
      }
      if (!validation.confirm_token) {
        alert('无法获取删除令牌');
        return;
      }
      setDeleteDialog({ entry, token: validation.confirm_token, needsSudo: validation.needs_sudo });
    } catch (e: any) {
      alert('验证失败: ' + e.message);
    }
  }, []);

  const handleDeleteConfirm = useCallback(async (sudoPassword?: string) => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      await deletePath(deleteDialog.entry.path, deleteDialog.token, sudoPassword);
      setDeleteDialog(null);
      loadPath(currentPath);
      getDiskInfo().then(setDisk).catch(() => {});
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    } finally {
      setDeleting(false);
    }
  }, [deleteDialog, currentPath, loadPath]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    return () => {
      if (cancelScanRef.current) {
        cancelScanRef.current();
      }
    };
  }, []);

  const children = scanResult?.children || [];
  const totalRecursiveSize = scanResult?.total_recursive_size || 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-secondary)',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>
          🧹
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
          wslsweeper
        </span>
        <span style={{
          color: 'var(--text-muted)',
          fontSize: 12,
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: 10,
        }}>
          WSL2 存储空间清理工具
        </span>
        {scanResult && scanResult.total_recursive_size > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 13,
            color: 'var(--accent-blue-light)',
            fontWeight: 600,
          }}>
            {formatBytes(scanResult.total_recursive_size)}
          </span>
        )}
      </div>

      <BreadcrumbBar path={currentPath} onNavigate={loadPath} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <button
              onClick={() => setSidebarTab('info')}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderBottom: `2px solid ${sidebarTab === 'info' ? 'var(--accent-blue)' : 'transparent'}`,
                background: 'transparent',
                color: sidebarTab === 'info' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: sidebarTab === 'info' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all var(--transition)',
              }}
            >
              <HardDrive size={13} />
              磁盘信息
            </button>
            <button
              onClick={() => setSidebarTab('cleanup')}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 'none',
                borderBottom: `2px solid ${sidebarTab === 'cleanup' ? 'var(--accent-green)' : 'transparent'}`,
                background: 'transparent',
                color: sidebarTab === 'cleanup' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: sidebarTab === 'cleanup' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all var(--transition)',
              }}
            >
              <Sparkles size={13} />
              智能清理
            </button>
          </div>

          {sidebarTab === 'info' && (
            <SidebarInfo
              disk={disk}
              mounts={mounts}
              scanResult={scanResult}
              scanningCount={scanningCount}
              scannedCount={scannedCount}
              currentScanningName={currentScanningName}
              isScanning={isScanning}
            />
          )}
          {sidebarTab === 'cleanup' && (
            <CleanupPanel currentPath={currentPath} onNavigate={loadPath} />
          )}
        </div>

        <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-primary)' }}>
          {error && (
            <div style={{
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}>
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--accent-red)',
                borderRadius: 'var(--radius-md)',
                padding: '20px 24px',
                maxWidth: 400,
                textAlign: 'center',
              }}>
                <div style={{ color: 'var(--accent-red-light)', fontWeight: 600, marginBottom: 8 }}>扫描出错</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{error}</div>
              </div>
            </div>
          )}
          {!error && children.length === 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-muted)',
              fontSize: 14,
            }}>
              此目录为空或无内容可显示
            </div>
          )}
          {children.length > 0 && (
            <TreeMapCanvas
              children={children}
              totalRecursiveSize={totalRecursiveSize}
              scanningPaths={scanningPaths}
              width={size.width}
              height={size.height}
              onDrillDown={loadPath}
              onContextMenu={handleContextMenu}
            />
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            minWidth: 160,
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: 13,
              color: contextMenu.entry.is_protected ? 'var(--text-muted)' : 'var(--accent-red-light)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background var(--transition)',
            }}
            onMouseEnter={(e) => {
              if (!contextMenu.entry.is_protected) {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={() => {
              if (!contextMenu.entry.is_protected) {
                handleDeleteClick(contextMenu.entry);
              }
            }}
          >
            <Trash2 size={14} />
            {contextMenu.entry.is_protected ? '受保护，不可删除' : '删除'}
          </div>
          <div
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid var(--border-color)',
              transition: 'background var(--transition)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={() => setContextMenu(null)}
          >
            <X size={14} />
            取消
          </div>
        </div>
      )}

      {deleteDialog && (
        <ConfirmDialog
          message={`即将删除 ${deleteDialog.entry.is_dir ? '目录' : '文件'}: ${deleteDialog.entry.path}`}
          itemName={deleteDialog.entry.name}
          needsSudo={deleteDialog.needsSudo}
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteDialog(null)}
        />
      )}
    </div>
  );
}
