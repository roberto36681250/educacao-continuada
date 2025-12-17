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
