import { Home, ChevronRight } from 'lucide-react';
import { parsePath } from '../utils/formatBytes';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function BreadcrumbBar({ path, onNavigate }: Props) {
  const segments = parsePath(path);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '6px 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      fontSize: 13,
      minHeight: 36,
    }}>
      <Home
        size={15}
        style={{
          cursor: 'pointer',
          color: 'var(--text-muted)',
          flexShrink: 0,
          transition: 'color var(--transition)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as SVGElement).style.color = 'var(--accent-blue-light)'; }}
        onMouseLeave={(e) => { (e.currentTarget as SVGElement).style.color = 'var(--text-muted)'; }}
        onClick={() => onNavigate('/')}
      />
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const target = '/' + segments.slice(0, i + 1).join('/');
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                cursor: isLast ? 'default' : 'pointer',
                color: isLast ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isLast ? 600 : 400,
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                transition: 'all var(--transition)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isLast) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue-light)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLast) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
              onClick={() => onNavigate(target)}
            >
              {seg}
            </span>
          </span>
        );
      })}
      {path === '/' && (
        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
          (根目录)
        </span>
      )}
    </div>
  );
}
