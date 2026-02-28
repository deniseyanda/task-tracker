# Task Tracker - TODO

## Schema & Backend
- [x] Schema: tabelas tasks, projects, tags, task_tags, subtasks
- [x] Schema: push para o banco de dados
- [x] Backend: CRUD de projetos (criar, listar, editar, deletar)
- [x] Backend: CRUD de tarefas (criar, listar, editar, deletar, mover status)
- [x] Backend: CRUD de tags
- [x] Backend: CRUD de subtarefas
- [x] Backend: filtros por projeto, prioridade, responsável, busca por texto
- [x] Backend: estatísticas do dashboard (tarefas por status, atrasadas, concluídas por dia/semana)
- [x] Backend: assistente IA (sugestão de priorização, estimativa de prazo, quebrar tarefas, chat)
- [x] Backend: notificações automáticas (tarefas com prazo em 24h, atrasadas)
- [x] Backend: relatórios semanais/mensais automáticos
- [x] Backend: integração Google Calendar (criar/atualizar/remover eventos)

## Frontend
- [x] Design system: cores, tipografia, grid (Estilo Tipográfico Internacional)
- [x] Layout base com DashboardLayout e sidebar
- [x] Página Kanban com colunas drag-and-drop
- [x] Modal de criação/edição de tarefas (CRUD completo)
- [x] Página Dashboard com gráficos de produtividade
- [x] Página Projetos com CRUD
- [x] Página Tags com CRUD
- [x] Sistema de filtros e busca no Kanban
- [x] Painel do Assistente IA com chat e ações rápidas
- [x] Página de Relatórios com gráficos e ações de notificação

## Automações
- [x] Notificações push para tarefas com prazo em 24h
- [x] Notificações push para tarefas atrasadas
- [x] Relatório semanal por notificação
- [x] Sincronização com Google Calendar (criar/atualizar eventos)
- [x] Botão de sync individual por tarefa (no modal)
- [x] Botão de sync em massa (na página de Relatórios)

## Testes
- [x] Testes vitest: auth (me, logout)
- [x] Testes vitest: CRUD de projetos
- [x] Testes vitest: CRUD de tags
- [x] Testes vitest: CRUD de tarefas com filtros
- [x] Testes vitest: dashboard stats
- [x] Testes vitest: notificações

## Integração Google Drive
- [x] Schema: adicionar campo driveClientName e driveClientPath nas tarefas
- [x] Backend: router Drive (listar clientes, listar arquivos, busca, gerar links)
- [x] Frontend: página Clientes com painel Drive e lista de documentos
- [x] Frontend: seletor de cliente no modal de tarefas
- [x] Frontend: card de cliente nas tarefas do Kanban com link direto
- [x] Frontend: busca rápida de clientes e documentos
- [x] Sidebar: adicionar item "Clientes" na navegação

## Sistema de Colaboradores
- [x] Schema: ampliar enum de roles (administrador, diretor, supervisor, operador)
- [x] Schema: tabela de convites (invites) com token, email, role e expiração
- [x] Backend: listar colaboradores com filtro por role
- [x] Backend: convidar colaborador por link/email com role definida
- [x] Backend: alterar role de colaborador
- [x] Backend: remover colaborador
- [x] Backend: permissões por nível em todos os routers
- [x] Frontend: página Colaboradores (lista, convite, edição, remoção)
- [x] Frontend: badge de role nos cards e perfis
- [x] Frontend: restrições visuais por nível de acesso
- [x] Sidebar: adicionar item "Colaboradores" na navegação

## Correções
- [x] Corrigir erro NotFoundError na página Colaboradores (confirm() nativo + renderização React)
- [x] Kanban: filtro por colaborador/responsável na barra de filtros

## Sistema de Notificações
- [x] Schema: tabela notifications (id, userId, taskId, tipo, mensagem, lida, criadaEm)
- [x] Backend: helper createNotification, listNotifications, markAsRead, markAllRead, deleteNotification
- [x] Backend: router notifications (list, markRead, markAllRead, delete, unreadCount)
- [x] Backend: job automático que verifica prazos a cada hora e cria notificações
- [x] Backend: verificar tarefas vencendo em 24h (tipo: prazo_proximo)
- [x] Backend: verificar tarefas atrasadas (tipo: atrasada)
- [x] Frontend: sino com badge de não lidas no DashboardLayout
- [x] Frontend: painel dropdown de notificações com lista, ações e link para tarefa
- [x] Frontend: polling automático a cada 60s para atualizar contagem
- [x] Frontend: marcar como lida ao clicar, marcar todas como lidas
