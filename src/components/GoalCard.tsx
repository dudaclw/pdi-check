import { useState } from 'react'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useFarDeadline } from '@/components/FarDeadline'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ACTION_TYPES,
  CATEGORIES,
  STATUSES,
  STATUS_COLOR,
  findGoal,
  fmtDate,
  goalProgress,
  deadlineState,
  relDays,
  removeGoal,
  today,
  uid,
} from '@/lib/pdi'
import type { Action, Goal, State, Status } from '@/lib/pdi'

const NO_CATEGORY = '__none__'

type Props = {
  goal: Goal
  readOnly: boolean
  expanded: boolean
  onExpand: () => void
  edit: (fn: (draft: State) => void) => void
}

export function GoalCard({ goal, readOnly, expanded, onExpand, edit }: Props) {
  /* view mode mostra o resumo; o lápis abre os campos. Nunca os dois ao mesmo tempo. */
  const [editing, setEditing] = useState(false)
  const far = useFarDeadline()
  const progress = goalProgress(goal)
  const done = goal.actions.filter((a) => a.status === 'Concluída').length
  const urgency = deadlineState(goal)
  const last = goal.checkins[0]
  const color = STATUS_COLOR[goal.status]

  const remove = () => {
    if (confirm(`Excluir a meta “${goal.title}” e todas as suas ações e check-ins?`))
      edit((s) => removeGoal(s, goal.id))
  }

  const patch = (p: Partial<Goal>) => edit((s) => void Object.assign(findGoal(s, goal.id), p))
  const patchAction = (id: string, p: Partial<Action>) =>
    edit((s) => void Object.assign(findGoal(s, goal.id).actions.find((a) => a.id === id)!, p))

  /* RNF06: um clique registra progresso — e a meta se fecha sozinha na última ação. */
  const toggleAction = (id: string, isDone: boolean) =>
    edit((s) => {
      const g = findGoal(s, goal.id)
      const a = g.actions.find((x) => x.id === id)!
      a.status = isDone ? 'Concluída' : 'Pendente'
      a.completedAt = isDone ? a.completedAt || today() : ''
      if (isDone && g.actions.every((x) => x.status === 'Concluída') && g.status !== 'Cancelada') g.status = 'Concluída'
      else if (!isDone && g.status === 'Concluída') g.status = 'Em andamento'
      else if (isDone && g.status === 'Não iniciada') g.status = 'Em andamento'
    })

  function addAction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const field = form.elements.namedItem('description') as HTMLInputElement
    const description = field.value.trim()
    if (!description) return field.focus()
    edit((s) =>
      findGoal(s, goal.id).actions.push({
        id: uid(),
        description,
        type: String(new FormData(form).get('type') ?? ''),
        status: 'Pendente',
        completedAt: '',
        notes: '',
      }),
    )
    form.reset()
  }

  return (
    <AccordionItem
      value={goal.id}
      className={`rounded-lg border px-3 ${urgency === 'late' ? 'border-destructive/30 bg-destructive/5' : 'bg-card'}`}
    >
      {/* card próprio por meta, mas o fechado ocupa uma linha só: 10 metas continuam cabendo na tela */}
      <div className="flex items-center">
        {editing && (
          <>
            <span className={`mr-2.5 size-2 shrink-0 rounded-full ${color.dot}`} aria-hidden />
            {/* o nome se edita onde ele é lido — o painel abaixo cuida do resto */}
            <Input
              value={goal.title}
              aria-label="Nome da meta"
              className="-ml-1 h-auto min-w-0 flex-1 border-transparent bg-transparent px-1 py-0.5 font-medium shadow-none dark:bg-transparent hover:border-input focus-visible:border-input"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </>
        )}
        <AccordionTrigger
          className={
            editing ? 'flex-none py-2.5' : 'min-w-0 flex-1 items-center gap-2.5 py-2.5 hover:no-underline'
          }
        >
          {!editing && (
            <>
              <span className={`size-2 shrink-0 rounded-full ${color.dot}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-left font-medium">{goal.title}</span>
            </>
          )}
          {/* em edição os mesmos dados estão logo abaixo em campos: não repete aqui */}
          {/* grid de colunas fixas: prazo, barra, %, categoria e status alinham entre as linhas.
              Célula vazia continua ocupando a coluna — é o que mantém o alinhamento. */}
          {!editing && (
            <span className="grid shrink-0 grid-cols-[2.5rem_6.5rem] items-center gap-x-3 text-xs sm:grid-cols-[8rem_3rem_2.5rem_6.5rem] md:grid-cols-[8rem_3rem_2.5rem_6rem_6.5rem]">
              <span
                className={`hidden text-center whitespace-nowrap sm:block ${
                  urgency === 'late'
                    ? 'text-destructive font-medium'
                    : urgency === 'soon'
                      ? 'font-medium text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                }`}
              >
                {fmtDate(goal.deadline)}
              </span>
              <span className="hidden sm:block">
                {goal.actions.length > 0 && <Progress value={progress} className="w-12" />}
              </span>
              <span className="text-muted-foreground text-right tabular-nums">
                {goal.actions.length > 0 && `${progress}%`}
              </span>
              <span className="text-muted-foreground hidden truncate text-center md:block">{goal.category}</span>
              <Badge className={`${color.badge} justify-self-center`}>{goal.status}</Badge>
            </span>
          )}
        </AccordionTrigger>
        {editing && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir meta"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        )}
        {readOnly ? (
          /* ciclo encerrado não se edita, mas dá pra apagar o que não deveria estar ali */
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir meta"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            aria-label={editing ? 'Concluir edição' : 'Editar meta'}
            className="text-muted-foreground shrink-0"
            onClick={() => {
              if (!expanded) onExpand()
              setEditing((v) => !v)
            }}
          >
            {editing ? <Check /> : <Pencil />}
          </Button>
        )}
      </div>

      {/* h-auto: o padrão do shadcn fixa a altura medida na abertura e corta ação/check-in novos */}
      <AccordionContent className="h-auto space-y-4 border-t pt-3 pb-4">
        {!editing && (
          <p className="text-muted-foreground text-xs">
            {[
              `${done}/${goal.actions.length} ações`,
              goal.category || 'sem categoria',
              last && `último check-in ${relDays(last.date)} · progresso percebido ${last.perceived}%`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {editing ? (
          /* RF02 */
          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`c-${goal.id}`}>Categoria</Label>
                <Select
                  value={goal.category || NO_CATEGORY}
                  onValueChange={(v) => patch({ category: v === NO_CATEGORY ? '' : v })}
                >
                  <SelectTrigger id={`c-${goal.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
                    {[...new Set([...CATEGORIES, goal.category].filter(Boolean))].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`d-${goal.id}`}>Prazo</Label>
                <Input
                  id={`d-${goal.id}`}
                  type="date"
                  value={goal.deadline}
                  onChange={(e) => {
                    patch({ deadline: e.target.value })
                    far.check(e.target.value)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`s-${goal.id}`}>Status</Label>
                <Select value={goal.status} onValueChange={(v) => patch({ status: v as Status })}>
                  <SelectTrigger id={`s-${goal.id}`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`desc-${goal.id}`}>Descrição</Label>
              <Textarea
                id={`desc-${goal.id}`}
                value={goal.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          </div>
        ) : (
          goal.description && <p className="text-muted-foreground text-sm">{goal.description}</p>
        )}

        {/* RF04 + RF05 */}
        <div className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Ações ({done}/{goal.actions.length})
          </h3>
          {goal.actions.map((a) =>
            editing ? (
              <div key={a.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_2fr_auto]">
                <Input
                  value={a.description}
                  aria-label="Descrição da ação"
                  onChange={(e) => patchAction(a.id, { description: e.target.value })}
                />
                <Select value={a.type || NO_CATEGORY} onValueChange={(v) => patchAction(a.id, { type: v === NO_CATEGORY ? '' : v })}>
                  <SelectTrigger aria-label="Tipo da ação" className="w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sem tipo</SelectItem>
                    {[...new Set([...ACTION_TYPES, a.type].filter(Boolean))].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={a.completedAt}
                  aria-label="Data de conclusão"
                  onChange={(e) => patchAction(a.id, { completedAt: e.target.value })}
                />
                <Input
                  value={a.notes}
                  placeholder="Notas / link da evidência"
                  aria-label="Notas da ação"
                  onChange={(e) => patchAction(a.id, { notes: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir ação"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    edit((s) => {
                      const g = findGoal(s, goal.id)
                      g.actions = g.actions.filter((x) => x.id !== a.id)
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ) : (
              <div key={a.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Checkbox
                  checked={a.status === 'Concluída'}
                  disabled={readOnly}
                  aria-label={`Concluir ${a.description}`}
                  onCheckedChange={(v) => toggleAction(a.id, v === true)}
                />
                <span className={a.status === 'Concluída' ? 'text-muted-foreground line-through' : ''}>
                  {a.description}
                </span>
                <span className="text-muted-foreground text-xs">
                  {a.type}
                </span>
                {a.notes &&
                  (/^https?:\/\//.test(a.notes) ? (
                    <a href={a.notes} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
                      evidência
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">· {a.notes}</span>
                  ))}
              </div>
            ),
          )}
          {!readOnly && !editing && (
            <form onSubmit={addAction} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <Input name="description" placeholder="Nova ação" aria-label="Nova ação" />
              <Select name="type">
                <SelectTrigger aria-label="Tipo da nova ação" className="w-full">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="secondary">
                <Plus /> Ação
              </Button>
            </form>
          )}
        </div>

        <Separator />

        {/* RF07 */}
        <div className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Check-ins</h3>
          {goal.checkins.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground w-20 shrink-0 text-xs tabular-nums">{fmtDate(k.date)}</span>
              {editing ? (
                <Input
                  value={k.reflection}
                  aria-label="Reflexão"
                  className="min-w-40 flex-1"
                  onChange={(e) =>
                    edit((s) => void (findGoal(s, goal.id).checkins.find((x) => x.id === k.id)!.reflection = e.target.value))
                  }
                />
              ) : (
                <span className="mr-auto">{k.reflection}</span>
              )}
              <span className="flex shrink-0 items-center gap-2">
                <Progress value={k.perceived} className="w-16" />
                <span className="text-muted-foreground w-8 text-right text-xs tabular-nums">{k.perceived}%</span>
              </span>
              {editing && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir check-in"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    edit((s) => {
                      const g = findGoal(s, goal.id)
                      g.checkins = g.checkins.filter((x) => x.id !== k.id)
                    })
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {!goal.checkins.length && <p className="text-muted-foreground text-sm">Nenhum check-in ainda.</p>}
          {!readOnly && !editing && (
            <CheckinForm
              key={progress}
              progress={progress}
              onAdd={(reflection, perceived) =>
                edit((s) => findGoal(s, goal.id).checkins.unshift({ id: uid(), date: today(), reflection, perceived }))
              }
            />
          )}
        </div>
        {far.dialog}
      </AccordionContent>
    </AccordionItem>
  )
}

function CheckinForm({ progress, onAdd }: { progress: number; onAdd: (reflection: string, perceived: number) => void }) {
  const [perceived, setPerceived] = useState(progress)
  const [reflection, setReflection] = useState('')

  return (
    <form
      className="bg-muted/40 space-y-3 rounded-md p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onAdd(reflection.trim(), perceived)
      }}
    >
      <Input
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        placeholder="Como foi desde o último check-in?"
        aria-label="Reflexão do check-in"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="perceived" className="text-muted-foreground text-xs font-normal">
          Progresso percebido
        </Label>
        <Slider
          id="perceived"
          className="min-w-40 flex-1"
          value={[perceived]}
          onValueChange={([v]) => setPerceived(v)}
          max={100}
          step={5}
        />
        <span className="w-9 text-right text-sm font-medium tabular-nums">{perceived}%</span>
        <Button type="submit" variant="secondary" disabled={!reflection.trim()}>
          <Plus /> Check-in
        </Button>
      </div>
    </form>
  )
}
