import React from 'react';

const navItems = [
  ['Home', '⌂'],
  ['Library', '▤'],
  ['Practice', '◎'],
  ['Conversations', '◌'],
  ['Learn', '◫'],
  ['Progress', '↗'],
  ['Community', '♢'],
  ['Settings', '⚙'],
];

export function Sidebar({ activePage, onNavigate }) {
  return (
    <aside
      aria-label="Signova app navigation"
      className="hidden h-full min-h-0 w-[clamp(4.75rem,7vw,16rem)] shrink-0 border-r border-slate-200/80 bg-white/80 p-3 shadow-soft backdrop-blur-xl lg:flex lg:flex-col"
    >
      <button
        type="button"
        onClick={() => onNavigate('Home')}
        className="mb-5 flex min-h-14 items-center gap-3 rounded-3xl px-2 text-left text-slate-950 transition hover:bg-cyan-50 xl:px-3"
        aria-label="Go to Signova home"
      >
        <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-blue-600 text-lg font-black text-white shadow-soft">S</span>
        <span className="hidden min-w-0 xl:block">
          <b className="block text-xl leading-none">Signova</b>
          <small className="block truncate text-xs font-semibold text-slate-500">Every Gesture, a Voice.</small>
        </span>
      </button>

      <nav className="grid gap-2" aria-label="Primary">
        {navItems.map(([label, icon]) => (
          <button
            type="button"
            key={label}
            aria-current={activePage === label ? 'page' : undefined}
            aria-label={label}
            onClick={() => onNavigate(label)}
            className={`group flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition ${
              activePage === label
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-soft'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20 text-base">{icon}</span>
            <span className="hidden xl:inline">{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto hidden rounded-3xl border border-cyan-100 bg-cyan-50/70 p-4 xl:block">
        <p className="text-sm font-black text-slate-950">Accessibility Ready</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Captions, contrast, voice and touch controls.</p>
      </div>
    </aside>
  );
}

export function MobileBottomNav({ activePage, onNavigate }) {
  const mobileItems = navItems.filter(([label]) => ['Home', 'Library', 'Practice', 'Learn', 'Community'].includes(label));
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 gap-1 border-t border-slate-200 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
    >
      {mobileItems.map(([label, icon]) => (
        <button
          type="button"
          key={label}
          aria-label={label}
          aria-current={activePage === label ? 'page' : undefined}
          onClick={() => onNavigate(label)}
          className={`grid min-h-12 place-items-center rounded-2xl text-[0.7rem] font-black transition ${
            activePage === label ? 'bg-blue-600 text-white' : 'text-slate-500'
          }`}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function Header({ activePage, onMenu }) {
  return (
    <header className="sticky top-0 z-30 grid gap-3 border-b border-white/70 bg-signova-mist/90 px-4 py-3 backdrop-blur-xl sm:grid-cols-[1fr_auto] lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Signova</p>
          <h1 className="truncate text-[clamp(1.45rem,4.5vw,2.35rem)] font-black leading-tight text-slate-950">{activePage}</h1>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(12rem,24rem)_auto_auto]">
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-sm">
          <span aria-hidden="true">⌕</span>
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search lessons, signs, people..." aria-label="Search Signova" />
        </label>
        <button type="button" className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm" aria-label="Notifications">🔔</button>
        <button type="button" className="min-h-11 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white" aria-label="User profile">AN</button>
      </div>
    </header>
  );
}

export function Card({ children, className = '', as: Component = 'section', ...props }) {
  return (
    <Component className={`rounded-3xl border border-slate-200/80 bg-white/80 p-4 shadow-soft backdrop-blur-xl ${className}`} {...props}>
      {children}
    </Component>
  );
}

export function ResponsiveGrid({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {children}
    </div>
  );
}

export function ProgressCard({ title, value, detail, tone = 'blue' }) {
  const color = tone === 'cyan' ? 'from-cyan-400 to-blue-500' : tone === 'green' ? 'from-emerald-400 to-cyan-500' : 'from-blue-600 to-indigo-500';
  return (
    <Card className="min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{value}</strong>
          <small className="mt-1 block text-xs font-semibold text-slate-500">{detail}</small>
        </div>
        <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-soft`}>↗</span>
      </div>
    </Card>
  );
}

export function CameraControls({ cameraOn, micOn, translationOn, onToggle }) {
  const controls = [
    ['camera', cameraOn ? 'Camera on' : 'Camera off', '▣'],
    ['mic', micOn ? 'Mic on' : 'Mic muted', '⌁'],
    ['translation', translationOn ? 'Translation on' : 'Translation off', 'AI'],
    ['filter', 'Filter', '✦'],
    ['light', 'Low light', '☼'],
    ['end', 'End', '☎'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-2" aria-label="Camera controls">
      {controls.map(([id, label, icon]) => (
        <button
          type="button"
          key={id}
          onClick={() => onToggle(id)}
          className={`min-h-12 rounded-2xl px-3 text-sm font-black transition active:scale-95 ${
            id === 'end'
              ? 'bg-rose-500 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'
          }`}
          aria-label={label}
        >
          <span className="mr-2">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}

export function LessonCard({ title, meta, progress, icon }) {
  return (
    <Card as="article" className="grid min-h-40 content-between">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-2xl">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{meta}</p>
        </div>
      </div>
      <div>
        <div className="mt-4 h-2 rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs font-black text-blue-700">{progress}% complete</p>
      </div>
    </Card>
  );
}

export const navigationItems = navItems;
