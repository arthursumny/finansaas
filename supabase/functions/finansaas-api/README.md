# FinansaaS Agent API

Edge Function para um agente de IA, como um bot do Telegram, consultar e alimentar o FinansaaS.

## Rotas

- `GET /docs`: Swagger UI.
- `GET /openapi.json`: contrato OpenAPI.
- `GET /health`: status publico.
- `GET /summary`: saldo, receitas, despesas e totais por categoria.
- `GET /charts/monthly-evolution`: serie mensal para grafico de receitas, despesas e saldo.
- `GET /charts/category-breakdown`: distribuicao por categoria.
- `GET /charts/cashflow`: fluxo de caixa acumulado por dia.
- `POST /agent/categorize`: sugestao de categoria para um lancamento.
- `GET /categories` e `POST /categories`.
- `GET /tags`, `POST /tags`, `PATCH /tags/{id}` e `DELETE /tags/{id}`.
- `GET /transactions`, `POST /transactions`, `GET/PATCH/DELETE /transactions/{id}`. Ao criar transacao sem `category`, a API tenta categorizar automaticamente.

## Autenticacao

A API aceita duas formas:

1. `Authorization: Bearer <supabase_access_token>` para usar o JWT do usuario.
2. `X-Finansaas-Api-Key: <chave>` para integracoes como Telegram.

Para usar chave de integracao, gere o token pela tela `API` dentro do Dashboard.

Tambem existe compatibilidade por secret, util para integracoes administradas:

```bash
supabase secrets set FINANSAAS_API_KEYS='{"chave-do-telegram":"uuid-do-usuario"}'
```

Tambem funciona como lista:

```bash
supabase secrets set FINANSAAS_API_KEYS='[{"key":"chave-do-telegram","user_id":"uuid-do-usuario"}]'
```

## Deploy

```bash
supabase functions deploy finansaas-api
```

URL esperada:

```text
https://<project-ref>.supabase.co/functions/v1/finansaas-api/docs
```

## Exemplo para agente

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/finansaas-api/transactions' \
  -H 'Content-Type: application/json' \
  -H 'X-Finansaas-Api-Key: chave-do-telegram' \
  -d '{
    "type": "expense",
    "description": "Almoco",
    "amount": 42.5,
    "date": "2026-05-07",
    "category": "Alimentacao",
    "status": "paid"
  }'
```

Criar transacao com categoria automatica:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/finansaas-api/transactions' \
  -H 'Content-Type: application/json' \
  -H 'X-Finansaas-Api-Key: fs_token_gerado_na_interface' \
  -d '{
    "type": "expense",
    "description": "Uber para reuniao",
    "amount": 28.9,
    "date": "2026-05-18",
    "status": "paid"
  }'
```

Buscar dados para grafico:

```bash
curl 'https://<project-ref>.supabase.co/functions/v1/finansaas-api/charts/monthly-evolution?months=6' \
  -H 'X-Finansaas-Api-Key: fs_token_gerado_na_interface'
```

Listar tags para aplicar em transacoes:

```bash
curl 'https://<project-ref>.supabase.co/functions/v1/finansaas-api/tags' \
  -H 'X-Finansaas-Api-Key: fs_token_gerado_na_interface'
```

Criar tag:

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/finansaas-api/tags' \
  -H 'Content-Type: application/json' \
  -H 'X-Finansaas-Api-Key: fs_token_gerado_na_interface' \
  -d '{"name":"trabalho","color":"#2563eb"}'
```
