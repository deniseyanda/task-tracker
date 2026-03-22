# Task Tracker

Aplicação fullstack de gerenciamento de tarefas com painel Kanban, dashboard de produtividade, assistente de IA, integração com Google Calendar e Drive, sistema de colaboradores e notificações automáticas.

## Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, tRPC
- **Backend**: Node.js, Express, tRPC, Drizzle ORM, MySQL
- **Testes**: Vitest
- **Package manager**: pnpm

## Pré-requisitos

- Node.js >= 20
- pnpm >= 10
- MySQL

## Instalação

```bash
pnpm install
```

## Variáveis de ambiente

Crie um arquivo `.env` na raiz com as seguintes variáveis:

```env
DATABASE_URL=mysql://user:password@localhost:3306/task_tracker
JWT_SECRET=your_jwt_secret
```

## Comandos

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia o servidor de desenvolvimento |
| `pnpm build` | Gera o build de produção |
| `pnpm start` | Inicia em modo produção |
| `pnpm test` | Executa os testes |
| `pnpm check` | Verifica tipos TypeScript |
| `pnpm format` | Formata o código com Prettier |
| `pnpm db:push` | Aplica migrações no banco de dados |

## Funcionalidades

- **Kanban** com drag-and-drop e filtros por projeto, prioridade, responsável e texto
- **Dashboard** com gráficos de produtividade e estatísticas
- **Projetos** e **Tags** com CRUD completo
- **Subtarefas** por tarefa
- **Colaboradores** com sistema de roles (administrador, diretor, supervisor, operador)
- **Notificações** automáticas para prazos próximos e tarefas atrasadas
- **Assistente IA** para priorização, estimativa de prazo e quebra de tarefas
- **Relatórios** semanais e mensais
- **Integração Google Calendar** para criar e sincronizar eventos
- **Integração Google Drive** para vincular clientes e documentos
- **Importação de tarefas** via Excel

## Testes

```bash
pnpm test
```

Os testes cobrem: autenticação, CRUD de projetos/tarefas/tags, filtros, dashboard stats e notificações.

## Licença

MIT
