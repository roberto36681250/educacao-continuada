# Progresso do Desenvolvimento

## Bloco 0 - Setup Inicial
**Status**: Concluído

### O que foi feito
- Repositório Git inicializado
- README.md criado com visão geral do projeto
- Estrutura de documentação criada (docs/arquitetura.md, docs/progresso.md)
- .gitignore configurado

### Como testar
- Verificar existência do `.git/`
- Verificar arquivos de documentação

---

## Bloco 1 - Bootstrap Monorepo
**Status**: Concluído

### O que foi feito
- Monorepo configurado com pnpm workspaces
- apps/web: Next.js 14 + TypeScript + Tailwind CSS
- apps/api: NestJS 10 com endpoint GET /health
- packages/shared: Pacote para tipos e utilitários compartilhados

### Como testar
```bash
pnpm install
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001/health -> { "status": "ok" }
```

### Testes manuais executados
- [x] `pnpm install` - Instalou 813 pacotes
- [x] `pnpm dev` - Web e API iniciaram sem erros
- [x] http://localhost:3000 - Página inicial renderizada corretamente
- [x] http://localhost:3001/health - Retornou `{"status":"ok"}`

---

## Bloco 2 - Supabase + Prisma + Seed
**Status**: Concluído

### O que foi feito
- Prisma 7 instalado e configurado em apps/api
- Conexão com Supabase Postgres via Session Pooler (IPv4 compatível)
- Schema completo criado com todas entidades:
  - **Organizacional**: Institute, Hospital, Unit, User, UserUnitAssignment
  - **Conteúdo**: Course, Module, Lesson, VideoProgress
  - **Quiz**: Quiz, Question, Option, QuizAttempt, QuestionAnswer
  - **Competências**: Competency, UserCompetency
  - **Suporte**: Ticket
  - **Auditoria**: AuditLog
- Seed executado com dados iniciais
- Documentação das regras do produto criada

### Dados criados no seed
- 1 Instituto: "Educação Continuada"
- 2 Hospitais: Hospital Central, Hospital Norte
- 4 Unidades: UTI Adulto A, UTI Adulto B, Comissão Sepse, UTI Norte
- 4 Usuários:
  - Admin Master (admin@educacaocontinuada.com.br)
  - Dr. João Silva (Médico)
  - Maria Santos (Enfermeiro)
  - Carlos Oliveira (Fisioterapeuta)
- 4 Lotações com histórico

### Como testar
```bash
cd apps/api

# Sincronizar schema com banco (se necessário)
npx prisma db push

# Rodar seed (popula dados iniciais)
npx prisma db seed

# Abrir Prisma Studio (visualizar dados)
npx prisma studio
```

### Arquivos importantes
- `apps/api/.env` - DATABASE_URL do Supabase
- `apps/api/prisma/schema.prisma` - Schema do banco
- `apps/api/prisma/seed.ts` - Script de seed
- `apps/api/prisma.config.ts` - Configuração do Prisma 7
- `docs/01-regras-do-produto.md` - Regras de negócio documentadas

### Testes manuais executados
- [x] `npx prisma db push` - Schema sincronizado com Supabase
- [x] `npx prisma db seed` - Seed executado com sucesso
- [x] Dados visíveis no painel do Supabase

---

## Bloco 3 - Convite + Registro + Login
**Status**: Concluído

### O que foi feito

#### Schema Prisma
- Adicionado campo `passwordHash` ao User
- Criada entidade `InviteToken` para convites de registro
- Fix no tsconfig para excluir pasta prisma do watch

#### API (NestJS)
- **AuthModule**: Login e autenticação JWT
  - POST `/auth/login` - Login com email/senha
  - GET `/auth/me` - Dados do usuário logado (autenticado)
  - JwtStrategy para validação de tokens
  - RolesGuard e @Roles() decorator para RBAC

- **InvitesModule**: Gerenciamento de convites
  - POST `/invites` - Criar convite (ADMIN_MASTER/ADMIN)
  - GET `/invites/:token` - Consultar convite (público)
  - POST `/invites/:token/accept` - Aceitar convite e criar conta (público)

- Dependências adicionadas: bcrypt, passport, @nestjs/passport, @nestjs/jwt

#### Web (Next.js)
- `/login` - Página de login com email/senha
- `/invite/[token]` - Página de aceitar convite e registro
- `/me` - Página de perfil do usuário logado
- `src/lib/api.ts` - Cliente HTTP com gestão de token JWT

### Fluxo de uso
1. Admin cria convite via POST /invites
2. Usuário acessa /invite/[token]
3. Preenche formulário de registro (nome, email, CPF, telefone, registro profissional, senha)
4. Sistema cria usuário e retorna token JWT
5. Usuário é redirecionado para /me
6. Login subsequente via /login

### Como testar
```bash
# 1. Rodar seed (cria admin com senha admin123)
cd apps/api
npx prisma db push --force-reset
npx prisma db seed

# 2. Iniciar servidores
cd ../..
pnpm dev

# 3. Testar login do admin
# Acesse http://localhost:3000/login
# Email: admin@educacaocontinuada.com.br
# Senha: admin123

# 4. Criar convite via API (usando token do admin)
curl -X POST http://localhost:3001/invites \
  -H "Authorization: Bearer <TOKEN_DO_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{
    "instituteId": "<ID_DO_INSTITUTO>",
    "profession": "Enfermeiro",
    "invitedEmail": "novo@example.com"
  }'

# 5. Acessar convite
# http://localhost:3000/invite/<TOKEN_DO_CONVITE>
```

### Endpoints da API
| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| POST | /auth/login | Não | Login |
| GET | /auth/me | JWT | Dados do usuário |
| POST | /invites | JWT (ADMIN+) | Criar convite |
| GET | /invites/:token | Não | Consultar convite |
| POST | /invites/:token/accept | Não | Aceitar convite |

### Arquivos criados/modificados
- `apps/api/src/auth/*` - Módulo de autenticação
- `apps/api/src/invites/*` - Módulo de convites
- `apps/api/prisma/schema.prisma` - InviteToken + passwordHash
- `apps/api/prisma/seed.ts` - Admin com senha
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/invite/[token]/page.tsx`
- `apps/web/src/app/me/page.tsx`
- `apps/web/src/lib/api.ts`

---

## Bloco 4 - Admin Web para Hospitais, Unidades e Convites
**Status**: Concluído

### O que foi feito

#### API (NestJS)
- **HospitalsModule** expandido:
  - GET `/hospitals?instituteId=` - Listar hospitais do instituto
  - GET `/hospitals/:id` - Detalhes do hospital
  - POST `/hospitals` - Criar hospital (ADMIN_MASTER)
  - PATCH `/hospitals/:id` - Atualizar hospital (ADMIN_MASTER)

- **UnitsModule** expandido:
  - GET `/units?hospitalId=` - Listar unidades do hospital
  - GET `/units/:id` - Detalhes da unidade
  - POST `/units` - Criar unidade (ADMIN_MASTER)
  - PATCH `/units/:id` - Atualizar unidade (ADMIN_MASTER)

- **InvitesModule** expandido:
  - GET `/invites?instituteId=` - Listar convites recentes (ADMIN+)

#### Web (Next.js)
- `/admin` - Dashboard administrativo com links para as páginas
- `/admin/hospitais` - CRUD de hospitais (listar, criar, editar)
- `/admin/unidades` - CRUD de unidades com filtro por hospital
- `/admin/convites` - Formulário de criação + tabela de convites recentes
- `/invite/[token]` - UX melhorada com tratamento de estados (inválido, expirado, usado)

### Como criar um Hospital

1. Acesse http://localhost:3000/login
2. Entre com admin@educacaocontinuada.com.br / admin123
3. Clique em "Painel Administrativo"
4. Clique em "Hospitais"
5. Clique em "+ Novo Hospital"
6. Preencha o nome e clique em "Criar"

### Como criar uma Unidade

1. Acesse o painel administrativo
2. Clique em "Unidades"
3. Selecione um hospital no filtro
4. Clique em "+ Nova Unidade"
5. Preencha o nome e clique em "Criar"

### Como criar um Convite

1. Acesse o painel administrativo
2. Clique em "Convites"
3. Preencha o formulário:
   - Instituto (obrigatório)
   - Hospital (opcional)
   - Unidade (opcional)
   - Profissão (obrigatório)
   - Nível de Acesso (obrigatório)
   - E-mail do convidado (opcional)
   - Tempo de expiração
4. Clique em "Criar Convite"
5. Copie o link gerado e envie para o convidado

### Como testar cadastro por convite

1. Crie um convite conforme instruções acima
2. Copie o link do convite
3. Abra uma aba anônima no navegador
4. Cole o link e acesse
5. Preencha o formulário de cadastro:
   - Nome completo
   - E-mail
   - CPF (11 dígitos)
   - Telefone
   - Registro Profissional
   - Senha (mín. 6 caracteres)
6. Clique em "Criar conta"
7. Você será redirecionado automaticamente para a página de perfil

### Validações implementadas
- Convites expiram após o período configurado (padrão: 7 dias)
- Convites não podem ser reutilizados após cadastro
- CPF deve ser único no sistema
- E-mail deve ser único no sistema
- Página do convite mostra mensagens claras para:
  - Token não encontrado
  - Convite expirado
  - Convite já utilizado

### Endpoints da API (Bloco 4)
| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| GET | /hospitals?instituteId= | JWT | Listar hospitais |
| GET | /hospitals/:id | JWT | Detalhes hospital |
| POST | /hospitals | JWT (ADMIN_MASTER) | Criar hospital |
| PATCH | /hospitals/:id | JWT (ADMIN_MASTER) | Atualizar hospital |
| GET | /units?hospitalId= | JWT | Listar unidades |
| GET | /units/:id | JWT | Detalhes unidade |
| POST | /units | JWT (ADMIN_MASTER) | Criar unidade |
| PATCH | /units/:id | JWT (ADMIN_MASTER) | Atualizar unidade |
| GET | /invites?instituteId= | JWT (ADMIN+) | Listar convites |

### Arquivos criados/modificados
- `apps/api/src/hospitals/dto/create-hospital.dto.ts`
- `apps/api/src/hospitals/dto/update-hospital.dto.ts`
- `apps/api/src/hospitals/hospitals.controller.ts`
- `apps/api/src/hospitals/hospitals.service.ts`
- `apps/api/src/units/dto/create-unit.dto.ts`
- `apps/api/src/units/dto/update-unit.dto.ts`
- `apps/api/src/units/units.controller.ts`
- `apps/api/src/units/units.service.ts`
- `apps/api/src/invites/invites.controller.ts`
- `apps/api/src/invites/invites.service.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/hospitais/page.tsx`
- `apps/web/src/app/admin/unidades/page.tsx`
- `apps/web/src/app/admin/convites/page.tsx`
- `apps/web/src/app/invite/[token]/page.tsx`
- `apps/web/src/app/me/page.tsx`

---

## Bloco 5 - Cursos, Aulas e Player YouTube com Progresso
**Status**: Concluído

### O que foi feito

#### API (NestJS)
- **CoursesModule**: CRUD de cursos
  - GET `/courses?instituteId=` - Listar cursos do instituto
  - GET `/courses/:id` - Detalhes do curso com módulos
  - POST `/courses` - Criar curso (ADMIN/MANAGER)
  - PATCH `/courses/:id` - Atualizar curso (ADMIN/MANAGER)

- **ModulesModule**: CRUD de módulos
  - GET `/modules?courseId=` - Listar módulos do curso
  - POST `/modules` - Criar módulo (ADMIN/MANAGER)
  - PATCH `/modules/:id` - Atualizar módulo (ADMIN/MANAGER)

- **LessonsModule**: CRUD de aulas + progresso
  - GET `/lessons?moduleId=` - Listar aulas do módulo
  - GET `/lessons/:id` - Detalhes da aula
  - POST `/lessons` - Criar aula (ADMIN/MANAGER)
  - PATCH `/lessons/:id` - Atualizar aula (ADMIN/MANAGER)
  - GET `/lessons/:id/progress` - Obter progresso do usuário
  - POST `/lessons/:id/progress` - Atualizar progresso (watchedSeconds)

#### Web (Next.js)
- `/professor/cursos` - Lista de cursos + criar novo
- `/professor/cursos/[id]` - Gerenciar módulos e aulas do curso
- `/cursos` - Lista de cursos para aluno
- `/curso/[id]` - Visualização do curso com módulos expandíveis
- `/aula/[id]` - Player YouTube com contagem de tempo
- `/quiz/[lessonId]` - Placeholder para quiz (será implementado no próximo bloco)

### Tracking de Progresso

O sistema de progresso funciona assim:

1. **Contagem de tempo**: Só conta quando:
   - Vídeo está tocando (PlayerState.PLAYING)
   - Aba do navegador está visível (document.visibilityState === 'visible')

2. **Salvamento**:
   - A cada 10 segundos via POST /lessons/:id/progress
   - Ao sair da página via navigator.sendBeacon
   - Ao trocar de aba (visibilitychange)

3. **Cálculo de conclusão**:
   - `watchedPct = floor((watchedSeconds / durationSeconds) * 100)`
   - `completed = watchedPct >= minWatchPercent` (padrão: 90%)

4. **Liberação do quiz**:
   - Quiz só aparece como clicável quando `completed = true`
   - Acesso direto à rota /quiz/[id] redireciona para /aula/[id] se não completou

### Como testar

```bash
# 1. Garantir que o banco está atualizado
cd apps/api
npx prisma db push

# 2. Iniciar servidores
cd ../..
pnpm dev

# 3. Login como admin
# http://localhost:3000/login
# admin@educacaocontinuada.com.br / admin123

# 4. Criar um curso
# http://localhost:3000/professor/cursos
# Clique em "+ Novo Curso"

# 5. Adicionar módulo e aula
# Acesse o curso criado
# Clique em "+ Novo Módulo"
# Clique em "+ Nova Aula"
# Preencha com um YouTube Video ID (ex: dQw4w9WgXcQ)

# 6. Testar como aluno
# http://localhost:3000/cursos
# Acesse o curso > módulo > aula
# Assista o vídeo e veja a barra de progresso
```

### Entidades de Progresso

```
VideoProgress {
  id
  userId        -> User
  lessonId      -> Lesson
  watchedSeconds
  watchedPct
  completed
  lastWatchedAt
}
```

### Endpoints da API (Bloco 5)
| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| GET | /courses?instituteId= | JWT | Listar cursos |
| GET | /courses/:id | JWT | Detalhes do curso |
| POST | /courses | JWT (ADMIN/MANAGER) | Criar curso |
| PATCH | /courses/:id | JWT (ADMIN/MANAGER) | Atualizar curso |
| GET | /modules?courseId= | JWT | Listar módulos |
| POST | /modules | JWT (ADMIN/MANAGER) | Criar módulo |
| PATCH | /modules/:id | JWT (ADMIN/MANAGER) | Atualizar módulo |
| GET | /lessons?moduleId= | JWT | Listar aulas |
| GET | /lessons/:id | JWT | Detalhes da aula |
| POST | /lessons | JWT (ADMIN/MANAGER) | Criar aula |
| PATCH | /lessons/:id | JWT (ADMIN/MANAGER) | Atualizar aula |
| GET | /lessons/:id/progress | JWT | Obter progresso |
| POST | /lessons/:id/progress | JWT | Atualizar progresso |

### Arquivos criados
- `apps/api/src/courses/*` - Módulo de cursos
- `apps/api/src/modules/*` - Módulo de módulos
- `apps/api/src/lessons/*` - Módulo de aulas
- `apps/web/src/app/professor/cursos/page.tsx`
- `apps/web/src/app/professor/cursos/[id]/page.tsx`
- `apps/web/src/app/cursos/page.tsx`
- `apps/web/src/app/curso/[id]/page.tsx`
- `apps/web/src/app/aula/[id]/page.tsx`
- `apps/web/src/app/quiz/[lessonId]/page.tsx`

---

## Bloco 6 - Quiz com Tentativas e Ciclos
**Status**: Concluído

### O que foi feito
- Sistema de quiz com 3 tentativas por ciclo
- Nota mínima de 70% para aprovação
- Bloqueio após 3 reprovações (exige reassistir aula)
- Registro de aprovação por aula (LessonApproval)

---

## Bloco 7 - Assignments, Deadlines e Rankings
**Status**: Concluído

### O que foi feito
- Atribuições de cursos com prazo
- Escopos: profissão no instituto, unidade completa, profissão na unidade
- Status: PENDING, IN_PROGRESS, COMPLETED_ON_TIME, COMPLETED_LATE
- Ranking por unidade/hospital com média de notas

---

## Bloco 8 - Certificados com PDF e QR Code
**Status**: Concluído

### O que foi feito
- Emissão automática de certificados ao completar curso
- PDF gerado com PDFKit
- QR Code para verificação pública
- Endpoint público `/verify/:code` para validar certificado
- Auditoria de emissão, download e verificação

---

## Bloco 9 - Suporte, Tickets, FAQ e Notificações
**Status**: Concluído

### O que foi feito

#### Schema Prisma
- **Ticket**: tickets de suporte com contexto (curso, aula, quiz, assignment)
- **TicketMessage**: mensagens em formato chat
- **TicketAttachment**: anexos (PNG, JPG, PDF até 5MB)
- **FAQ**: perguntas frequentes por curso
- **Notification**: notificações internas com tipos

#### API (NestJS)
- **TicketsModule**:
  - POST `/tickets` - Criar ticket (aluno)
  - GET `/me/tickets` - Listar meus tickets (aluno)
  - GET `/tickets/:id` - Detalhes do ticket com mensagens
  - POST `/tickets/:id/messages` - Adicionar mensagem
  - POST `/tickets/:id/attachments` - Anexar arquivo
  - PATCH `/tickets/:id/close` - Fechar ticket (autor)
  - GET `/tickets?status=&category=&from=&to=` - Listar tickets (gestor)
  - PATCH `/tickets/:id/status` - Mudar status (gestor)
  - PATCH `/tickets/:id/assign` - Atribuir responsável (gestor)
  - GET `/tickets/export.csv` - Exportar CSV (gestor)

- **FAQModule**:
  - GET `/courses/:courseId/faq` - FAQs publicadas do curso
  - GET `/courses/:courseId/faq/all` - Todas FAQs (gestor)
  - POST `/courses/:courseId/faq` - Criar FAQ (gestor)
  - PATCH `/faq/:id` - Atualizar FAQ
  - PATCH `/faq/:id/status` - Mudar status da FAQ
  - DELETE `/faq/:id` - Remover FAQ

- **NotificationsModule**:
  - GET `/me/notifications` - Listar notificações
  - GET `/me/notifications/count` - Contar não lidas
  - PATCH `/notifications/:id/read` - Marcar como lida
  - PATCH `/notifications/read-all` - Marcar todas como lidas

#### Web (Next.js)
- `/suporte` - Lista de tickets do aluno
- `/suporte/[id]` - Detalhe do ticket em formato chat
- `/gestor/tickets` - Painel de gestão de tickets
- `/notificacoes` - Lista de notificações
- `Header` com badge de notificações não lidas
- Botão "Dúvida" em `/aula/[id]` e `/quiz/[lessonId]`
- FAQ accordion na página `/curso/[id]`

### Regras de Notificação
- Ticket criado → notifica gestores
- Gestor responde → notifica criador do ticket
- Status muda para RESOLVED/CLOSED → notifica criador

### Como abrir ticket na aula
1. Acesse uma aula (`/aula/[id]`)
2. Clique no botão "Tenho uma dúvida sobre esta aula"
3. Preencha assunto e mensagem
4. O ticket é criado com contexto do curso e aula automaticamente

### Como abrir ticket no quiz
1. Durante o quiz, clique no botão "Dúvida" no rodapé
2. Preencha assunto e mensagem
3. O ticket é criado com contexto da aula e tentativa do quiz

### Como gestor responde e encerra
1. Acesse `/gestor/tickets`
2. Use os filtros para encontrar tickets
3. Clique no assunto para ver detalhes
4. Responda no campo de mensagem
5. Mude o status para "Resolvido" ou "Fechado"

### Como anexar arquivo
1. No detalhe do ticket, clique em "Anexar arquivo"
2. Selecione um arquivo (PNG, JPG ou PDF, máx 5MB)
3. O arquivo aparece na seção de anexos

### Como criar FAQ
1. Acesse `/professor/cursos/[id]` ou via API
2. Use POST `/courses/:courseId/faq` com question, answer e status
3. FAQs com status PUBLISHED aparecem para alunos na página do curso

### Como testar notificações
1. Crie um ticket como aluno
2. Faça login como gestor e responda
3. Volte ao aluno e veja o badge de notificação
4. Clique no sino para ver a notificação

### Exportar CSV de tickets
1. Acesse `/gestor/tickets`
2. Opcionalmente filtre por período (De/Até)
3. Clique em "Exportar CSV"
4. O arquivo é baixado com todos os tickets filtrados

### Endpoints da API (Bloco 9)
| Método | Rota | Autenticação | Descrição |
|--------|------|--------------|-----------|
| POST | /tickets | JWT | Criar ticket |
| GET | /me/tickets | JWT | Meus tickets |
| GET | /tickets/:id | JWT | Detalhes ticket |
| POST | /tickets/:id/messages | JWT | Enviar mensagem |
| POST | /tickets/:id/attachments | JWT | Anexar arquivo |
| PATCH | /tickets/:id/close | JWT | Fechar ticket |
| GET | /tickets | JWT (GESTOR+) | Listar tickets |
| PATCH | /tickets/:id/status | JWT (GESTOR+) | Mudar status |
| PATCH | /tickets/:id/assign | JWT (GESTOR+) | Atribuir |
| GET | /tickets/export.csv | JWT (GESTOR+) | Exportar CSV |
| GET | /courses/:id/faq | JWT | FAQs do curso |
| POST | /courses/:id/faq | JWT (GESTOR+) | Criar FAQ |
| PATCH | /faq/:id | JWT (GESTOR+) | Atualizar FAQ |
| DELETE | /faq/:id | JWT (GESTOR+) | Remover FAQ |
| GET | /me/notifications | JWT | Minhas notificações |
| GET | /me/notifications/count | JWT | Não lidas |
| PATCH | /notifications/:id/read | JWT | Marcar lida |
| PATCH | /notifications/read-all | JWT | Marcar todas |

### Arquivos criados
- `apps/api/src/tickets/*` - Módulo de tickets
- `apps/api/src/faq/*` - Módulo de FAQ
- `apps/api/src/notifications/*` - Módulo de notificações
- `apps/api/storage/tickets/` - Armazenamento de anexos
- `apps/web/src/app/suporte/page.tsx`
- `apps/web/src/app/suporte/[id]/page.tsx`
- `apps/web/src/app/gestor/tickets/page.tsx`
- `apps/web/src/app/notificacoes/page.tsx`
- `apps/web/src/components/Header.tsx`

---

## Bloco 10B - Competencias no Tempo, Revisoes 7/30/90, Mapa de Risco
**Status**: Concluido

### O que foi feito

#### Schema Prisma
- **Competency**: competencias do instituto com nome e descricao
- **LessonCompetency**: liga competencias a aulas (N:N)
- **CompetencyQuestionBank**: banco de questoes por competencia
- **CompetencyReviewSchedule**: agendamentos de revisao (7/30/90 dias)
- **UserCompetencyState**: estado da competencia do usuario (GREEN/YELLOW/ORANGE/RED)
- Novos tipos: ReviewScheduleStatus (DUE/DONE/OVERDUE), CompetencyState
- NotificationType expandido: REVIEW_DUE, COMPETENCY_DEGRADED

#### API (NestJS)

- **CompetenciesModule**:
  - POST `/competencies` - Criar competencia (gestor)
  - GET `/competencies` - Listar competencias do instituto
  - GET `/competencies/:id` - Detalhes com aulas e questoes
  - PATCH `/competencies/:id` - Atualizar competencia
  - DELETE `/competencies/:id` - Remover competencia
  - POST `/lessons/:lessonId/competencies` - Ligar competencias a aula
  - GET `/lessons/:lessonId/competencies` - Competencias da aula
  - POST `/competencies/:id/questions` - Adicionar questao ao banco
  - DELETE `/competencies/:id/questions/:questionId` - Remover questao
  - GET `/competencies/:id/questions` - Banco de questoes

- **ReviewsModule**:
  - GET `/me/reviews` - Revisoes pendentes do aluno
  - GET `/me/competencies` - Estados de competencias do aluno
  - POST `/reviews/:scheduleId/start` - Iniciar revisao (sorteia 3-5 questoes)
  - POST `/reviews/:scheduleId/submit` - Enviar revisao
  - GET `/gestor/risk-map?groupBy=UNIT|PROFESSION|UNIT_PROFESSION` - Mapa de risco agregado
  - GET `/gestor/risk-map/export.csv` - Exportar CSV do mapa

#### Integracao com Quiz
- Quando LessonApproval e criado (aluno aprovado no quiz da aula):
  - Para cada competencia ligada a aula, cria schedules em 7, 30 e 90 dias
  - Cria ou atualiza UserCompetencyState como GREEN

#### Web (Next.js)
- `/gestor/competencias` - CRUD de competencias do instituto
- `/professor/aulas/[id]/competencias` - Ligar competencias a uma aula
- `/revisoes` - Lista de revisoes pendentes e estados de competencias
- `/revisoes/[scheduleId]` - Executar revisao com questoes do banco
- `/gestor/risco` - Mapa de risco com tabs (Unidade/Profissao/Ambos)
- Home: Secao "Revisoes de hoje" + cards de acesso rapido

### Regras de Estado de Competencia
- **GREEN (>=80%)**: Competencia dominada
- **YELLOW (60-79%)**: Bom, mas precisa revisar
- **ORANGE (40-59%)**: Atencao, revisar logo
- **RED (<40%)**: Critico, precisa estudar novamente

### Degradacao Automatica
- Revisao nao feita: vira OVERDUE apos dueAt
- Apos 7 dias em OVERDUE: estado degrada automaticamente
  - GREEN -> YELLOW -> ORANGE -> RED

### Mapa de Risco (Gestor)
- Agrupamento por Unidade, Profissao ou ambos
- Mostra contagem de usuarios por estado (sem identificar individuos)
- Exportacao CSV para analise

### Como testar

1. **Criar competencia**:
   - Acesse `/gestor/competencias`
   - Clique em "+ Nova Competencia"
   - Preencha nome e descricao

2. **Ligar competencia a aula**:
   - Acesse `/professor/aulas/[id]/quiz-editor`
   - Clique em "Gerenciar Competencias"
   - Selecione as competencias e salve

3. **Aprovar em aula com competencia**:
   - Complete o video
   - Passe no quiz
   - Schedules de revisao serao criados automaticamente

4. **Fazer revisao**:
   - Acesse `/revisoes`
   - Clique em "Fazer Revisao"
   - Responda as questoes
   - Veja seu novo estado

5. **Ver mapa de risco**:
   - Acesse `/gestor/risco`
   - Alterne entre abas para diferentes agrupamentos
   - Exporte CSV se necessario

### Endpoints da API (Bloco 10B)
| Metodo | Rota | Autenticacao | Descricao |
|--------|------|--------------|-----------|
| POST | /competencies | JWT (GESTOR+) | Criar competencia |
| GET | /competencies | JWT | Listar competencias |
| GET | /competencies/:id | JWT | Detalhes competencia |
| PATCH | /competencies/:id | JWT (GESTOR+) | Atualizar |
| DELETE | /competencies/:id | JWT (GESTOR+) | Remover |
| POST | /lessons/:id/competencies | JWT (GESTOR+) | Ligar a aula |
| GET | /lessons/:id/competencies | JWT | Ver da aula |
| POST | /competencies/:id/questions | JWT (GESTOR+) | Add questao |
| DELETE | /competencies/:id/questions/:qid | JWT (GESTOR+) | Remover questao |
| GET | /competencies/:id/questions | JWT | Banco de questoes |
| GET | /me/reviews | JWT | Minhas revisoes |
| GET | /me/competencies | JWT | Meus estados |
| POST | /reviews/:id/start | JWT | Iniciar revisao |
| POST | /reviews/:id/submit | JWT | Enviar revisao |
| GET | /gestor/risk-map | JWT (GESTOR+) | Mapa de risco |
| GET | /gestor/risk-map/export.csv | JWT (GESTOR+) | Exportar CSV |

### Arquivos criados
- `apps/api/src/competencies/*` - Modulo de competencias
- `apps/api/src/reviews/*` - Modulo de revisoes
- `apps/web/src/app/gestor/competencias/page.tsx`
- `apps/web/src/app/professor/aulas/[id]/competencias/page.tsx`
- `apps/web/src/app/revisoes/page.tsx`
- `apps/web/src/app/revisoes/[scheduleId]/page.tsx`
- `apps/web/src/app/gestor/risco/page.tsx`

---

## Bloco 10A - UX, Busca Global, Home Inteligente, Retomar Aula
**Status**: Concluido

### O que foi feito

#### Schema Prisma
- **LessonLastSeen**: Registro de ultima aula acessada pelo usuario
- **Lesson**: Novos campos `practicalSummary` e `tomorrowChecklist`

#### API (NestJS)

- **SearchModule**:
  - GET `/search?q=` - Busca global em cursos, aulas, FAQs e competencias
  - Filtro por permissao: aluno ve so PUBLISHED, gestor ve DRAFT tambem
  - Retorna max 10 resultados por categoria

- **HomeModule**:
  - GET `/me/home` - Dados agregados para home inteligente
  - **Aluno**: pendingAssignments, dueReviews, continueLesson, recentCertificates
  - **Gestor**: summary (activeAssignments, openTickets, onTimePercentage, redCompetencies), recentTickets

- **LessonsModule** atualizado:
  - GET `/lessons/:id` agora registra LessonLastSeen automaticamente
  - Novos campos retornados: practicalSummary, tomorrowChecklist

#### Web (Next.js)

- **SearchCommand**: Command palette estilo Ctrl+K
  - Busca em tempo real com debounce
  - Navegacao por teclado (setas + Enter)
  - Resultados agrupados por tipo
  - Abre modal sobre qualquer pagina

- **Home** atualizada:
  - **Aluno**:
    - Card "Continuar de onde parou" com aula e progresso
    - Alertas de revisoes pendentes
    - Alertas de atribuicoes pendentes
    - Certificados recentes
  - **Gestor**:
    - Cards de metricas do mes (atribuicoes ativas, chamados abertos, % no prazo, competencias em risco)
    - Lista de chamados recentes

- **Pagina de aula** atualizada:
  - Card "Resumo Pratico" (se preenchido)
  - Card "O que fazer amanha no plantao" (se preenchido)

- **Componentes reutilizaveis**:
  - `EmptyState`: Estado vazio padronizado com icone, titulo, descricao e acao
  - `LoadingState`: Estados de carregamento (spinner, skeleton, dots)

### Como usar busca global
1. Clique no botao de busca no header ou pressione Ctrl+K (Cmd+K no Mac)
2. Digite pelo menos 2 caracteres
3. Use setas para navegar, Enter para abrir
4. ESC para fechar

### Como adicionar resumo pratico a uma aula
1. Acesse `/professor/cursos/[id]`
2. Edite uma aula
3. Preencha os campos "Resumo Pratico" e "O que fazer amanha"
4. Salve

### Como retomar aula do ponto salvo
1. Assista uma aula parcialmente
2. Volte a home
3. Se houver aula incompleta, aparece o card "Continuar de onde parou"
4. Clique para ir direto a aula

### Endpoints da API (Bloco 10A)
| Metodo | Rota | Autenticacao | Descricao |
|--------|------|--------------|-----------|
| GET | /search?q= | JWT | Busca global |
| GET | /me/home | JWT | Dados da home |

### Arquivos criados
- `apps/api/src/search/*` - Modulo de busca
- `apps/api/src/home/*` - Modulo de home
- `apps/web/src/components/SearchCommand.tsx`
- `apps/web/src/components/EmptyState.tsx`
- `apps/web/src/components/LoadingState.tsx`
- `apps/web/src/app/page.tsx` (atualizado)
- `apps/web/src/app/aula/[id]/page.tsx` (atualizado)
- `apps/web/src/components/Header.tsx` (atualizado)