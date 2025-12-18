# Backup e Restore - Educacao Continuada

Este documento descreve os procedimentos de backup e restore do sistema.

## Visao Geral

O sistema utiliza Supabase Postgres como banco de dados. O backup pode ser feito de duas formas:
1. **Export de conteudo (JSON)** - Para transferir cursos entre ambientes
2. **Dump completo do banco** - Para backup de seguranca

---

## 1. Export/Import de Conteudo (JSON)

### Exportar um Curso

Via interface web:
1. Acesse `/gestor/conteudo/exportar`
2. Selecione o curso desejado
3. Clique em "Exportar JSON"
4. O arquivo sera baixado automaticamente

Via API:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.seudominio.com/gestor/export/course/{courseId} \
  -o curso-backup.json
```

### O que e exportado:
- Dados do curso (titulo, descricao, status)
- Modulos com ordem
- Aulas (video, duracao, resumo pratico, checklist)
- Quizzes (nota minima, questoes, opcoes)
- Competencias e ligacoes aula-competencia
- Banco de questoes por competencia
- FAQ do curso

### O que NAO e exportado:
- Progresso de usuarios
- Tentativas de quiz
- Certificados emitidos
- Tickets de suporte
- Atribuicoes (assignments)
- Logs de auditoria

### Importar um Curso

Via interface web:
1. Acesse `/gestor/conteudo/importar`
2. Selecione o arquivo JSON exportado
3. Clique em "Analisar (Dry Run)" para validar
4. Revise o relatorio de contagens e avisos
5. Se nao houver erros, clique em "Aplicar Importacao"

O curso importado:
- Recebe novos IDs (nao sobrescreve dados existentes)
- Fica com status DRAFT
- Inclui metadados de rastreio (externalId, importBatchId)

---

## 2. Backup Completo do Banco (Supabase)

### Pre-requisitos
- Acesso ao painel do Supabase
- Ou acesso via psql/pg_dump

### Exportar via Supabase Dashboard

1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Va em Settings > Database
4. Na secao "Database Backups", clique em "Download backup"

### Exportar via pg_dump

```bash
# Obter a connection string no Supabase Dashboard
# Settings > Database > Connection string > URI

pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-acl \
  -f backup-$(date +%Y%m%d).dump
```

### Restaurar em Outro Projeto

1. Crie um novo projeto no Supabase
2. Obtenha a connection string do novo projeto
3. Restaure o backup:

```bash
pg_restore --clean --if-exists \
  -d "postgresql://postgres:[PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" \
  backup-20241218.dump
```

4. Execute as migrations do Prisma para garantir schema atualizado:

```bash
cd apps/api
npx prisma db push
```

---

## 3. Rotina de Backup Recomendada

### Backup Semanal
- Todo domingo as 03:00
- Manter ultimos 4 backups semanais

### Backup Antes de Releases
- Antes de deploy em producao
- Antes de migrations que alteram schema
- Antes de import de conteudo em massa

### Checklist Pre-Release
1. [ ] Backup do banco via pg_dump
2. [ ] Export JSON dos cursos principais
3. [ ] Verificar espaco disponivel no storage
4. [ ] Testar restore em ambiente de staging

---

## 4. Verificacao de Integridade

Apos restaurar um backup, verificar:

```sql
-- Contagem de registros principais
SELECT
  (SELECT COUNT(*) FROM courses) as cursos,
  (SELECT COUNT(*) FROM modules) as modulos,
  (SELECT COUNT(*) FROM lessons) as aulas,
  (SELECT COUNT(*) FROM quizzes) as quizzes,
  (SELECT COUNT(*) FROM users) as usuarios,
  (SELECT COUNT(*) FROM certificates) as certificados;
```

---

## 5. Contatos e Suporte

Em caso de problemas com backup/restore:
1. Verificar logs no Supabase Dashboard
2. Consultar documentacao Supabase: https://supabase.com/docs/guides/database/backups
3. Abrir ticket de suporte se necessario

---

*Ultima atualizacao: Dezembro 2024*
