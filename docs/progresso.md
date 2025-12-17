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
