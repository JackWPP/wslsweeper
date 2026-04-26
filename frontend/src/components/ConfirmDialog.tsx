import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Trash2, Lock } from 'lucide-react';

interface Props {
  message: string;
  itemName: string;
  needsSudo?: boolean;
  loading?: boolean;
  onConfirm: (sudoPassword?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, itemName, needsSudo, loading, onConfirm, onCancel }: Props) {
  const [input, setInput] = useState('');
  const [sudoInput, setSudoInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sudoRef = useRef<HTMLInputElement>(null);
  const matched = input === itemName;

  useEffect(() => {
    if (needsSudo && sudoRef.current) {
      sudoRef.current.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [needsSudo]);

  const canConfirm = matched && (!needsSudo || sudoInput.length > 0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div className="animate-fade-in" style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        maxWidth: 440,
        width: '90%',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}>
          <AlertTriangle size={20} style={{ color: 'var(--accent-amber)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            确认删除
          </h3>
        </div>

        <p style={{ color: 'var(--accent-red-light)', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          {message}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          此操作不可撤销。请输入 <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{itemName}</strong> 以确认：
        </p>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={itemName}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: `1px solid ${matched ? 'var(--accent-green)' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'monospace',
            outline: 'none',
            marginBottom: needsSudo ? 0 : 16,
            transition: 'border-color var(--transition)',
            boxSizing: 'border-box',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canConfirm) onConfirm(needsSudo ? sudoInput : undefined);
            if (e.key === 'Escape') onCancel();
          }}
        />

        {needsSudo && (
          <div style={{ marginBottom: 16, marginTop: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
              fontSize: 12,
              color: 'var(--accent-amber)',
            }}>
              <Lock size={13} />
              此操作需要管理员权限，请输入 sudo 密码：
            </div>
            <input
              ref={sudoRef}
              type="password"
              value={sudoInput}
              onChange={(e) => setSudoInput(e.target.value)}
              placeholder="sudo 密码"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${sudoInput.length > 0 ? 'var(--accent-green)' : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color var(--transition)',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) onConfirm(sudoInput);
                if (e.key === 'Escape') onCancel();
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              transition: 'all var(--transition)',
            }}
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(needsSudo ? sudoInput : undefined)}
            disabled={!canConfirm || loading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: canConfirm ? 'var(--accent-red)' : 'var(--bg-tertiary)',
              color: canConfirm ? '#fff' : 'var(--text-muted)',
              cursor: canConfirm && !loading ? 'pointer' : 'not-allowed',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all var(--transition)',
            }}
          >
            <Trash2 size={14} />
            {loading ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
