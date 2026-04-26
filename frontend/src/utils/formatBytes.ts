export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return (value / total * 100).toFixed(1) + '%';
}

export function parsePath(path: string): string[] {
  return path.split('/').filter(Boolean);
}
