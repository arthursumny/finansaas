# FinansaaS Agent API

Edge Function para um agente de IA, como um bot do Telegram, consultar e alimentar o FinansaaS.

## Rotas

- `GET /docs`: Swagger UI.
- `GET /openapi.json`: contrato OpenAPI.
- `GET /health`: status publico.
- `GET /summary`: saldo, receitas, despesas e totais por categoria.
- `GET /categories` e `POST /categories`.
- `GET /transactions`, `POST /transactions`, `GET/PATCH/DELETE /transactions/{id}`.

## Autenticacao

A API aceita duas formas:

1. `Authorization: Bearer <supabase_access_token>` para usar o JWT do usuario.
2. `X-Finansaas-Api-Key: <chave>` para integracoes como Telegram.

Para usar chave de integracao, configure o secret da function:

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
