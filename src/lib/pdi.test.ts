import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cycleProgress,
  closeCycle,
  currentCycle,
  goalProgress,
  isLate,
  isState,
  matchesFilters,
  statusCounts,
  toCSV,
  today,
} from './pdi.ts'
import type { Action, Goal, State } from './pdi.ts'

const action = (p: Partial<Action> = {}): Action =>
  ({ id: 'a', description: 'ação', type: '', status: 'Pendente', completedAt: '', notes: '', ...p })

const goal = (p: Partial<Goal> = {}): Goal =>
  ({
    id: 'g',
    title: 'meta',
    category: 'Técnica',
    description: '',
    deadline: '',
    status: 'Não iniciada',
    actions: [],
    checkins: [],
    ...p,
  })

test('RF06 progresso da meta pelo % de ações concluídas', () => {
  assert.equal(goalProgress(goal()), 0)
  assert.equal(goalProgress(goal({ actions: [action({ status: 'Concluída' }), action()] })), 50)
  assert.equal(goalProgress(goal({ actions: [action({ status: 'Concluída' })] })), 100)
})

test('RF10 progresso do ciclo é a média das metas', () => {
  const c = {
    id: 'c',
    name: 'x',
    start: '',
    end: null,
    goals: [goal({ actions: [action({ status: 'Concluída' })] }), goal({ actions: [action()] })],
  }
  assert.equal(cycleProgress(c), 50)
  assert.equal(cycleProgress({ ...c, goals: [] }), 0)
  assert.equal(statusCounts(c)['Não iniciada'], 2)
})

test('RF11 busca livre alcança ações e check-ins', () => {
  const g = goal({
    actions: [action({ notes: 'link do certificado AWS' })],
    checkins: [{ id: 'k', date: '2026-01-01', reflection: 'travei no módulo 3', perceived: 40 }],
  })
  assert.ok(matchesFilters(g, { q: 'aws', status: '', category: '' }))
  assert.ok(matchesFilters(g, { q: 'TRAVEI', status: '', category: '' }))
  assert.ok(!matchesFilters(g, { q: 'inexistente', status: '', category: '' }))
})

test('RF03 filtros de status e categoria combinam com a busca', () => {
  const g = goal({ status: 'Em andamento' })
  assert.ok(matchesFilters(g, { q: '', status: 'Em andamento', category: 'Técnica' }))
  assert.ok(!matchesFilters(g, { q: '', status: 'Concluída', category: '' }))
  assert.ok(!matchesFilters(g, { q: '', status: '', category: 'Liderança' }))
  assert.ok(!matchesFilters(g, { q: 'meta', status: 'Concluída', category: '' }))
})

test('prazo vencido só marca meta não concluída', () => {
  assert.ok(isLate(goal({ deadline: '2020-01-01' }), '2026-01-01'))
  assert.ok(!isLate(goal({ deadline: '2020-01-01', status: 'Concluída' }), '2026-01-01'))
  assert.ok(!isLate(goal({ deadline: '' }), '2026-01-01'))
})

test('RF08/RF09 encerrar ciclo preserva histórico e carrega pendências', () => {
  const before: State = {
    currentId: 'c1',
    cycles: [
      {
        id: 'c1',
        name: 'Ciclo 1',
        start: '2026-01-01',
        end: null,
        goals: [
          goal({ id: 'done', status: 'Concluída' }),
          goal({ id: 'open', status: 'Em andamento', actions: [action({ status: 'Concluída' }), action()] }),
        ],
      },
    ],
  }
  const after = closeCycle(before, 'Ciclo 2', true)
  assert.equal(after.cycles.length, 2)
  assert.equal(after.cycles[1].end, today(), 'ciclo anterior fica encerrado')
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/, 'data local no formato ISO curto')
  assert.equal(after.cycles[1].goals.length, 2, 'histórico do ciclo anterior intacto')
  assert.equal(after.currentId, after.cycles[0].id)
  assert.deepEqual(
    after.cycles[0].goals.map((g) => g.title),
    ['meta'],
    'só a meta não concluída é carregada',
  )
  assert.equal(after.cycles[0].goals[0].actions.length, 1, 'só as ações pendentes vêm junto')
  assert.notEqual(after.cycles[0].goals[0].id, 'open', 'a cópia tem id novo')
  assert.equal(closeCycle(before, 'Ciclo 2', false).cycles[0].goals.length, 0)
})

test('o ciclo atual é sempre o aberto, mesmo com currentId apontando para um encerrado', () => {
  const s: State = {
    currentId: 'velho',
    cycles: [
      { id: 'novo', name: 'Ciclo 2', start: '', end: null, goals: [] },
      { id: 'velho', name: 'Ciclo 1', start: '', end: '2026-01-01', goals: [] },
    ],
  }
  assert.equal(currentCycle(s).id, 'novo')
})

test('RNF03 CSV escapa aspas e vírgulas e cobre os três níveis', () => {
  const s: State = {
    currentId: 'c1',
    cycles: [
      {
        id: 'c1',
        name: 'Ciclo 1',
        start: '',
        end: null,
        goals: [
          goal({
            title: 'Meta "importante", urgente',
            actions: [action({ status: 'Concluída', completedAt: '2026-02-01' })],
            checkins: [{ id: 'k', date: '2026-02-02', reflection: 'ok', perceived: 70 }],
          }),
        ],
      },
    ],
  }
  const lines = toCSV(s).split('\r\n')
  assert.equal(lines.length, 4, 'cabeçalho + meta + ação + check-in')
  assert.ok(lines[1].includes('"Meta ""importante"", urgente"'))
  assert.ok(lines[3].includes('"70%"'))
})

test('importação rejeita JSON que não é um estado do PDI', () => {
  assert.ok(!isState({ foo: 1 }))
  assert.ok(!isState({ cycles: [] }))
  assert.ok(isState({ cycles: [{ id: 'c', name: 'n', start: '', end: null, goals: [] }], currentId: 'c' }))
})
