import { useMemo } from 'react';
import * as d3Hierarchy from 'd3-hierarchy';
import type { ScanEntry } from '../types';

interface TreeMapNode {
  name: string;
  data: ScanEntry;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  depth: number;
  parent: TreeMapNode | null;
}

export function useTreemapLayout(
  children: ScanEntry[],
  width: number,
  height: number
) {
  return useMemo(() => {
    const data = children
      .filter(c => c.size > 0 || c.is_dir)
      .map(c => ({ ...c, value: c.is_dir ? Math.max(c.size, 1) : c.size }));

    type DataNode = { name: string; data?: ScanEntry; value?: number; children?: DataNode[] };

    const root = d3Hierarchy.hierarchy<DataNode>({ name: 'root', children: data })
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3Hierarchy.treemap<DataNode>()
      .size([width, height])
      .padding(2)
      .round(true);

    const nodes = treemap(root);
    return nodes.descendants().slice(1) as unknown as TreeMapNode[];
  }, [children, width, height]);
}