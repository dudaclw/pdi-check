# Progresso Diário | Profissional

Plano de Desenvolvimento Individual, uso pessoal. React + Vite + Tailwind + shadcn/ui.
Os dados ficam no `localStorage` do navegador (`pdi.v1`) — nada sai da máquina, sem backend e sem login.

```bash
npm run dev     # http://localhost:5173
npm test        # lógica pura: progresso, filtros, ciclos, CSV
npm run build   # dist/ estático
```

## Como funciona

Duas abas: **Ciclo atual** é o dia a dia (padrão ao abrir), **Histórico** é consulta ocasional dos ciclos encerrados, somente leitura. Criar meta é um modal, não um bloco fixo — a lista de metas é o conteúdo principal da tela.

- **Ciclo**: tudo vive dentro de um ciclo. `Encerrar ciclo` congela o atual e abre o próximo, opcionalmente levando junto metas e ações não concluídas. O encerrado passa a ser consultável na aba Histórico.
- **Meta**: card recolhido mostra status (cor), categoria, prazo e progresso. Expandir mostra ações e check-ins; o lápis abre os campos editáveis — resumo e formulário nunca aparecem juntos. Categoria é lista fixa (`CATEGORIES` em `src/lib/pdi.ts`), senão "Técnica" e "técnica" viram duas categorias e o filtro quebra.
- **Ação**: marcar o checkbox conclui a ação, preenche a data e, se for a última, conclui a meta. Notas guardam a evidência — se for URL, vira link.
- **Check-in**: reflexão livre + slider de progresso percebido (começa no progresso real).
- **Editar vs registrar**: no card aberto você registra progresso (marcar/adicionar ação, novo check-in). Corrigir e apagar fica atrás do lápis.
- **Backup**: `JSON` exporta o estado inteiro e `Importar` restaura; `CSV` gera uma linha por meta, ação e check-in de todos os ciclos.

## Se um dia for hospedar (RNF04)

`npm run build` gera arquivos estáticos com todos os dados no navegador — publicar em host público expõe o app, não os dados. Ainda assim, use algo com acesso restrito (Tailscale, Cloudflare Access, Basic Auth) em vez de deixar aberto.
