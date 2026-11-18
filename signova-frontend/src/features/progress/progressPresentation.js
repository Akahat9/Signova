export function formatMetricPercent(value) { if (!Number.isFinite(value)) return 'N/A'; const percent = value > 1 ? value : value * 100; return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`; }
export function formatPracticeTime(minutes) { if (!Number.isFinite(minutes) || minutes <= 0) return '0m'; if (minutes < 60) return `${Math.round(minutes)}m`; const hours = Math.floor(minutes / 60); const remaining = Math.round(minutes % 60); return remaining ? `${hours}h ${remaining}m` : `${hours}h`; }
export function radarPolygonPoints(values, radius = 76, center = 100) { return values.map((value, index) => { const angle = (-90 + (index * 360) / values.length) * (Math.PI / 180); const scaledRadius = radius * (Math.max(0, Math.min(100, value)) / 100); return `${center + Math.cos(angle) * scaledRadius},${center + Math.sin(angle) * scaledRadius}`; }).join(' '); }
export function toPointArray(points = []) { return points.map((point) => [point.x, point.y, point.z || 0]); }

