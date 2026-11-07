import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/*
 * Hand-rolled SVG chart kit.
 * Specs: 2px lines, 10% area wash, <=24px bars with 4px rounded data-ends,
 * hairline solid gridlines, crosshair tooltip on lines, per-mark tooltips on bars,
 * legend for >=2 series, table view on every chart, text never in series colors.
 * Colors come from CSS tokens (--series-n, --ramp-n, --status-*), validated for
 * both the white and dark surfaces.
 */

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

// ---------- number formatting ----------
export const fmtNum = (n) => {
  const v = Number(n) || 0;
  return Math.abs(v) >= 10000
    ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
    : new Intl.NumberFormat('en').format(Math.round(v * 10) / 10);
};

export const fmtMoney = (n, currency = 'INR') => {
  const v = Number(n) || 0;
  const big = Math.abs(v) >= 10000;
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      notation: big ? 'compact' : 'standard',
      maximumFractionDigits: big ? 1 : 0,
    }).format(v);
  } catch {
    return `${currency} ${fmtNum(v)}`;
  }
};

export const fmtPct = (n) => `${Math.round((Number(n) || 0) * 10) / 10}%`;

function niceTicks(max, count = 4, integer = false) {
  if (max <= 0) return [0, 1];
  const raw = Math.max(max / count, integer ? 1 : 0);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ---------- Stat tile ----------
/**
 * @param {{label:string, value:string, delta?:number|null, upIsGood?:boolean, foot?:string, icon?:any, spark?:number[]}} p
 */
export function StatTile({ label, value, delta, upIsGood = true, foot, icon: Icon, spark }) {
  const dir = delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down';
  const good = dir === 'flat' ? 'flat' : (dir === 'up') === upIsGood ? 'up' : 'down';
  const DIcon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <motion.div className="glass kpi" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4, rotateX: 4, rotateY: -3, transformPerspective: 900 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
      <div className="kpi-label">{Icon && <Icon size={15} />} {label}</div>
      <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
        <div className="kpi-value">{value}</div>
        {spark?.length > 1 && <Sparkline values={spark} />}
      </div>
      <div className="kpi-foot">
        {delta !== undefined && (
          <span className={`delta ${good}`} aria-label={delta == null ? 'no previous data' : `${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} percent`}>
            <DIcon size={14} /> {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
          </span>
        )}
        <span>{foot}</span>
      </div>
    </motion.div>
  );
}

function Sparkline({ values, width = 84, height = 28 }) {
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 3 - (v / max) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden style={{ marginLeft: 'auto', flexShrink: 0, overflow: 'visible' }}>
      <path d={d} fill="none" stroke="var(--axis)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth="2" />
    </svg>
  );
}

// ---------- Card with table toggle ----------
export function ChartCard({ title, sub, className = '', table, children, action }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <motion.div className={`glass chart-card ${className}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="chart-head">
        <div style={{ minWidth: 0 }}>
          <div className="chart-title">{title}</div>
          {sub && <div className="chart-sub">{sub}</div>}
        </div>
        {action}
        {table && (
          <button className="chart-toggle" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {asTable && table ? <DataTable {...table} /> : children}
    </motion.div>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="table-scroll">
      <table className="viz-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.format ? c.format(r[c.key], r) : r[c.key]}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Line / area chart with crosshair ----------
/**
 * @param {{labels:string[], series:{key:string,name:string,values:number[]}[], format?:(n:number)=>string, height?:number}} p
 */
export function LineChart({ labels, series, format = fmtNum, height = 230 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 12, right: series.length > 1 ? 70 : 16, bottom: 26, left: 48 };
  const innerW = Math.max(width - pad.left - pad.right, 10);
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const integer = series.every((s) => s.values.every(Number.isInteger));
  const ticks = niceTicks(max, 4, integer);
  const top = ticks[ticks.length - 1];
  const x = (i) => pad.left + (labels.length > 1 ? (i / (labels.length - 1)) * innerW : innerW / 2);
  const y = (v) => pad.top + innerH - (v / top) * innerH;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 70))));
  const single = series.length === 1;

  const paths = useMemo(
    () =>
      series.map((s) => {
        const line = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const area = `${line} L${x(s.values.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
        return { line, area };
      }),
    [series, width, top] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Direct end labels, dropped if they would collide (legend + tooltip still carry identity).
  const endYs = series.map((s) => y(s.values[s.values.length - 1] || 0));
  const labelsFit = series.length > 1 && endYs.every((a, i) => endYs.every((b, j) => i === j || Math.abs(a - b) >= 14));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / innerW) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(labels.length - 1, (h ?? -1) + 1));
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? labels.length) - 1));
    if (e.key === 'Escape') setHover(null);
  };

  return (
    <div className="chart-wrap" ref={ref}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s, i) => (
            <span key={s.key}><i className="key-line" style={{ background: SERIES[i] }} /> {s.name}</span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          height={height}
          tabIndex={0}
          role="img"
          aria-label={`${series.map((s) => s.name).join(' and ')} over time. Use left and right arrow keys to read values.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="axis-text">{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) =>
            (i % every === 0 && (labels.length - 1 - i >= every * 0.75 || i === labels.length - 1)) || i === labels.length - 1 ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'} className="axis-text">{l}</text>
            ) : null
          )}
          {series.map((s, i) => (
            <g key={s.key}>
              {single && <motion.path d={paths[i].area} fill={SERIES[i]} fillOpacity="0.1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />}
              <motion.path
                d={paths[i].line}
                fill="none"
                stroke={SERIES[i]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.1 }}
              />
              {labelsFit && (
                <text x={x(s.values.length - 1) + 8} y={endYs[i] + 4} className="end-label">{s.name}</text>
              )}
            </g>
          ))}
          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--axis)" strokeWidth="1" />
              {series.map((s, i) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={SERIES[i]} stroke="var(--chart-surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
      )}
      {hover != null && width > 0 && (
        <div
          className="viz-tip"
          role="status"
          style={{
            top: (series.length > 1 ? 30 : 0) + 8,
            left: Math.min(Math.max(x(hover) + 12, 0), width - 160),
          }}
        >
          <div className="tip-head">{labels[hover]}</div>
          {series.map((s, i) => (
            <div key={s.key} className="tip-row">
              <i className="key-line" style={{ background: SERIES[i] }} />
              <strong>{format(s.values[hover])}</strong>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Horizontal bar list ----------
/**
 * One measure across categories: a single hue, value at the bar tip.
 * @param {{items:{key:string,label?:string,value:number,extra?:string}[], format?:(n:number)=>string, color?:string}} p
 */
export function BarList({ items, format = fmtNum, color = 'var(--series-1)', colors }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="muted small">No data for this period.</p>;
  return (
    <div className="barlist" role="list">
      {items.map((it, i) => (
        <div key={it.key} className="barlist-row" role="listitem" tabIndex={0} style={{ '--reserve': items.some((x) => x.extra) ? '132px' : '84px' }} title={`${it.label || it.key}: ${format(it.value)}${it.extra || it.note ? ` · ${it.extra || it.note}` : ''}`}>
          <span className="barlist-label">{it.label || it.key}</span>
          <div className="barlist-track">
            <motion.div
              className="barlist-bar"
              style={{ background: colors?.[i] || color }}
              initial={{ width: '0%' }}
              animate={{ width: `${(it.value / max) * 100}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
            />
            <motion.span className="barlist-value" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}>
              {format(it.value)} {it.extra && <span className="barlist-extra">{it.extra}</span>}
            </motion.span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Funnel (ordinal ramp) ----------
const RAMP = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)', 'var(--ramp-5)'];
export function Funnel({ stages }) {
  const first = stages[0]?.count || 0;
  return (
    <BarList
      items={stages.map((s, i) => ({
        key: s.stage,
        value: s.count,
        extra: i === 0 || !first ? '' : `${Math.round((s.count / first) * 100)}%`,
      }))}
      colors={stages.map((_, i) => RAMP[Math.min(i, RAMP.length - 1)])}
    />
  );
}

// ---------- Part-to-whole segmented bar ----------
/**
 * @param {{parts:{key:string,label?:string,value:number,color:string,display?:string}[]}} p
 */
export function SegmentedBar({ parts }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.label || p.key} ${p.value}`).join(', ')}>
        {total === 0 ? (
          <div style={{ flex: 1, background: 'var(--grid)' }} />
        ) : (
          shown.map((p, i) => (
            <motion.div
              key={p.key}
              title={`${p.label || p.key}: ${p.display || p.value}`}
              style={{ background: p.color }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: p.value }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            />
          ))
        )}
      </div>
      <div className="seglegend">
        {parts.map((p) => (
          <div key={p.key} className="item">
            <span className="row" style={{ gap: 6, textTransform: 'capitalize' }}><i className="key-box" style={{ background: p.color }} /> {p.label || p.key}</span>
            <strong>{p.display ?? p.value}</strong>
            <span className="muted">{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Meter ----------
export function Meter({ value, label }) {
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}
