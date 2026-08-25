export function Sparkline({ data, width = 120, height = 36, color = '#3b82f6' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const isUp = data[data.length - 1] >= data[0];
  const lineColor = color === 'auto' ? (isUp ? '#10b981' : '#ef4444') : color;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={areaPoints} fill={lineColor} opacity={0.1} />
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LineChart({ data, width = 600, height = 200, color = '#3b82f6', showArea = true }: { data: number[]; width?: number; height?: number; color?: string; showArea?: boolean }) {
  if (data.length < 2) return <div className="text-slate-400 text-sm">No data</div>;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const isUp = data[data.length - 1] >= data[0];
  const lineColor = color === 'auto' ? (isUp ? '#10b981' : '#ef4444') : color;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {showArea && <polygon points={areaPoints} fill={lineColor} opacity={0.08} />}
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DonutChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div className="text-slate-400 text-sm">No data</div>;
  const radius = size / 2 - 20;
  const cx = size / 2, cy = size / 2;
  let currentAngle = -90;
  const segments = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: d.color, label: d.label, value: d.value };
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={radius * 0.55} fill="white" className="dark:fill-slate-900" />
        <text x={cx} y={cy} textAnchor="middle" dy="0.35em" className="fill-slate-700 dark:fill-slate-300 text-sm font-semibold">
          {data.length} items
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-600 dark:text-slate-400">{d.label}</span>
            <span className="text-slate-400 dark:text-slate-500 font-medium">{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarChart({ data, height = 200, color = '#3b82f6' }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  if (data.length === 0) return <div className="text-slate-400 text-sm">No data</div>;
  const max = Math.max(...data.map((d) => Math.abs(d.value)));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const barHeight = max > 0 ? (Math.abs(d.value) / max) * (height - 30) : 0;
        const isNeg = d.value < 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">{d.value.toFixed(0)}</div>
            <div className="w-full rounded-t-md transition-all" style={{ height: barHeight, background: isNeg ? '#ef4444' : color, opacity: 0.8 }} />
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
