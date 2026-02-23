import { useState, useRef, useEffect, useCallback } from "react";
import { FcEditImage, 
         FcFolder, 
         FcLowPriority, 
         FcOk, FcPlus, 
         FcCancel, 
         FcSearch} 
from "react-icons/fc";

// ─── helpers ───

const dtToMins = (dt) => {
  if (!dt) return 0;
  const [datePart, timePart] = dt.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [h, m] = timePart.split(":").map(Number);
  const base = new Date(Date.UTC(2000, 0, 1));
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = Math.round((d - base) / 86400000);
  return dayIndex * 1440 + h * 60 + m;
};

const minsToDatetime = (totalMins) => {
  const base = new Date(Date.UTC(2000, 0, 1));
  const dayIndex = Math.floor(totalMins / 1440);
  const minOfDay = totalMins - dayIndex * 1440;
  const d = new Date(base.getTime() + dayIndex * 86400000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const mn = String(minOfDay % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${h}:${mn}`;
};

const minsToHHMM = (totalMins) => {
  const minOfDay = ((totalMins % 1440) + 1440) % 1440;
  const h = String(Math.floor(minOfDay / 60)).padStart(2, "0");
  const m = String(minOfDay % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const minutesToDecimal = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}.${String(Math.round((m / 60) * 100)).padStart(2, "0")}`;
};

const formatDisplay = (dt) => {
  if (!dt) return "";
  const [datePart, timePart] = dt.split("T");
  const [, month, day] = datePart.split("-");
  return `${day}.${month} ${timePart}`;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let nextId = 1;
const uid = () => nextId++;

const makeDefaultDrivers = () => [
  { key: "d0", name: "Sh1" },
  { key: "d1", name: "Sh2" },
];

const defaultTable = (drivers) => ({
  id: uid(),
  minDatetime: `${todayStr()}T04:00`,
  maxDatetime: `${tomorrowStr()}T01:00`,
  enabled: true,
  rows: drivers.map(d => ({ id: uid(), driverKey: d.key, events: [] })),
  history: [],
});

// ─── colors ────

const C = {
  border: "rgba(23,157,235,0.9)",
  borderDisabled: "#404060",
  barBorder: "#7070bb",
  barBorderDisabled: "#404055",
  panelBg: "rgba(12,12,36,0.85)",
  rowBg: "rgba(35,35,80,0.5)",
  rowBgDisabled: "rgba(18,18,40,0.4)",
  accent: "rgba(55,197,253,0.9)",
  accentDim: "rgba(23,157,235,0.9)",
  text: "#d0d0f0",
  textDim: "rgb(23, 157, 235)",
  textMuted: "#5555888",
  eventFill: "#8888ff",
  eventBorder: "#8888ff",
  durationBg: "rgba(20,20,60,0.9)",
  durationBorder: "#7070cc",
  histBg: "#18183a",
  histBorder: "rgba(55,197,253,0.9)",
  tickLine: "rgba(120,120,200,0.18)",
  dateBadgeBg: "rgba(50,50,110,0.95)",
  dateBadgeBorder: "#5555aa",
};

// ─── context menu ────

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: "fixed", top: y, left: x, background: "#16162e",
      border: `1px solid ${C.border}`, borderRadius: 7, zIndex: 9999,
      minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.55)", overflow: "hidden",
    }}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} style={{ borderTop: `1px solid ${C.histBorder}`, margin: "2px 0" }} />
        ) : (
          <div key={i}
            onClick={() => { item.action(); onClose(); }}
            style={{ padding: "8px 14px", cursor: "pointer", color: item.danger ? "#ff7070" : C.text, fontSize: 16, fontFamily: "monospace" }}
            onMouseEnter={e => e.currentTarget.style.background = "#252550"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >{item.label}</div>
        )
      )}
    </div>
  );
}

// ─── generic modal shell ────

function Modal({ children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#14142c", border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, minWidth: 300, boxShadow: "0 12px 48px rgba(0,0,0,0.65)" }}>
        {children}
      </div>
    </div>
  );
}

const btnStyle = (bg, color = C.text) => ({
  padding: "6px 18px", background: bg, border: "none", borderRadius: 6,
  color, cursor: "pointer", fontFamily: "monospace", fontSize: 16,
});

const inputStyle = {
  background: "#0d0d22", border: `1px solid ${C.accentDim}`, borderRadius: 6,
  color: C.text, padding: "3px 8px", fontFamily: "monospace", fontSize: 14,
};

const selectStyle = {
  background: "#0d0d22", border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.text, padding: "4px 8px", fontFamily: "monospace", fontSize: 15, flex: 1,
};

// ─── datetime dialog ───

function DatetimeDialog({ title, defaultValue, onConfirm, onCancel }) {
  const [val, setVal] = useState(defaultValue || `${todayStr()}T12:00`);
  return (
    <Modal>
      <div style={{ color: C.accent, fontFamily: "monospace", marginBottom: 16, fontSize: 14 }}>{title}</div>
      <input type="datetime-local" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: "100%", padding: "8px 12px", background: "#0d0d22", border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 16, fontFamily: "monospace", boxSizing: "border-box" }}
        autoFocus />
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnStyle("#2a2a3a")}>Cancel</button>
        <button onClick={() => onConfirm(val)} style={btnStyle("#2a3a8a")}>OK</button>
      </div>
    </Modal>
  );
}

// ─── transfer dialog ────

function TransferDialog({ durations, onConfirm, onCancel }) {
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(Math.min(1, durations.length - 1));
  const [amount, setAmount] = useState(30);
  const maxAmount = durations[from]?.minutes || 0;
  return (
    <Modal>
      <div style={{ color: C.accent, fontFamily: "monospace", marginBottom: 16, fontSize: 14 }}>Transfer time between durations</div>
      {[["From", from, setFrom], ["To", to, setTo]].map(([label, val, setter]) => (
        <div key={label} style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", color: C.text, fontFamily: "monospace", fontSize: 13 }}>
          <span style={{ width: 40 }}>{label}:</span>
          <select value={val} onChange={e => setter(+e.target.value)} style={selectStyle}>
            {durations.map((d, i) => <option key={i} value={i}>Dur {i + 1} ({minutesToDecimal(d.minutes)})</option>)}
          </select>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", color: C.text, fontFamily: "monospace", fontSize: 13 }}>
        <span style={{ width: 40 }}>Min:</span>
        <input type="number" value={amount} min={1} max={maxAmount} onChange={e => setAmount(e.target.value)} style={{ ...selectStyle, width: 80, flex: "none" }} />
        <span style={{ color: C.textDim }}>max {maxAmount}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnStyle("#2a2a3a")}>Cancel</button>
        <button onClick={() => from !== to && amount > 0 && amount <= maxAmount && onConfirm(from, to, -amount)} style={btnStyle("#2a3a8a")}>Apply</button>
      </div>
    </Modal>
  );
}

// ─── rename dialog ─────

function RenameDialog({ drivers, onConfirm, onCancel }) {
  const [names, setNames] = useState(drivers.map(d => d.name));
  return (
    <Modal>
      <div style={{ color: C.accent, fontFamily: "monospace", marginBottom: 16, fontSize: 14 }}>Rename Drivers</div>
      <div style={{ color: C.textDim, fontFamily: "monospace", fontSize: 13, marginBottom: 14 }}>
        Changes apply to all timelines
      </div>
      {drivers.map((d, i) => (
        <div key={d.key} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
          <span style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14, width: 60 }}>Driver {i + 1}:</span>
          <input
            value={names[i]}
            onChange={e => setNames(prev => prev.map((n, j) => j === i ? e.target.value : n))}
            style={{ ...inputStyle, flex: 1, padding: "6px 10px", fontSize: 15 }}
            autoFocus={i === 0}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnStyle("#2a2a3a")}>Cancel</button>
        <button onClick={() => onConfirm(names)} style={btnStyle("#2a5a3a")}>Save Names</button>
      </div>
    </Modal>
  );
}

// ─── single row ────

function TimelineRow({ row, driverName, minAbsMins, totalMins, enabled, onContextMenu, onEventContextMenu, onDragEnd, transferState, onDurClick }) {
  const barRef = useRef();

  const getAbsMinsAtX = (clientX) => {
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(minAbsMins + ratio * totalMins);
  };

  const handleBarContextMenu = (e) => {
    if (!enabled) return;
    e.preventDefault();
    onContextMenu(e.clientX, e.clientY, minsToDatetime(getAbsMinsAtX(e.clientX)), row.id);
  };

  const dragging = useRef(null);
  const handleEventMouseDown = (e, evId) => {
    if (!enabled) return;
    e.stopPropagation();
    if (e.button !== 0) return;
    dragging.current = { evId };
    const onMove = (me) => {
      if (!dragging.current) return;
      onDragEnd(row.id, evId, minsToDatetime(getAbsMinsAtX(me.clientX)), true);
    };
    const onUp = (me) => {
      if (!dragging.current) return;
      onDragEnd(row.id, evId, minsToDatetime(getAbsMinsAtX(me.clientX)), false);
      dragging.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const events = [...row.events].sort((a, b) => dtToMins(a.datetime) - dtToMins(b.datetime));
  const points = [
    { datetime: minsToDatetime(minAbsMins), isEdge: true },
    ...events,
    { datetime: minsToDatetime(minAbsMins + totalMins), isEdge: true },
  ];
  const durations = points.slice(0, -1).map((p, i) => dtToMins(points[i + 1].datetime) - dtToMins(p.datetime));
  const eventPos = (dt) => Math.max(0, Math.min(100, ((dtToMins(dt) - minAbsMins) / totalMins) * 100));

  const ROW_H = 36;

  return (
    <div style={{ position: "relative", marginBottom: 5 }}>
      {/* Bar */}
      <div
        ref={barRef}
        onContextMenu={handleBarContextMenu}
        style={{
          position: "relative", height: ROW_H,
          background: enabled ? C.rowBg : C.rowBgDisabled,
          border: `1px solid ${enabled ? C.barBorder : C.barBorderDisabled}`,
          borderRadius: 5, cursor: enabled ? "crosshair" : "not-allowed", userSelect: "none",
        }}
      >
        {/* Duration circles — clickable for transfer selection */}
        {durations.map((dur, i) => {
          const mid = (eventPos(points[i].datetime) + eventPos(points[i + 1].datetime)) / 2;
          const sel = transferState;
          const isFrom = sel?.step === "from" && sel.fromIdx === i && sel.rowId === row.id;
          const isTo   = sel?.step === "to"   && sel.toIdx   === i && sel.rowId === row.id;
          const isFromPending = sel?.step === "to" && sel.fromIdx === i && sel.rowId === row.id;
          const highlight = isFrom || isTo ? "#ffe066" : isFromPending ? "#88aaff" : "#c0c0ff";
          const ring = isFrom || isFromPending ? "2px solid #ffe066" : isTo ? "2px solid #44ff88" : "none";
          return (
            <div key={i}
              onClick={() => enabled && onDurClick && onDurClick(row.id, i, dur)}
              style={{
                position: "absolute", left: `${mid}%`, top: "50%", transform: "translate(-50%, -50%)",
                background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: highlight, fontFamily: "monospace",
                zIndex: 2, padding: "0 4px", whiteSpace: "nowrap",
                cursor: enabled ? "pointer" : "default",
                outline: ring, borderRadius: 4,
              }}>
              {minutesToDecimal(dur)}
            </div>
          );
        })}

        {/* Events */}
        {events.map((ev) => {
          const pos = eventPos(ev.datetime);
          const isLogout = ev.type === "logout";
          return (
            <div
              key={ev.id}
              onMouseDown={(e) => handleEventMouseDown(e, ev.id)}
              onContextMenu={(e) => { if (!enabled) return; e.preventDefault(); e.stopPropagation(); onEventContextMenu(e.clientX, e.clientY, row.id, ev.id); }}
              title={`${ev.type} ${formatDisplay(ev.datetime)}`}
              style={{
                position: "absolute", left: `${pos}%`, top: "50%", transform: "translate(-50%, -50%)",
                width: 14, height: 14, borderRadius: "50%",
                background: isLogout ? "transparent" : C.eventFill,
                border: isLogout ? `2.5px solid ${C.eventBorder}` : "none",
                cursor: enabled ? "grab" : "not-allowed", zIndex: 3,
                boxShadow: isLogout ? `0 0 6px ${C.eventBorder}88` : `0 0 8px ${C.eventFill}aa`,
              }}
            />
          );
        })}

        {/* Hour tick lines */}
        {Array.from({ length: Math.ceil(totalMins / 60) + 1 }).map((_, i) => {
          const pos = (i * 60 / totalMins) * 100;
          if (pos > 100) return null;
          return <div key={i} style={{ position: "absolute", left: `${pos}%`, top: 0, bottom: 0, borderLeft: `1px dashed ${C.tickLine}`, pointerEvents: "none" }} />;
        })}
      </div>
    </div>
  );
}

// ─── time axis ────

function TimeAxis({ minAbsMins, totalMins }) {
  const ticks = [];
  for (let i = 0; i * 60 <= totalMins; i++) {
    const absMins = minAbsMins + i * 60;
    const pos = (i * 60 / totalMins) * 100;
    const hhmm = minsToHHMM(absMins);
    const prevAbsMins = minAbsMins + (i - 1) * 60;
    const dayChanged = i === 0 || Math.floor(absMins / 1440) !== Math.floor(prevAbsMins / 1440);
    let dateLabel = null;
    if (dayChanged) {
      const dt = minsToDatetime(absMins);
      const [, month, day] = dt.split("T")[0].split("-");
      dateLabel = `${day}.${month}`;
    }
    ticks.push({ pos, hhmm, dateLabel });
  }

  const AXIS_HEIGHT = 52;
  return (
    <div style={{ position: "relative", height: AXIS_HEIGHT, marginBottom: 2 }}>
      {ticks.map((t, i) => (
        <div key={i} style={{
          position: "absolute", left: `${t.pos}%`, bottom: 0,
          transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
          height: AXIS_HEIGHT,
        }}>
          {t.dateLabel && (
            <div style={{
              fontSize: 10, color: "#b0b0ee", fontFamily: "monospace",
              background: C.dateBadgeBg, border: `1px solid ${C.dateBadgeBorder}`,
              borderRadius: 3, padding: "2px", marginLeft: "40px", marginBottom: 3, whiteSpace: "nowrap",
            }}>{t.dateLabel}</div>
          )}
          <div style={{ height: 36, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <span style={{
              display: "block", color: C.textDim, fontSize: 12, fontFamily: "monospace",
              whiteSpace: "nowrap", transformOrigin: "bottom center",
              transform: "rotate(-90deg) translateX(50%)", lineHeight: 1,
            }}>{t.hhmm}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── single table ────

function Table({ table, drivers, zoom, onUpdate, onDelete }) {
  const [ctx, setCtx] = useState(null);
  const [dialog, setDialog] = useState(null);
  // const [transferDlg, setTransferDlg] = useState(null);
  // transferState: null | { step:"from", rowId, fromIdx, fromDur }
  //                       | { step:"to",   rowId, fromIdx, fromDur, toIdx, toDur }
  //                       | { step:"amount", rowId, fromIdx, fromDur, toIdx, toDur }
  const [transferState, setTransferState] = useState(null);
  const [transferAmount, setTransferAmount] = useState("");

  const minAbsMins = dtToMins(table.minDatetime);
  const maxAbsMins = dtToMins(table.maxDatetime);
  const totalMins = Math.max(1, maxAbsMins - minAbsMins);

  const getDurations = (rowId) => {
    const row = table.rows.find(r => r.id === rowId);
    if (!row) return [];
    const events = [...row.events].sort((a, b) => dtToMins(a.datetime) - dtToMins(b.datetime));
    const points = [{ datetime: minsToDatetime(minAbsMins) }, ...events, { datetime: minsToDatetime(maxAbsMins) }];
    return points.slice(0, -1).map((p, i) => ({ minutes: dtToMins(points[i + 1].datetime) - dtToMins(p.datetime) }));
  };

  const addEvent = (rowId, datetime, type) => {
    const ev = { id: uid(), datetime, type };
    onUpdate({ ...table, rows: table.rows.map(r => r.id === rowId ? { ...r, events: [...r.events, ev] } : r) });
  };

  const deleteEvent = (rowId, evId) =>
    onUpdate({ ...table, rows: table.rows.map(r => r.id === rowId ? { ...r, events: r.events.filter(e => e.id !== evId) } : r) });

  const moveEvent = (rowId, evId, newDatetime) =>
    onUpdate({ ...table, rows: table.rows.map(r => r.id === rowId ? { ...r, events: r.events.map(e => e.id === evId ? { ...e, datetime: newDatetime } : e) } : r) });

  const handleContextMenu = (x, y, defaultDatetime, rowId) => {
    const label = formatDisplay(defaultDatetime);
    setCtx({
      x, y, items: [
        { label: `Login at ${label}`,  action: () => setDialog({ rowId, defaultDatetime, type: "login" }) },
        { label: `Logout at ${label}`, action: () => setDialog({ rowId, defaultDatetime, type: "logout" }) },
      ]
    });
  };

  const handleEventContextMenu = (x, y, rowId, evId) =>
    setCtx({ x, y, items: [{ label: "Delete event", danger: true, action: () => deleteEvent(rowId, evId) }] });

  const handleDurClick = (rowId, durIdx, durMins) => {
    setTransferState(prev => {
      if (!prev || prev.step === "from") {
        return { step: "to", rowId, fromIdx: durIdx, fromDur: durMins };
      }
      if (prev.step === "to" && prev.rowId === rowId) {
        if (durIdx === prev.fromIdx) {
          return null;
        }
        return { step: "amount", rowId, fromIdx: prev.fromIdx, fromDur: prev.fromDur, toIdx: durIdx, toDur: durMins };
      }
      return { step: "to", rowId, fromIdx: durIdx, fromDur: durMins };
    });
    setTransferAmount("");
  };

  const applyTransfer = (rowId, fromIdx, fromDur, toIdx, toDur, minutes) => {
    const row = table.rows.find(r => r.id === rowId);
    if (!row) return;
    const events = [...row.events].sort((a, b) => dtToMins(a.datetime) - dtToMins(b.datetime));
    const direction = toIdx > fromIdx ? 1 : -1;
    const lo = Math.min(fromIdx, toIdx);
    const hi = Math.max(fromIdx, toIdx);
    const newEvents = events.map((ev, i) =>
      i >= lo && i < hi
        ? { ...ev, datetime: minsToDatetime(dtToMins(ev.datetime) + direction * minutes) }
        : ev
    );
    const histEntry = {
      id: uid(),
      driverKey: row.driverKey,          
      fromIdx, fromDur,                 
      toIdx, toDur,
      minutes,
      timestamp: new Date().toLocaleTimeString(),
    };
    onUpdate({
      ...table,
      rows: table.rows.map(r => r.id === rowId ? { ...r, events: newEvents } : r),
      history: [...(table.history || []), histEntry],
    });
    setTransferState(null);
    setTransferAmount("");
  };

  return (
    <div style={{
      background: C.panelBg,
      border: `1.5px solid ${table.enabled ? C.border : C.borderDisabled}`,
      borderRadius: 10, padding: "16px", marginBottom: 22,
      boxShadow: `0 4px 28px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(120,120,200,0.06)`,
      opacity: table.enabled ? 1 : 0.65, position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14 }}>Timeline</span>
        <label style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14 }}>From:</label>
        <input type="datetime-local" value={table.minDatetime}
          onChange={e => onUpdate({ ...table, minDatetime: e.target.value })} style={inputStyle} />
        <label style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14 }}>To:</label>
        <input type="datetime-local" value={table.maxDatetime}
          onChange={e => onUpdate({ ...table, maxDatetime: e.target.value })} style={inputStyle} />
        <button disabled={true} 
          onClick={() => onUpdate({ ...table, enabled: !table.enabled })}
          style={btnStyle(table.enabled ? "#1c3a1c" : "#3a1c1c")}>
          {table.enabled ? <FcOk /> : <FcCancel />} {table.enabled ? "Enabled" : "Disabled"}
        </button>
        <button disabled={!table.enabled}
          onClick={onDelete} style={{ ...btnStyle("#3a1c1c"), marginLeft: "auto" }}><FcCancel /> Remove</button>
      </div>

      {/* Two-column layout: fixed driver labels | scrollable timeline */}
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Fixed left column */}
        <div style={{ flexShrink: 0, width: 56, marginRight: 8 }}>
          <div style={{ height: 54 }} />
          {table.rows.map(row => {
            const driver = drivers.find(d => d.key === row.driverKey) || { name: row.driverKey };
            return (
              <div key={row.id} style={{
                height: 36, marginBottom: 5,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                paddingRight: 8,
                color: C.accent, fontFamily: "monospace", fontSize: 14, fontWeight: "bold",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {driver.name}
              </div>
            );
          })}
        </div>

        {/* Scrollable + zoomable right column */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "visible" }}>
          <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
            <TimeAxis minAbsMins={minAbsMins} totalMins={totalMins} />
            {table.rows.map(row => {
              const driver = drivers.find(d => d.key === row.driverKey) || { name: row.driverKey };
              return (
                <TimelineRow
                  key={row.id}
                  row={row}
                  driverName={driver.name}
                  minAbsMins={minAbsMins}
                  totalMins={totalMins}
                  enabled={table.enabled}
                  transferState={transferState}
                  onDurClick={handleDurClick}
                  onContextMenu={handleContextMenu}
                  onEventContextMenu={handleEventContextMenu}
                  onDragEnd={moveEvent}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Inline transfer UI — shown below rows when 2 durations selected */}
      {transferState?.step === "amount" && (() => {
        const maxAmt = transferState.fromDur;
        return (
          <div style={{
            marginTop: 10, display: "flex", alignItems: "center", gap: 10,
            background: "rgba(20,20,60,0.8)", border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "8px 14px", flexWrap: "wrap",
          }}>
            <span style={{ color: "#ffe066", fontFamily: "monospace", fontSize: 13 }}>
              Dur {transferState.fromIdx + 1} ({minutesToDecimal(transferState.fromDur)})
            </span>
            <span style={{ color: C.accentDim }}>→</span>
            <span style={{ color: "#44ff88", fontFamily: "monospace", fontSize: 13 }}>
              Dur {transferState.toIdx + 1} ({minutesToDecimal(transferState.toDur)})
            </span>
            <input
              type="number" min={1} max={maxAmt}
              placeholder={`minutes (max ${maxAmt})`}
              value={transferAmount}
              onChange={e => setTransferAmount(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const amt = parseInt(transferAmount);
                  if (amt > 0 && amt <= maxAmt)
                    applyTransfer(transferState.rowId, transferState.fromIdx, transferState.fromDur,
                                  transferState.toIdx, transferState.toDur, amt);
                }
                if (e.key === "Escape") { setTransferState(null); setTransferAmount(""); }
              }}
              autoFocus
              style={{ ...inputStyle, width: 160, fontSize: 13 }}
            />
            <button
              onClick={() => {
                const amt = parseInt(transferAmount);
                if (amt > 0 && amt <= maxAmt)
                  applyTransfer(transferState.rowId, transferState.fromIdx, transferState.fromDur,
                                transferState.toIdx, transferState.toDur, amt);
              }}
              style={btnStyle("#2a3a8a", C.text)}>Apply</button>
            <button onClick={() => { setTransferState(null); setTransferAmount(""); }}
              style={btnStyle("#3a1c1c", C.text)}>✕</button>
            <span style={{ color: C.textDim, fontSize: 12 }}>
              {transferState.step === "amount" ? "" : "Click a duration on the same row"}
            </span>
          </div>
        );
      })()}

      {/* Transfer hint — when FROM is selected, waiting for TO */}
      {transferState?.step === "to" && (
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 8,
          background: "rgba(20,20,60,0.6)", border: `1px dashed ${C.accentDim}`,
          borderRadius: 8, padding: "6px 14px",
        }}>
          <span style={{ color: "#88aaff", fontFamily: "monospace", fontSize: 13 }}>
            From: Dur {transferState.fromIdx + 1} ({minutesToDecimal(transferState.fromDur)})
          </span>
          <span style={{ color: C.textDim, fontSize: 12 }}>— now click the destination duration</span>
          <button onClick={() => setTransferState(null)}
            style={{ ...btnStyle("#3a1c1c", C.text), padding: "2px 8px", fontSize: 12, marginLeft: "auto" }}>✕ Cancel</button>
        </div>
      )}

      {/* History */}
      {table.history?.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.histBorder}`, paddingTop: 10 }}>
          <div style={{ color: C.textDim, fontFamily: "monospace", fontSize: 14, marginBottom: 6 }}>Transfer History:</div>
          {table.history.map(h => {
            const driverName = h.driverKey
              ? (drivers.find(d => d.key === h.driverKey)?.name || h.driverKey)
              : (() => {
                  const rowIdx = table.rows.findIndex(r => r.id === h.rowId);
                  return rowIdx >= 0 ? (drivers.find(d => d.key === table.rows[rowIdx].driverKey)?.name || "?") : "?";
                })();
            return (
              <div key={h.id} style={{ marginBottom: 4 }}>
                <div style={{
                  background: C.histBg, border: `1px solid ${C.histBorder}`, borderRadius: 4,
                  padding: "3px 10px", fontFamily: "monospace", fontSize: 13, color: "#9090cc",
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}>
                  <span style={{ color: C.textDim }}>{h.timestamp}</span>
                  <span>Dur {h.fromIdx + 1}</span>
                  {h.fromDur != null && <span style={{ color: C.textDim }}>({minutesToDecimal(h.fromDur)})</span>}
                  <span style={{ color: C.accentDim }}>→</span>
                  <span>Dur {h.toIdx + 1}</span>
                  {h.toDur != null && <span style={{ color: C.textDim }}>({minutesToDecimal(h.toDur)})</span>}
                  <span style={{ color: C.accent }}>{h.minutes}min</span>
                  <span style={{ color: C.accentDim }}>|</span>
                  <span style={{ color: C.accent }}>{driverName}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
      {dialog && (
        <DatetimeDialog
          title={`${dialog.type === "login" ? "Login" : "Logout"} — date & time`}
          defaultValue={dialog.defaultDatetime}
          onConfirm={(dt) => { addEvent(dialog.rowId, dt, dialog.type); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {/* {transferDlg && (
        <TransferDialog
          durations={getDurations(transferDlg.rowId)}
          onConfirm={(from, to, mins) => applyTransfer(transferDlg.rowId, from, to, mins)}
          onCancel={() => setTransferDlg(null)}
        />
      )} */}
    </div>
  );
}

// ─── app ───

export default function App() {
  const [drivers, setDrivers] = useState(makeDefaultDrivers());
  const [tables, setTables] = useState(() => [defaultTable(makeDefaultDrivers())]);
  const [showRename, setShowRename] = useState(false);
  const fileInputRef = useRef();

  const [zoom, setZoom] = useState(1);

  const handleGlobalWheel = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(prev => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      return Math.min(8, Math.max(1, prev * factor));
    });
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleGlobalWheel);
  }, [handleGlobalWheel]);

  const addTable = () => setTables(prev => {
    const base = defaultTable(drivers);
    if (prev.length > 0) {
      const last = prev[prev.length - 1];
      base.minDatetime = last.minDatetime;
      base.maxDatetime = last.maxDatetime;
      base.rows = base.rows.map((row, i) => ({
        ...row,
        events: last.rows[i] ? last.rows[i].events.map(ev => ({ ...ev, id: uid() })) : [],
      }));
    }
    
    return [...prev.map(t => ({ ...t, enabled: false })), { ...base, enabled: true }];
  });

  const removeTable = (id) => {
    setTables(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (filtered.length === 0) return [];
      return filtered.map((t, index) => ({
        ...t,
        enabled: index === filtered.length - 1
      }));
    });
  };
  
  const updateTable = (updated) => setTables(prev => prev.map(t => t.id === updated.id ? updated : t));

  const renameDrivers = (newNames) => {
    setDrivers(prev => prev.map((d, i) => ({ ...d, name: newNames[i] ?? d.name })));
    setShowRename(false);
  };

  // ── Save ──
  const handleSave = () => {
    const payload = { version: 1, drivers, tables };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
    a.download = `driver-timeline-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Open ──
  const handleOpen = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.drivers || !data.tables) throw new Error("Invalid file format");
        // Re-assign fresh IDs to avoid collisions
        const driverMap = {};
        const newDrivers = data.drivers.map(d => {
          const newKey = `d${uid()}`;
          driverMap[d.key] = newKey;
          return { key: newKey, name: d.name };
        });
        const newTables = data.tables.map(t => ({
          ...t,
          id: uid(),
          rows: t.rows.map(r => ({
            ...r,
            id: uid(),
            driverKey: driverMap[r.driverKey] ?? r.driverKey,
            events: (r.events || []).map(ev => ({ ...ev, id: uid() })),
          })),
          history: (t.history || []).map(h => ({ ...h, id: uid() })),
        }));
        setDrivers(newDrivers);
        setTables(newTables);
      } catch (err) {
        alert("Failed to open file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100vw",
      background: "linear-gradient(135deg,rgb(24,40,109) 10%,rgb(50,86,119) 50%,rgb(5,34,97) 100%)",
      padding: "0 24px 48px", fontFamily: "monospace", fontSize: 18, color: C.text, boxSizing: "border-box",
    }}>
      <div style={{ margin: "0 auto" }}>
        {/* Sticky Top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "linear-gradient(135deg,rgb(24,40,109) 10%,rgb(50,86,119) 50%,rgb(5,34,97) 100%)",
          padding: "16px 0 12px",
          borderBottom: `1px solid ${C.histBorder}`,
          marginBottom: 20,
        }}>
          <div>
            <h1 style={{ margin: 0, color: C.accent, fontSize: 22, letterSpacing: 2, fontWeight: 700 }}>DRIVERS TIMELINE</h1>
            <div style={{ color: C.accentDim, fontSize: 14, marginTop: 2 }}>
              Right-click row to add events · Drag events · Right-click event to delete
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 10, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleOpen} style={{
                padding: "7px 16px", background: "rgba(30,50,30,0.7)", border: "1px solid rgb(82, 243, 82)",
                borderRadius: 7, color: "#88dd88", cursor: "pointer", fontFamily: "monospace", fontSize: 16, alignSelf: "left",
              }}><FcFolder /> Open</button>

              <button onClick={handleSave} style={{
                padding: "7px 16px", background: "rgba(30,40,70,0.7)", border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.accent, cursor: "pointer", fontFamily: "monospace", fontSize: 16, alignSelf: "left",
              }}><FcLowPriority /> Save</button>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Driver names display + rename */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(43, 43, 170, 0.4)", border: `1px solid ${C.histBorder}`,
                borderRadius: 7, padding: "4px 10px", alignSelf: "right",
              }}>
                {drivers.map((d, i) => (
                  <span key={d.key} style={{ color: C.accent, fontFamily: "monospace", fontSize: 13, fontWeight: "bold" }}>
                    {d.name}{i < drivers.length - 1 ? <span style={{ color: C.accentDim, margin: "0 4px" }}>·</span> : null}
                  </span>
                ))}
                <button onClick={() => setShowRename(true)} style={{
                  marginLeft: 6, padding: "2px 9px", background: "rgba(50,50,110,0.6)",
                  border: `1px solid ${C.accentDim}`, borderRadius: 5, color: C.textDim,
                  cursor: "pointer", fontFamily: "monospace", fontSize: 14,
                }}><FcEditImage /> Rename</button>
              </div>

              <button onClick={addTable} style={{
                padding: "7px 16px", background: "rgba(40,40,120,0.6)", border: `1px solid ${C.border}`,
                borderRadius: 7, color: C.accent, cursor: "pointer", fontFamily: "monospace", fontSize: 16,
                alignSelf: "right",
              }}><FcPlus /> New Timeline</button>

              {/* Zoom indicator */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(40,40,100,0.5)", border: `1px solid ${C.histBorder}`,
                borderRadius: 7, padding: "4px 12px", fontFamily: "monospace",
                fontSize: 13, color: C.textDim, userSelect: "none", alignSelf: "right",
              }}>
                <FcSearch /> {Math.round(zoom * 100)}%
                <button onClick={() => setZoom(1)} style={{
                  marginLeft: 4, padding: "1px 7px", background: "rgba(60,60,120,0.5)",
                  border: `1px solid ${C.accentDim}`, borderRadius: 4, color: C.textDim,
                  cursor: "pointer", fontFamily: "monospace", fontSize: 11,
                }}>reset</button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: "none" }} />

        {/* Tables (stack: newest first) */}
        {[...tables]
          // .reverse()
          .map(
           table => (
            <Table
              key={table.id}
              table={table}
              drivers={drivers}
              zoom={zoom}
              onUpdate={updateTable}
              onDelete={() => removeTable(table.id)}
            />
        ))}

        {tables.length === 0 && (
          <div style={{ textAlign: "center", color: C.accentDim, marginTop: 80, fontSize: 17 }}>
            No timelines. Click "+ New Timeline" to start.
          </div>
        )}
      </div>

      {showRename && (
        <RenameDialog
          drivers={drivers}
          onConfirm={renameDrivers}
          onCancel={() => setShowRename(false)}
        />
      )}
    </div>
  );
}