import { useEffect, useRef, useState } from 'react'
import { Download, FileUp, ListChecks, MoreHorizontal, Plus, RefreshCw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Accordion } from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GoalCard } from '@/components/GoalCard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useFarDeadline } from '@/components/FarDeadline'
import {
  CATEGORIES,
  STATUSES,
  STATUS_COLOR,
  categoriesOf,
  closeCycle,
  currentCycle,
  cycleProgress,
  download,
  fmtDate,
  isState,
  loadState,
  matchesFilters,
  saveState,
  statusCounts,
  today,
  toCSV,
  uid,
} from '@/lib/pdi'
import type { Cycle, Filters, State } from '@/lib/pdi'

const ALL = '__all__'
const NO_CATEGORY = '__none__'
const emptyFilters: Filters = { q: '', status: '', category: '' }

export default function App() {
  const [state, setState] = useState<State>(loadState)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [open, setOpen] = useState<string[]>([])
  const [historyId, setHistoryId] = useState('')
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const far = useFarDeadline()

  useEffect(() => saveState(state), [state])

  const edit = (fn: (draft: State) => void) =>
    setState((s) => {
      const draft = structuredClone(s)
      fn(draft)
      return draft
    })

  const cycle = currentCycle(state)
  const closed = state.cycles.filter((c) => c.end)
  const history = closed.find((c) => c.id === historyId) ?? closed[0]
  const noGoals = cycle.goals.length === 0
  const firstRun = noGoals && state.cycles.every((c) => !c.goals.length)

  function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const field = form.elements.namedItem('title') as HTMLInputElement
    const title = field.value.trim()
    if (!title) return field.focus()
    const f = new FormData(form)
    const category = String(f.get('category') ?? '')
    const deadline = String(f.get('deadline') ?? '')
    const id = uid()
    edit((s) =>
      currentCycle(s).goals.unshift({
        id,
        title,
        category: category === NO_CATEGORY ? '' : category,
        description: String(f.get('description') ?? '').trim(),
        deadline,
        status: 'Não iniciada',
        actions: [],
        checkins: [],
      }),
    )
    setFilters(emptyFilters) /* a meta nova não pode nascer escondida atrás de um filtro */
    setOpen((o) => [...o, id])
    setCreating(false)
    far.check(deadline) /* depois de fechar o modal: dois diálogos abertos brigam pelo foco */
  }

  function confirmClose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const field = form.elements.namedItem('name') as HTMLInputElement
    const name = field.value.trim()
    if (!name) return field.focus()
    setState((s) => closeCycle(s, name, new FormData(form).get('carry') === 'on'))
    setOpen([])
    setHistoryId('')
    setClosing(false)
  }

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!isState(data)) throw new Error('formato inválido')
      if (confirm('Substituir todos os dados atuais pelo conteúdo do arquivo?')) {
        setState({ ...data, currentId: data.currentId || data.cycles[0].id })
        setOpen([])
        setHistoryId('')
      }
    } catch {
      alert('Arquivo inválido — esperado um backup JSON exportado por este app.')
    }
  }

  const goalList = (c: Cycle, readOnly: boolean) => {
    const goals = c.goals.filter((g) => matchesFilters(g, filters))
    return goals.length ? (
      <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-2">
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            readOnly={readOnly}
            expanded={open.includes(g.id)}
            onExpand={() => setOpen((o) => [...o, g.id])}
            edit={edit}
          />
        ))}
      </Accordion>
    ) : (
      <p className="text-muted-foreground py-10 text-center text-sm">
        {c.goals.length ? 'Nenhuma meta bate com o filtro.' : 'Nenhuma meta neste ciclo.'}
      </p>
    )
  }

  /* Ciclo vazio não precisa de resumo zerado nem de filtro: precisa de um caminho pra primeira meta. */
  const welcome = (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="bg-muted rounded-full p-3">
          {firstRun ? <Target className="size-6" /> : <ListChecks className="size-6" />}
        </span>
        <div className="space-y-1">
          <h3 className="text-lg font-medium">{firstRun ? 'Seu PDI começa aqui' : `${cycle.name} ainda está vazio`}</h3>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {firstRun
              ? 'Um plano de desenvolvimento é uma lista curta de metas com prazo. O resto do app existe pra você não precisar lembrar de nada.'
              : 'Ciclo novo, folha limpa. O que você fez antes continua no Histórico.'}
          </p>
        </div>
        {firstRun && (
          <ol className="text-muted-foreground mx-auto max-w-md space-y-1.5 text-left text-sm">
            <li>
              <b className="text-foreground">1. Crie a meta</b> — título, categoria e prazo.
            </li>
            <li>
              <b className="text-foreground">2. Quebre em ações</b> — marcar uma ação como concluída já move o progresso
              sozinho.
            </li>
            <li>
              <b className="text-foreground">3. Faça check-ins</b> — uma frase sobre como foi e o quanto você sente que
              avançou.
            </li>
          </ol>
        )}
        <Button onClick={() => setCreating(true)}>
          <Plus /> {firstRun ? 'Criar primeira meta' : 'Criar meta'}
        </Button>
      </CardContent>
    </Card>
  )

  /* RF03 + RF11 */
  const filterBar = (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
      <Input
        value={filters.q}
        onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        placeholder="Buscar em metas, ações e check-ins"
      />
      <Select
        value={filters.status || ALL}
        onValueChange={(v) => setFilters((f) => ({ ...f, status: v === ALL ? '' : v }))}
      >
        <SelectTrigger aria-label="Filtrar por status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os status</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.category || ALL}
        onValueChange={(v) => setFilters((f) => ({ ...f, category: v === ALL ? '' : v }))}
      >
        <SelectTrigger aria-label="Filtrar por categoria">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as categorias</SelectItem>
          {categoriesOf(state).map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  /* RF10 — o número por status também é o filtro: clicar liga/desliga */
  const summary = (c: Cycle) => {
    const counts = statusCounts(c)
    return (
      <Card>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filters.status === s}
              onClick={() => setFilters((f) => ({ ...f, status: f.status === s ? '' : s }))}
              className={`rounded-md px-3 py-2 text-left transition-colors ${
                filters.status === s ? 'bg-accent ring-ring ring-2' : 'hover:bg-accent/50'
              }`}
            >
              <span className="text-muted-foreground block text-xs">{s}</span>
              <span className={`text-2xl font-semibold tabular-nums ${counts[s] ? STATUS_COLOR[s].text : 'text-muted-foreground/40'}`}>
                {counts[s]}
              </span>
            </button>
          ))}
          <div className="col-span-2 px-3 py-2 sm:col-span-1">
            <span className="text-muted-foreground block text-xs">Progresso do ciclo</span>
            <span className="text-2xl font-semibold tabular-nums">{cycleProgress(c)}%</span>
            <Progress value={cycleProgress(c)} className="mt-1" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24 sm:p-6">
      <header className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">Progresso Diário | Profissional</h1>

        <ThemeToggle />

        {/* uma ação primária por tela; o resto (raro) fica aqui dentro */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Mais ações">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setClosing(true)}>
              <RefreshCw /> Encerrar ciclo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => download(`pdi-${today()}.json`, JSON.stringify(state, null, 2), 'application/json')}>
              <Download /> Exportar JSON
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download(`pdi-${today()}.csv`, toCSV(state), 'text/csv')}>
              <Download /> Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <FileUp /> Importar backup
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={importJSON} />
      </header>

      <Tabs defaultValue="atual" className="space-y-4" onValueChange={() => setFilters(emptyFilters)}>
        <TabsList>
          <TabsTrigger value="atual">Ciclo atual</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="atual" className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* o nome do ciclo é do usuário: editável no lugar, sem botão de editar no meio */}
            <Input
              value={cycle.name}
              aria-label="Nome do ciclo"
              className="-ml-1 h-auto w-auto min-w-32 border-transparent bg-transparent px-1 py-0.5 text-lg font-medium shadow-none field-sizing-content md:text-lg dark:bg-transparent hover:border-input focus-visible:border-input"
              onChange={(e) => edit((s) => void (currentCycle(s).name = e.target.value))}
              onBlur={(e) =>
                e.target.value.trim() ||
                edit((s) => void (currentCycle(s).name = `Ciclo ${new Date().getFullYear()}`))
              }
            />
            <Button className="ml-auto" onClick={() => setCreating(true)}>
              <Plus /> Nova meta
            </Button>
          </div>

          {noGoals ? (
            welcome
          ) : (
            <>
              {summary(cycle)}
              {filterBar}
              {goalList(cycle, false)}
            </>
          )}
        </TabsContent>

        {/* RF09 */}
        <TabsContent value="historico" className="space-y-4">
          {history ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Select value={history.id} onValueChange={(id) => (setHistoryId(id), setOpen([]))}>
                  <SelectTrigger className="w-auto min-w-56" aria-label="Ciclo do histórico">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {closed.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · encerrado {fmtDate(c.end!)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="secondary">somente leitura</Badge>
              </div>
              {summary(history)}
              {filterBar}
              {goalList(history, true)}
            </>
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Nenhum ciclo encerrado ainda. Ao encerrar “{cycle.name}”, ele aparece aqui.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* RF01: criar é ação pontual, não bloco fixo */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <form onSubmit={createGoal}>
            <DialogHeader>
              <DialogTitle>Nova meta</DialogTitle>
              <DialogDescription>Ações e check-ins você adiciona depois, dentro da meta.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="g-title">Título</Label>
                <Input id="g-title" name="title" autoFocus />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="g-category">Categoria</Label>
                  <Select name="category" defaultValue={NO_CATEGORY}>
                    <SelectTrigger id="g-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="g-deadline">Prazo</Label>
                  <Input id="g-deadline" name="deadline" type="date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-description">Descrição</Label>
                <Textarea id="g-description" name="description" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Criar meta</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RF08 */}
      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <form onSubmit={confirmClose}>
            <DialogHeader>
              <DialogTitle>Encerrar “{cycle.name}”</DialogTitle>
              <DialogDescription>
                O ciclo atual vai para o histórico, somente leitura. Um novo ciclo começa em seguida.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-cycle">Nome do novo ciclo</Label>
                <Input id="new-cycle" name="name" defaultValue={`Ciclo ${new Date().getFullYear() + 1}`} />
              </div>
              <Label className="font-normal">
                <Checkbox name="carry" defaultChecked />
                Levar metas e ações não concluídas para o novo ciclo
              </Label>
            </div>
            <DialogFooter>
              <Button type="submit">Encerrar e iniciar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {far.dialog}
    </div>
  )
}
