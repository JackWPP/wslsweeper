import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { ScanEntry } from '../types';
import { formatBytes, formatPercent } from '../utils/formatBytes';

interface Props {
  children: ScanEntry[];
  totalRecursiveSize: number;
  scanningPaths: Set<string>;
  width: number;
  height: number;
  onDrillDown: (path: string) => void;
  onContextMenu: (entry: ScanEntry, e: React.MouseEvent) => void;
}

interface LayoutNode {
  data: ScanEntry;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function getDisplaySize(entry: ScanEntry): number {
  return entry.is_dir ? entry.recursive_size : entry.size;
}

function getColor(entry: ScanEntry, totalSize: number): string {
  const size = getDisplaySize(entry);
  const ratio = totalSize > 0 ? size / totalSize : 0;

  if (entry.is_protected) {
    const l = 25 + ratio * 15;
    return `hsl(0, 72%, ${l}%)`;
  }
  if (entry.is_dir) {
    const l = 30 + (1 - ratio) * 25;
    return `hsl(217, 80%, ${l}%)`;
  }
  if (entry.is_hidden) {
    const l = 30 + (1 - ratio) * 20;
    return `hsl(220, 15%, ${l}%)`;
  }
  const l = 32 + (1 - ratio) * 22;
  return `hsl(152, 70%, ${l}%)`;
}

function getBorderColor(entry: ScanEntry): string {
  if (entry.is_protected) return '#ef4444';
  if (entry.is_dir) return 'rgba(96, 165, 250, 0.3)';
  return 'rgba(100, 116, 139, 0.15)';
}

export function TreeMapCanvas({ children, totalRecursiveSize, scanningPaths, width, height, onDrillDown, onContextMenu }: Props) {
  const [layout, setLayout] = useState<LayoutNode[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; entry: ScanEntry } | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const d3ModuleRef = useRef<any>(null);

  const filteredChildren = useMemo(() =>
    children.filter(c => getDisplaySize(c) > 0 || (c.is_dir && c.child_count !== 0)),
    [children]
  );

  useEffect(() => {
    if (!d3ModuleRef.current) {
      import('d3-hierarchy').then(d3 => {
        d3ModuleRef.current = d3;
        computeLayout();
      });
    } else {
      computeLayout();
    }

    function computeLayout() {
      const d3 = d3ModuleRef.current;
      if (!d3) return;

      const data = filteredChildren.map(c => ({ ...c, value: getDisplaySize(c) || 1 }));

      if (data.length === 0) {
        setLayout([]);
        return;
      }

      const root = d3.hierarchy({ name: 'root', children: data })
        .sum((d: any) => d.value || 0)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));

      const treemap = (d3 as any).treemap()
        .size([width, height])
        .padding(3)
        .round(true);

      const nodes = treemap(root);
      setLayout(nodes.descendants().slice(1) as LayoutNode[]);
    }
  }, [filteredChildren, width, height, totalRecursiveSize]);

  const handleClick = useCallback((entry: ScanEntry, isLeaf: boolean) => {
    if (entry.is_dir && !isLeaf) {
      onDrillDown(entry.path);
    }
  }, [onDrillDown]);

  const handleContext = useCallback((entry: ScanEntry, e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(entry, e);
  }, [onContextMenu]);

  if (width <= 0 || height <= 0) return null;

  const layoutMap = new Map<string, LayoutNode>();
  for (const node of layout) {
    layoutMap.set(node.data.path, node);
  }

  return (
    <div ref={containerRef} style={{ width, height, position: 'relative', overflow: 'hidden' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {filteredChildren.map((entry) => {
          const node = layoutMap.get(entry.path);
          if (!node) return null;

          const w = Math.max(0, node.x1 - node.x0);
          const h = Math.max(0, node.y1 - node.y0);
          const isSmall = w < 50 || h < 30;
          const isLeaf = !entry.is_dir || isSmall;
          const isHovered = hoveredPath === entry.path;
          const displaySize = getDisplaySize(entry);
          const isScanning = entry.is_dir && scanningPaths.has(entry.path);

          return (
            <g key={entry.path}>
              <rect
                className="treemap-rect"
                x={node.x0}
                y={node.y0}
                width={w}
                height={h}
                fill={getColor(entry, totalRecursiveSize)}
                fillOpacity={isHovered ? 1 : 0.9}
                stroke={isHovered ? '#f1f5f9' : getBorderColor(entry)}
                strokeWidth={isHovered ? 2 : entry.is_protected ? 2 : 0.5}
                rx={2}
                style={{
                  cursor: entry.is_dir ? 'pointer' : 'default',
                }}
                onClick={() => handleClick(entry, isLeaf)}
                onContextMenu={(e) => handleContext(entry, e)}
                onMouseEnter={(e) => {
                  setHoveredPath(entry.path);
                  setTooltip({ x: e.clientX, y: e.clientY, entry });
                }}
                onMouseMove={(e) => {
                  if (tooltip) {
                    setTooltip({ x: e.clientX, y: e.clientY, entry });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredPath(null);
                  setTooltip(null);
                }}
              />
              {isScanning && w > 20 && h > 20 && (
                <circle
                  className="scanning-dot"
                  cx={node.x0 + w - 8}
                  cy={node.y0 + 8}
                  r={3}
                  fill="var(--accent-amber)"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {w > 60 && h > 24 && (
                <text
                  className="treemap-text"
                  x={node.x0 + 6}
                  y={node.y0 + 16}
                  fontSize={12}
                  fontWeight={600}
                  fill="rgba(255,255,255,0.95)"
                  style={{ pointerEvents: 'none' }}
                >
                  {entry.name.length > Math.floor(w / 8) ? entry.name.slice(0, Math.floor(w / 8)) + '…' : entry.name}
                </text>
              )}
              {w > 60 && h > 40 && (
                <text
                  className="treemap-text"
                  x={node.x0 + 6}
                  y={node.y0 + 32}
                  fontSize={11}
                  fill="rgba(255,255,255,0.65)"
                  style={{ pointerEvents: 'none' }}
                >
                  {isScanning ? '计算中...' : formatBytes(displaySize)}
                </text>
              )}
              {w > 80 && h > 54 && totalRecursiveSize > 0 && !isScanning && (
                <text
                  className="treemap-text"
                  x={node.x0 + 6}
                  y={node.y0 + 46}
                  fontSize={10}
                  fill="rgba(255,255,255,0.45)"
                  style={{ pointerEvents: 'none' }}
                >
                  {formatPercent(displaySize, totalRecursiveSize)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 14, window.innerWidth - 260),
            top: Math.min(tooltip.y + 14, window.innerHeight - 200),
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-light)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            pointerEvents: 'none',
            zIndex: 9999,
            minWidth: 200,
            maxWidth: 260,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14, color: 'var(--text-primary)' }}>
            {tooltip.entry.is_dir ? '📁 ' : '📄 '}{tooltip.entry.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              大小: <span style={{ color: 'var(--accent-blue-light)', fontWeight: 600 }}>
                {scanningPaths.has(tooltip.entry.path) && tooltip.entry.is_dir
                  ? '计算中...'
                  : formatBytes(getDisplaySize(tooltip.entry))}
              </span>
            </div>
            {tooltip.entry.is_dir && tooltip.entry.recursive_size > 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                (递归总大小)
              </div>
            )}
            {totalRecursiveSize > 0 && !scanningPaths.has(tooltip.entry.path) && (
              <div style={{ color: 'var(--text-secondary)' }}>
                占比: <span style={{ color: 'var(--accent-amber)' }}>{formatPercent(getDisplaySize(tooltip.entry), totalRecursiveSize)}</span>
              </div>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
              {tooltip.entry.path}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {tooltip.entry.permissions} · {tooltip.entry.mod_time}
            </div>
            {tooltip.entry.is_dir && tooltip.entry.child_count !== null && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                子项: {tooltip.entry.child_count}
              </div>
            )}
            {tooltip.entry.is_protected && (
              <div style={{ color: 'var(--accent-red-light)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                ⚠ 受保护路径
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
