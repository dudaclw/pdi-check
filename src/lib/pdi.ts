export const STATUSES = ['Não iniciada', 'Em andamento', 'Concluída', 'Cancelada'] as const
export type Status = (typeof STATUSES)[number]

export const ACTION_TYPES = ['Curso', 'Leitura', 'Prática', 'Mentoria', 'Projeto', 'Certificação']

/** Lista fixa: categoria digitada à mão vira "Técnica"/"tecnica"/"TECH" e quebra o filtro. */
export const CATEGORIES = ['Técnica', 'Liderança', 'Comunicação', 'Idiomas', 'Negócio', 'Pessoal']

/** Cor com significado: dá pra escanear a lista sem ler o texto do status. */
export const STATUS_COLOR: Record<Status, { dot: string; badge: string; text: string }> = {
  'Não iniciada': {
    dot: 'bg-muted-foreground/40',
    badge: 'bg-muted text-muted-foreground border-transparent',
    text: 'text-muted-foreground',
  },
  'Em andamento': {
    dot: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-transparent',
    text: 'text-blue-700 dark:text-blue-300',
  },
  Concluída: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-transparent',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  Cancelada: {
    dot: 'bg-muted-foreground/20',
    badge: 'bg-muted text-muted-foreground border-transparent line-through',
    text: 'text-muted-foreground',
  },
}

/** Uma data, um formato: dd/mm/aaaa em toda a UI, igual ao que o input[type=date] mostra. */
export const fmtDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '')

export type Action = {
  id: string
  description: string
  type: string
  status: 'Pendente' | 'Concluída'
  completedAt: string
  notes: string
}

export type Checkin = {
  id: string
  date: string
  reflection: string
  perceived: number
}

export type Goal = {
  id: string
  title: string
  category: string
  description: string
  deadline: string
  status: Status
  actions: Action[]
  checkins: Checkin[]
}

export type Cycle = { id: string; name: string; start: string; end: string | null; goals: Goal[] }
export type State = { cycles: Cycle[]; currentId: string }
export type Filters = { q: string; status: string; category: string }

export const uid = () => Math.random().toString(36).slice(2, 10)
/** Data local em YYYY-MM-DD ('sv' formata assim). toISOString() daria UTC — um dia à frente à noite no Brasil. */
export const today = () => new Date().toLocaleDateString('sv')

/* ---------- lógica pura (coberta por pdi.test.ts) ---------- */

/** RF06: progresso = % de ações concluídas. */
export const goalProgress = (g: Goal) =>
  g.actions.length
    ? Math.round((100 * g.actions.filter((a) => a.status === 'Concluída').length) / g.actions.length)
    : 0

/** RF10: progresso geral do ciclo = média do progresso das metas. */
export const cycleProgress = (c: Cycle) =>
  c.goals.length ? Math.round(c.goals.reduce((s, g) => s + goalProgress(g), 0) / c.goals.length) : 0

export const statusCounts = (c: Cycle) =>
  Object.fromEntries(STATUSES.map((s) => [s, c.goals.filter((g) => g.status === s).length])) as Record<Status, number>

/** RF11: busca livre em meta, ações e check-ins. RF03: filtros por status e categoria. */
export const matchesFilters = (g: Goal, f: Filters) => {
  const hay = [
    g.title,
    g.category,
    g.description,
    ...g.actions.flatMap((a) => [a.description, a.type, a.notes]),
    ...g.checkins.map((k) => k.reflection),
  ]
    .join(' ')
    .toLowerCase()
  return (
    (!f.q || hay.includes(f.q.trim().toLowerCase())) &&
    (!f.status || g.status === f.status) &&
    (!f.category || g.category === f.category)
  )
}

export const isLate = (g: Goal, now = today()) => !!g.deadline && g.deadline < now && g.status !== 'Concluída'

export const categoriesOf = (s: State) =>
  [...new Set(s.cycles.flatMap((c) => c.goals.map((g) => g.category)).filter(Boolean))].sort()

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

/** RNF03: CSV plano com metas, ações e check-ins de todos os ciclos. */
export function toCSV(s: State) {
  const rows: unknown[][] = [
    ['ciclo', 'tipo', 'meta', 'categoria', 'prazo', 'status_meta', 'progresso', 'item', 'item_tipo', 'item_status', 'item_data', 'item_notas'],
  ]
  for (const c of s.cycles)
    for (const g of c.goals) {
      const base = [c.name, g.title, g.category, g.deadline, g.status, `${goalProgress(g)}%`]
      rows.push([base[0], 'meta', ...base.slice(1), g.description, '', '', '', ''])
      for (const a of g.actions)
        rows.push([base[0], 'ação', ...base.slice(1), a.description, a.type, a.status, a.completedAt, a.notes])
      for (const k of g.checkins)
        rows.push([base[0], 'check-in', ...base.slice(1), k.reflection, '', `${k.perceived}%`, k.date, ''])
    }
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/* ---------- ciclos ---------- */

export const newCycle = (name: string): Cycle => ({ id: uid(), name, start: today(), end: null, goals: [] })

/** RF08: encerra o ciclo atual e abre o próximo, preservando o histórico (RF09). */
export function closeCycle(s: State, name: string, carryOver: boolean): State {
  const cur = currentCycle(s)
  const pending = cur.goals.filter((g) => g.status !== 'Concluída' && g.status !== 'Cancelada')
  const next = newCycle(name)
  if (carryOver)
    next.goals = pending.map((g) => ({
      ...g,
      id: uid(),
      checkins: [],
      actions: g.actions.filter((a) => a.status !== 'Concluída').map((a) => ({ ...a, id: uid() })),
    }))
  return {
    cycles: [next, ...s.cycles.map((c) => (c.id === cur.id ? { ...c, end: today() } : c))],
    currentId: next.id,
  }
}

/** O ciclo aberto. Navegar pelo histórico não muda quem é o ciclo atual. */
export const currentCycle = (s: State) =>
  s.cycles.find((c) => c.id === s.currentId && !c.end) ?? s.cycles.find((c) => !c.end) ?? s.cycles[0]
export const findGoal = (s: State, id: string) => currentCycle(s).goals.find((g) => g.id === id)!

/* ---------- persistência (RNF01: localStorage, 100% local) ---------- */

const KEY = 'pdi.v1'

export function loadState(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '') as State
    if (s?.cycles?.length) return s
  } catch {
    /* primeiro acesso ou dado corrompido: começa limpo */
  }
  const c = newCycle(`Ciclo ${new Date().getFullYear()}`)
  return { cycles: [c], currentId: c.id }
}

export const saveState = (s: State) => localStorage.setItem(KEY, JSON.stringify(s))

export function isState(x: unknown): x is State {
  const s = x as State
  return !!s && Array.isArray(s.cycles) && s.cycles.length > 0 && s.cycles.every((c) => Array.isArray(c.goals))
}

export function download(filename: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
