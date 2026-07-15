// Per-module accent colors: each functional area gets its own identity color
// instead of everything being violet. Used by Navigation.astro (active item +
// icon) and dashboard.astro (quick-action cards). See CLAUDE.md "Frontend
// Design System".
//
// Tailwind's class scanner works by regex over raw file text, not by
// evaluating JS — so these must be complete, literal class strings (no
// `` `bg-${accent}-600` `` interpolation) for Tailwind to generate the CSS.
export type AccentColor = 'purple' | 'cyan' | 'sky' | 'emerald' | 'amber' | 'orange' | 'fuchsia' | 'rose';

export const ACCENT_NAV_ACTIVE: Record<AccentColor, string> = {
  purple: 'bg-purple-600/15 text-purple-300 ring-1 ring-inset ring-purple-500/30',
  cyan: 'bg-cyan-600/15 text-cyan-300 ring-1 ring-inset ring-cyan-500/30',
  sky: 'bg-sky-600/15 text-sky-300 ring-1 ring-inset ring-sky-500/30',
  emerald: 'bg-emerald-600/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  amber: 'bg-amber-600/15 text-amber-300 ring-1 ring-inset ring-amber-500/30',
  orange: 'bg-orange-600/15 text-orange-300 ring-1 ring-inset ring-orange-500/30',
  fuchsia: 'bg-fuchsia-600/15 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-500/30',
  rose: 'bg-rose-600/15 text-rose-300 ring-1 ring-inset ring-rose-500/30',
};

export const ACCENT_NAV_ICON: Record<AccentColor, string> = {
  purple: 'text-purple-400',
  cyan: 'text-cyan-400',
  sky: 'text-sky-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  orange: 'text-orange-400',
  fuchsia: 'text-fuchsia-400',
  rose: 'text-rose-400',
};

export const ACCENT_TILE: Record<AccentColor, string> = {
  purple: 'bg-purple-500/10 text-purple-400',
  cyan: 'bg-cyan-500/10 text-cyan-400',
  sky: 'bg-sky-500/10 text-sky-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  orange: 'bg-orange-500/10 text-orange-400',
  fuchsia: 'bg-fuchsia-500/10 text-fuchsia-400',
  rose: 'bg-rose-500/10 text-rose-400',
};

export const ACCENT_HOVER_TITLE: Record<AccentColor, string> = {
  purple: 'group-hover:text-purple-300',
  cyan: 'group-hover:text-cyan-300',
  sky: 'group-hover:text-sky-300',
  emerald: 'group-hover:text-emerald-300',
  amber: 'group-hover:text-amber-300',
  orange: 'group-hover:text-orange-300',
  fuchsia: 'group-hover:text-fuchsia-300',
  rose: 'group-hover:text-rose-300',
};

export const ACCENT_HOVER_BORDER: Record<AccentColor, string> = {
  purple: 'hover:border-purple-500/50',
  cyan: 'hover:border-cyan-500/50',
  sky: 'hover:border-sky-500/50',
  emerald: 'hover:border-emerald-500/50',
  amber: 'hover:border-amber-500/50',
  orange: 'hover:border-orange-500/50',
  fuchsia: 'hover:border-fuchsia-500/50',
  rose: 'hover:border-rose-500/50',
};
