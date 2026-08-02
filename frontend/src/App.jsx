import React, { useEffect, useState } from 'react';
import {
  Plus, ChevronLeft, ArrowLeft, Flame, X, Check, Trash2, CloudSun,
  BookOpen, Droplet, Dumbbell, Moon, Sun, Coffee, Music2, Paintbrush,
  Bike, Heart, Star, PenLine, UtensilsCrossed, Leaf, Dog, Phone,
  Wallet, Plane, Clock, Smile,
} from 'lucide-react';
import { fetchTasks, createTask, deleteTask as apiDeleteTask, fetchCheckins, toggleCheckin } from './api';

/* ---------- Color palette: each task gets its own theme color, keyed by color_key ---------- */
const PALETTE_BY_KEY = {
  coral: { base: '#FF6B5B', soft: '#FFE3DE', deep: '#D9503F', name: 'Coral' },
  mint: { base: '#2EC4B6', soft: '#D8F5F2', deep: '#1F9A8E', name: 'Mint' },
  marigold: { base: '#FFB627', soft: '#FFF0D1', deep: '#E0980A', name: 'Marigold' },
  plum: { base: '#9C6ADE', soft: '#EEE1FB', deep: '#7B47C4', name: 'Plum' },
  blossom: { base: '#FF8FA3', soft: '#FFE4EA', deep: '#E85D78', name: 'Blossom' },
};
const COLOR_KEYS = Object.keys(PALETTE_BY_KEY);

/* 20 icons a user can pick from when creating a task, keyed by lucide-react name */
const ICON_MAP = {
  BookOpen, Droplet, Dumbbell, Moon, Sun, Coffee, Music2, Paintbrush,
  Bike, Heart, Star, PenLine, UtensilsCrossed, Leaf, Dog, Phone,
  Wallet, Plane, Clock, Smile,
};
const ICON_NAMES = Object.keys(ICON_MAP);

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // Date.getDay() order
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const TODAY_Y = TODAY.getFullYear();
const TODAY_M = TODAY.getMonth();
const TODAY_D = TODAY.getDate();
const TODAY_LABEL = `${WEEKDAY_SHORT[TODAY.getDay()]}, ${MONTH_NAMES[TODAY_M]} ${TODAY_D} ${TODAY_Y}`;

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMon0(y, m) { const d = new Date(y, m, 1).getDay(); return (d + 6) % 7; }
function key(y, m, d) { return `${y}-${m}-${d}`; }
function isoToKey(iso) { const [y, m, d] = iso.split('-').map(Number); return key(y, m - 1, d); }

function currentStreak(checkins) {
  let count = 0;
  let cursor = new Date(TODAY);
  while (checkins.has(key(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function countMonth(checkins, year, month) {
  let c = 0;
  checkins.forEach(k => { if (k.startsWith(`${year}-${month}-`)) c++; });
  return c;
}

function totalCheckins(checkins, year) {
  let c = 0;
  checkins.forEach(k => { if (k.startsWith(String(year) + '-')) c++; });
  return c;
}

/** Compose an API task record + its known checkins into the shape the view components expect. */
function toViewTask(t, checkins) {
  return {
    id: t.id,
    name: t.name,
    icon: t.icon,
    color: PALETTE_BY_KEY[t.color_key] || PALETTE_BY_KEY[COLOR_KEYS[0]],
    checkins: checkins || new Set(),
  };
}

export default function TaskTrackerApp() {
  const [tasks, setTasks] = useState([]);
  const [checkinsByTask, setCheckinsByTask] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState('list');
  const [activeId, setActiveId] = useState(null);
  const [calMode, setCalMode] = useState('month');
  const [viewYear, setViewYear] = useState(TODAY_Y);
  const [viewMonth, setViewMonth] = useState(TODAY_M);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(ICON_NAMES[0]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const activeTaskRaw = tasks.find(t => t.id === activeId);
  const activeTask = activeTaskRaw ? toViewTask(activeTaskRaw, checkinsByTask[activeTaskRaw.id]) : null;
  const deleteTaskRaw = tasks.find(t => t.id === deleteTarget);

  function mergeCheckins(taskId, dates) {
    setCheckinsByTask(prev => {
      const next = new Set(prev[taskId] || []);
      dates.forEach(d => next.add(isoToKey(d)));
      return { ...prev, [taskId]: next };
    });
  }

  // Initial load: tasks + this month's checkins (powers the list page).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchTasks(TODAY_Y, TODAY_M);
        if (cancelled) return;
        setTasks(data.map(t => ({ id: t.id, name: t.name, icon: t.icon, color_key: t.color_key })));
        const merged = {};
        data.forEach(t => { merged[t.id] = new Set(t.checkins.map(isoToKey)); });
        setCheckinsByTask(merged);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load checkins for whatever scope the detail calendar is currently showing.
  useEffect(() => {
    if (view !== 'detail' || activeId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const month0 = calMode === 'month' ? viewMonth : null;
        const data = await fetchCheckins(activeId, viewYear, month0);
        if (!cancelled) mergeCheckins(activeId, data.dates);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [view, activeId, calMode, viewYear, viewMonth]);

  async function toggleDay(taskId, y, m, d) {
    const date = new Date(y, m, d);
    if (date > TODAY) return;
    try {
      const result = await toggleCheckin(taskId, y, m, d);
      setCheckinsByTask(prev => {
        const next = new Set(prev[taskId] || []);
        const k = key(y, m, d);
        if (result.checked) next.add(k); else next.delete(k);
        return { ...prev, [taskId]: next };
      });
    } catch (e) {
      setError(e.message);
    }
  }

  function openTask(id) {
    setActiveId(id);
    setCalMode('month');
    setViewYear(TODAY_Y);
    setViewMonth(TODAY_M);
    setView('detail');
  }

  async function addTask() {
    if (!newName.trim() || saving) return;
    const colorKey = COLOR_KEYS[tasks.length % COLOR_KEYS.length];
    setSaving(true);
    try {
      const created = await createTask({ name: newName.trim(), icon: newIcon, colorKey });
      setTasks(prev => [...prev, { id: created.id, name: created.name, icon: created.icon, color_key: created.color_key }]);
      setCheckinsByTask(prev => ({ ...prev, [created.id]: new Set() }));
      setNewName('');
      setNewIcon(ICON_NAMES[0]);
      setShowAdd(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const id = deleteTarget;
    try {
      await apiDeleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      setCheckinsByTask(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (activeId === id) setView('list');
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  const viewTasks = tasks.map(t => toViewTask(t, checkinsByTask[t.id]));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #FFF6ED 0%, #FFEFE0 100%)',
      fontFamily: "'Nunito', system-ui, sans-serif",
      display: 'flex',
      justifyContent: 'center',
      padding: '24px 12px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap');
        .heading { font-family: 'Baloo 2', system-ui, sans-serif; }
        .day-cell { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .day-cell:active { transform: scale(0.9); }
      `}</style>

      <div style={{ width: '100%', maxWidth: 420, background: '#FFFDFA', borderRadius: 32, boxShadow: '0 20px 50px -20px rgba(120,80,40,0.35)', overflow: 'hidden', minHeight: 780, position: 'relative' }}>
        {error && (
          <div style={{ background: '#FFE3DE', color: '#D9503F', fontSize: 13, fontWeight: 700, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D9503F' }}><X size={16} /></button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40% 20px', textAlign: 'center', color: '#B0A69B', fontWeight: 700 }}>Loading tasks…</div>
        ) : view === 'list'
          ? <ListView
              tasks={viewTasks}
              onOpen={openTask}
              onToggleDay={toggleDay}
              onAddClick={() => setShowAdd(true)}
              onDeleteRequest={setDeleteTarget}
            />
          : <DetailView
              task={activeTask}
              calMode={calMode} setCalMode={setCalMode}
              viewYear={viewYear} setViewYear={setViewYear}
              viewMonth={viewMonth} setViewMonth={setViewMonth}
              onBack={() => setView('list')}
              onToggleDay={(y, m, d) => toggleDay(activeTask.id, y, m, d)}
              onDeleteRequest={() => setDeleteTarget(activeTask.id)}
            />
        }
      </div>

      {showAdd && (() => {
        const previewColor = PALETTE_BY_KEY[COLOR_KEYS[tasks.length % COLOR_KEYS.length]];
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(61,50,41,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#FFFDFA', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span className="heading" style={{ fontSize: 20, fontWeight: 700, color: '#3D3229' }}>New Task</span>
                <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0A69B' }}><X size={22} /></button>
              </div>

              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="e.g. Sleep early"
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 14, border: '2px solid #FFE3DE', outline: 'none', fontSize: 16, fontFamily: 'inherit', color: '#3D3229' }}
              />

              <div style={{ fontSize: 13, fontWeight: 700, color: '#8C8074', margin: '18px 0 10px' }}>Choose an icon</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {ICON_NAMES.map((iconName) => {
                  const IconOpt = ICON_MAP[iconName];
                  const selected = newIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      onClick={() => setNewIcon(iconName)}
                      style={{
                        width: '100%', aspectRatio: '1 / 1', borderRadius: 12, border: 'none', cursor: 'pointer',
                        background: selected ? previewColor.soft : '#F3ECE4',
                        boxShadow: selected ? `inset 0 0 0 2px ${previewColor.base}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <IconOpt size={18} color={selected ? previewColor.deep : '#B0A69B'} />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={addTask}
                disabled={saving}
                style={{ width: '100%', marginTop: 20, padding: '12px 0', borderRadius: 14, border: 'none', background: previewColor.base, color: 'white', fontWeight: 700, fontSize: 16, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        );
      })()}

      {deleteTaskRaw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(61,50,41,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFDFA', borderRadius: 24, padding: 24, width: '100%', maxWidth: 320 }}>
            <div className="heading" style={{ fontSize: 18, fontWeight: 700, color: '#3D3229', marginBottom: 8 }}>Delete task?</div>
            <div style={{ fontSize: 14, color: '#8C8074', marginBottom: 20, lineHeight: 1.5 }}>
              Delete &ldquo;{deleteTaskRaw.name}&rdquo;? This can&apos;t be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: '#F3ECE4', color: '#3D3229', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: '10px 0', borderRadius: 14, border: 'none', background: '#E14F3D', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Task list page ---------------- */
function ListView({ tasks, onOpen, onToggleDay, onAddClick, onDeleteRequest }) {
  return (
    <div style={{ padding: '24px 20px 100px' }}>
      <div style={{ background: '#FFFDFA', borderRadius: 20, padding: '16px 18px', marginBottom: 18, boxShadow: '0 2px 10px rgba(120,80,40,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="heading" style={{ fontSize: 21, fontWeight: 800, color: '#3D3229' }}>Good day!</span>
          <CloudSun size={20} color="#FFB627" strokeWidth={2.2} />
        </div>
        <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14, color: '#B0A69B' }}>{TODAY_LABEL}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 2px', marginBottom: 10 }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#C9BEB2' }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {tasks.map(t => {
          const Icon = ICON_MAP[t.icon] || BookOpen;
          const doneToday = t.checkins.has(key(TODAY_Y, TODAY_M, TODAY_D));
          const streak = currentStreak(t.checkins);
          const monthCount = countMonth(t.checkins, TODAY_Y, TODAY_M);
          return (
            <div key={t.id} style={{ background: t.color.soft, borderRadius: 22, padding: '14px 14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  onClick={() => onToggleDay(t.id, TODAY_Y, TODAY_M, TODAY_D)}
                  style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer',
                    background: doneToday ? t.color.base : '#FFFFFF',
                    boxShadow: doneToday ? 'none' : `inset 0 0 0 2px ${t.color.base}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {doneToday ? <Check size={19} color="white" strokeWidth={3} /> : <Icon size={17} color={t.color.deep} />}
                </button>

                <div onClick={() => onOpen(t.id)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#3D3229' }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: t.color.deep, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {streak > 0 && (<><Flame size={12} /> {streak}-day streak &nbsp;&middot;&nbsp; </>)}
                    This month: {monthCount}d
                  </div>
                </div>

                <button
                  onClick={() => onDeleteRequest(t.id)}
                  aria-label="Delete task"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#C9BEB2', flexShrink: 0 }}
                >
                  <Trash2 size={16} />
                </button>

                <button
                  onClick={() => onOpen(t.id)}
                  aria-label="Open task"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.color.deep, fontSize: 20, fontWeight: 800, padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}
                >
                  &#8594;
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <MonthGrid
                  task={t}
                  year={TODAY_Y}
                  month={TODAY_M}
                  onToggleDay={(y, m, d) => onToggleDay(t.id, y, m, d)}
                  showWeekdayHeader={false}
                  dense
                />
              </div>
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div style={{ textAlign: 'center', color: '#B0A69B', fontWeight: 700, padding: '40px 0' }}>
          No tasks yet — add your first one below.
        </div>
      )}

      <button
        onClick={onAddClick}
        style={{
          position: 'absolute', left: 20, right: 20, bottom: 28,
          padding: '14px 0', borderRadius: 18, border: '2px dashed #E4B9A0', background: 'transparent',
          color: '#C97B5C', fontWeight: 700, fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <Plus size={18} /> Add Task
      </button>
    </div>
  );
}

/* ---------------- Task detail / check-in calendar page ---------------- */
function DetailView({ task, calMode, setCalMode, viewYear, viewMonth, setViewMonth, onBack, onToggleDay, onDeleteRequest }) {
  const monthTotal = countMonth(task.checkins, viewYear, viewMonth);
  const yearTotal = totalCheckins(task.checkins, viewYear);

  function shiftMonth(delta) {
    let m = viewMonth + delta;
    if (m < 0) { m = 11; } else if (m > 11) { m = 0; }
    setViewMonth(m);
  }

  return (
    <div style={{ padding: '24px 20px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: task.color.soft, border: 'none', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color={task.color.deep} />
        </button>
        <div className="heading" style={{ fontSize: 19, fontWeight: 700, color: '#3D3229', flex: 1 }}>{task.name}</div>
        <button onClick={onDeleteRequest} aria-label="Delete task" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9BEB2', padding: 6 }}>
          <Trash2 size={18} />
        </button>
      </div>

      {/* Month / Year toggle */}
      <div style={{ display: 'flex', background: '#F3ECE4', borderRadius: 14, padding: 4, marginBottom: 20, width: 160 }}>
        {['month', 'year'].map(m => (
          <button
            key={m}
            onClick={() => setCalMode(m)}
            style={{
              flex: 1, border: 'none', borderRadius: 10, padding: '7px 0', cursor: 'pointer',
              background: calMode === m ? '#FFFDFA' : 'transparent',
              boxShadow: calMode === m ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
              fontWeight: 700, fontSize: 13, color: calMode === m ? '#3D3229' : '#B0A69B',
            }}
          >
            {m === 'month' ? 'Month' : 'Year'}
          </button>
        ))}
      </div>

      {calMode === 'month' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => shiftMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={18} color="#B0A69B" /></button>
              <span className="heading" style={{ fontSize: 22, fontWeight: 800, color: '#3D3229' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
              <button onClick={() => shiftMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', transform: 'rotate(180deg)' }}><ChevronLeft size={18} color="#B0A69B" /></button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: task.color.deep, fontWeight: 700, marginBottom: 16 }}>{monthTotal} days checked in</div>

          <MonthGrid task={task} year={viewYear} month={viewMonth} onToggleDay={onToggleDay} />
        </>
      ) : (
        <>
          <div className="heading" style={{ fontSize: 22, fontWeight: 800, color: '#3D3229', marginBottom: 6 }}>{viewYear}</div>
          <div style={{ fontSize: 13, color: task.color.deep, fontWeight: 700, marginBottom: 16 }}>{yearTotal} days checked in</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {MONTH_NAMES.map((label, m) => (
              <MiniMonth key={m} label={label} task={task} year={viewYear} month={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Full numbered month grid, reused in both the list glance and the detail page */
function MonthGrid({ task, year, month, onToggleDay, showWeekdayHeader = true, dense = false }) {
  const dim = daysInMonth(year, month);
  const lead = firstWeekdayMon0(year, month);
  const cells = [...Array(lead).fill(null), ...Array(dim).fill(0).map((_, i) => i + 1)];
  const gap = dense ? 5 : 6;
  const fontSize = dense ? 11 : 12;

  return (
    <div>
      {showWeekdayHeader && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap, marginBottom: 8 }}>
          {WEEKDAYS.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: 12, color: '#C9BEB2', fontWeight: 700 }}>{w}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const checked = task.checkins.has(key(year, month, d));
          const isToday = year === TODAY_Y && month === TODAY_M && d === TODAY_D;
          const isFuture = new Date(year, month, d) > TODAY;
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onToggleDay(year, month, d)}
              className="day-cell"
              style={{
                aspectRatio: '1 / 1', borderRadius: dense ? 8 : 10, border: isToday ? `2px solid ${task.color.deep}` : 'none',
                background: checked ? task.color.base : (isFuture ? '#F7F2EC' : '#F3ECE4'),
                color: checked ? 'white' : (isFuture ? '#D8CFC5' : '#8C8074'),
                fontSize, fontWeight: 700, cursor: isFuture ? 'default' : 'pointer',
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniMonth({ label, task, year, month }) {
  const dim = daysInMonth(year, month);
  const lead = firstWeekdayMon0(year, month);
  const cells = [...Array(lead).fill(null), ...Array(dim).fill(0).map((_, i) => i + 1)];
  const isCurrentMonth = year === TODAY_Y && month === TODAY_M;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: isCurrentMonth ? task.color.deep : '#B0A69B', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} style={{ aspectRatio: '1/1' }} />;
          const checked = d && task.checkins.has(key(year, month, d));
          return (
            <div key={i} style={{ aspectRatio: '1/1', borderRadius: 3, background: checked ? task.color.base : '#F3ECE4' }} />
          );
        })}
      </div>
    </div>
  );
}
