import { useState, useEffect, useCallback } from 'react';
import type { CleanupSuggestion } from '../types';
import { getCleanupSuggestions, getContextCleanup, deletePath, validatePath } from '../api/client';
import { formatBytes } from '../utils/formatBytes';
import { Trash2, Sparkles, Loader2, AlertTriangle, FolderOpen, RefreshCw, MapPin } from 'lucide-react';

interface Props {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const LABEL_COLORS: Record<string, string> = {
  pip_cache: '#3b82f6',
  npm_cache: '#ef4444',
  apt_cache: '#a78bfa',
  vscode_server: '#22c55e',
  qoder_server: '#f59e0b',
  cache_dir: '#64748b',
  yarn_cache: '#ef4444',
  conda_cache: '#3b82f6',
  docker: '#3b82f6',
  node_modules: '#22c55e',
  large_dir: '#f59e0b',
};

function SuggestionCard({
  suggestion,
  onDelete,
  onNavigate,
  deleting,
}: {
  suggestion: CleanupSuggestion;
  onDelete: (s: CleanupSuggestion) => void;
  onNavigate: (p: string) => void;
  deleting: boolean;
}) {
  const color = LABEL_COLORS[suggestion.label] || 'var(--text-muted)';
  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all var(--transition)',
        opacity: deleting ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{suggestion.icon}</span>
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {suggestion.name}
              <span style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: `${color}22`,
                color: color,
                fontWeight: 500,
              }}>
                {suggestion.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {formatBytes(suggestion.size)} · {suggestion.reason}
            </div>
          </div>
        </div>
      </div>
      <div style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
        lineHeight: 1.3,
      }}>
        {suggestion.path}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onNavigate(suggestion.path)}
          style={{
            flex: 1,
            padding: '5px 8px',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all var(--transition)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <FolderOpen size={12} />
          查看
        </button>
        <button
          onClick={() => onDelete(suggestion)}
          disabled={deleting}
          style={{
            flex: 1,
            padding: '5px 8px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-red)',
            color: '#fff',
            fontSize: 11,
            cursor: deleting ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'all var(--transition)',
          }}
        >
          <Trash2 size={12} />
          {deleting ? '删除中...' : '清理'}
        </button>
      </div>
    </div>
  );
}

export function CleanupPanel({ currentPath, onNavigate }: Props) {
  const [globalSuggestions, setGlobalSuggestions] = useState<CleanupSuggestion[]>([]);
  const [contextSuggestions, setContextSuggestions] = useState<CleanupSuggestion[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    try {
      const data = await getCleanupSuggestions();
      setGlobalSuggestions(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGlobalLoading(false);
    }
  }, []);

  const loadContext = useCallback(async () => {
    setContextLoading(true);
    try {
      const data = await getContextCleanup(currentPath);
      setContextSuggestions(data);
    } catch (e: any) {
      // context errors are less critical
    } finally {
      setContextLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadGlobal();
    loadContext();
  }, [loadGlobal, loadContext]);

  useEffect(() => {
    loadContext();
  }, [currentPath, loadContext]);

  async function handleDelete(suggestion: CleanupSuggestion) {
    if (!confirm(`确认删除 ${suggestion.name} (${formatBytes(suggestion.size)})?\n路径: ${suggestion.path}`)) {
      return;
    }
    setDeletingPath(suggestion.path);
    try {
      const validation = await validatePath(suggestion.path);
      if (!validation.is_deletable) {
        alert(validation.warning || '无法删除');
        return;
      }
      if (!validation.confirm_token) {
        alert('无法获取删除令牌');
        return;
      }
      await deletePath(suggestion.path, validation.confirm_token);
      setGlobalSuggestions(prev => prev.filter(s => s.path !== suggestion.path));
      setContextSuggestions(prev => prev.filter(s => s.path !== suggestion.path));
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    } finally {
      setDeletingPath(null);
    }
  }

  const globalTotal = globalSuggestions.reduce((sum, s) => sum + s.size, 0);
  const contextTotal = contextSuggestions.reduce((sum, s) => sum + s.size, 0);

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
      gap: 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          <Sparkles size={14} />
          智能清理
        </div>
        <button
          onClick={() => { loadGlobal(); loadContext(); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
          title="刷新"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {error && (
        <div style={{
          padding: 12,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--accent-red-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={13} />
            扫描失败
          </div>
          <div style={{ color: 'var(--text-muted)' }}>{error}</div>
        </div>
      )}

      {/* 当前目录推荐 */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          <MapPin size={13} style={{ color: 'var(--accent-amber)' }} />
          当前目录推荐
          {contextLoading && <Loader2 size={12} className="animate-pulse" style={{ color: 'var(--accent-amber)' }} />}
        </div>

        {contextSuggestions.length === 0 && !contextLoading && (
          <div style={{
            padding: 12,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
          }}>
            当前目录暂无推荐清理项
          </div>
        )}

        {contextSuggestions.length > 0 && (
          <>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                可释放 <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{formatBytes(contextTotal)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{contextSuggestions.length} 项</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contextSuggestions.map(s => (
                <SuggestionCard
                  key={`ctx-${s.path}`}
                  suggestion={s}
                  onDelete={handleDelete}
                  onNavigate={onNavigate}
                  deleting={deletingPath === s.path}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 全局缓存推荐 */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          <Sparkles size={13} style={{ color: 'var(--accent-green)' }} />
          全局缓存推荐
          {globalLoading && <Loader2 size={12} className="animate-pulse" style={{ color: 'var(--accent-green)' }} />}
        </div>

        {globalSuggestions.length === 0 && !globalLoading && (
          <div style={{
            padding: 12,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 12,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
          }}>
            暂无全局缓存推荐
          </div>
        )}

        {globalSuggestions.length > 0 && (
          <>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                可释放 <span style={{ color: 'var(--accent-green-light)', fontWeight: 700 }}>{formatBytes(globalTotal)}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{globalSuggestions.length} 项</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {globalSuggestions.slice(0, 10).map(s => (
                <SuggestionCard
                  key={`global-${s.path}`}
                  suggestion={s}
                  onDelete={handleDelete}
                  onNavigate={onNavigate}
                  deleting={deletingPath === s.path}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid var(--border-color)',
        fontSize: 11,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        点击"清理"可直接删除推荐项
      </div>
    </div>
  );
}
