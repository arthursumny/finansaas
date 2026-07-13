# Manual de acesso do LLM à API FinansaaS

> **Estado em 13/07/2026:** o domínio e o HTTPS estão ativos. As rotas públicas
> deste manual já estão implementadas no código Express/SQLite, mas precisam de
> um novo deploy para entrar em produção. Até esse deploy, o domínio continuará
> respondendo `404` em `/api/transactions`.

## 1. Finalidade

Esta API permite que um agente de IA consulte e registre informações financeiras
do usuário autenticado. Cada chave pertence a um único usuário. O agente nunca
deve enviar ou aceitar um `user_id`: o servidor determina o usuário pela chave.

## 2. Endereço e autenticação

- URL base: `https://finansaas.online/api`
- Formato: JSON sobre HTTPS
- Header de autenticação: `X-Finansaas-Api-Key`
- Header de conteúdo em requisições com corpo: `Content-Type: application/json`

Exemplo:

```http
GET /api/summary HTTP/1.1
Host: finansaas.online
X-Finansaas-Api-Key: SUA_CHAVE
Accept: application/json
```

A chave deve ficar em variável de ambiente ou no cofre de segredos da ferramenta:

```text
FINANSAAS_API_KEY=fs_CHAVE_GERADA_NO_DASHBOARD
```

Nunca coloque a chave em mensagens, logs, respostas ao usuário, código versionado
ou parâmetros da URL. Nunca use `/api/query`: essa é uma rota interna do frontend,
não faz parte da API para agentes.

## 3. Permissões

Uma chave padrão poderá ter estes escopos:

- `transactions:read`: consultar lançamentos.
- `transactions:write`: criar, alterar e excluir lançamentos.
- `categories:read`: consultar categorias.
- `categories:write`: criar categorias.
- `charts:read`: consultar resumo e séries agregadas.

As consultas de tags usam `transactions:read`, e as gravações de tags usam
`transactions:write`, pois tags fazem parte dos lançamentos.

O agente só pode acessar dados do dono da chave. Resposta `401` significa chave
ausente, inválida ou revogada. Resposta `403` significa que falta o escopo exigido.

## 4. Regras obrigatórias para o agente

1. Use datas no formato `AAAA-MM-DD` e valores monetários como números positivos.
2. Use `income` para receita e `expense` para despesa.
3. Use `paid` para pago/recebido e `pending` para pendente.
4. Antes de gravar, confirme com o usuário qualquer valor, data, tipo ou status ambíguo.
5. Mostre um resumo e peça confirmação antes de excluir dados.
6. Para alterar ou excluir, primeiro localize o lançamento e use seu UUID exato.
7. Não invente UUIDs, categorias, tags, valores ou datas.
8. Não repita automaticamente um `POST` após timeout: a API ainda não possui chave
   de idempotência e a repetição pode criar lançamentos duplicados.
9. Nunca tente acessar outro usuário nem envie `user_id` no corpo.
10. Não use `/api/query`, `/api/auth/*` ou qualquer rota que não esteja neste manual.

## 5. Endpoints

### Disponibilidade

`GET /health` — público, não exige chave.

### Resumo e gráficos

- `GET /summary?from=AAAA-MM-DD&to=AAAA-MM-DD&status=paid`
- `GET /charts/monthly-evolution?months=6&status=paid`
- `GET /charts/category-breakdown?from=AAAA-MM-DD&to=AAAA-MM-DD&type=expense&status=paid`
- `GET /charts/cashflow?from=AAAA-MM-DD&to=AAAA-MM-DD&status=paid`

Parâmetros são opcionais. `months` aceita de 1 a 36.

### Categorias

- `GET /categories`
- `GET /categories?type=income`
- `GET /categories?type=expense`
- `POST /categories`

Corpo para criação:

```json
{
  "name": "Mercado",
  "type": "expense"
}
```

### Tags

- `GET /tags`
- `POST /tags`
- `PATCH /tags/{id}`
- `DELETE /tags/{id}`

Corpo para criação ou alteração:

```json
{
  "name": "trabalho",
  "color": "#2563eb"
}
```

Uma tag associada a lançamentos pode retornar `409` ao ser excluída.

### Transações

- `GET /transactions`
- `GET /transactions/{id}`
- `POST /transactions`
- `PATCH /transactions/{id}`
- `DELETE /transactions/{id}`

Filtros disponíveis na listagem:

- `from` e `to`: intervalo de datas.
- `type`: `income` ou `expense`.
- `status`: `paid` ou `pending`.
- `category`: nome exato da categoria.
- `limit`: de 1 a 100; padrão 50.

Exemplo de criação:

```json
{
  "type": "expense",
  "description": "Almoço",
  "amount": 42.50,
  "date": "2026-07-13",
  "category": "Alimentação",
  "status": "paid",
  "tag_ids": []
}
```

Campos obrigatórios: `type`, `description`, `amount`, `date` e `status`.
`category` pode ser omitida para a API tentar sugerir uma categoria. Campos
opcionais de recorrência: `is_recurring`, `recurrence_type` (`monthly` ou
`yearly`) e `recurrence_count` (1 a 120).

Exemplo de alteração parcial:

```json
{
  "status": "paid",
  "amount": 45.90
}
```

### Sugestão de categoria

`POST /agent/categorize` — requer `categories:read`.

```json
{
  "description": "Uber para reunião",
  "type": "expense",
  "amount": 28.90
}
```

## 6. Exemplos com curl

```bash
curl -sS 'https://finansaas.online/api/summary' \
  -H "X-Finansaas-Api-Key: $FINANSAAS_API_KEY"
```

```bash
curl -sS 'https://finansaas.online/api/transactions?from=2026-07-01&to=2026-07-31&limit=100' \
  -H "X-Finansaas-Api-Key: $FINANSAAS_API_KEY"
```

```bash
curl -sS -X POST 'https://finansaas.online/api/transactions' \
  -H 'Content-Type: application/json' \
  -H "X-Finansaas-Api-Key: $FINANSAAS_API_KEY" \
  --data '{"type":"expense","description":"Almoço","amount":42.50,"date":"2026-07-13","category":"Alimentação","status":"paid"}'
```

## 7. Respostas e erros

Consultas e gravações retornam normalmente:

```json
{
  "data": {}
}
```

Listagens retornam `data` como array. Exclusões bem-sucedidas retornam `204` sem
corpo. Trate os códigos:

- `400`: requisição malformada.
- `401`: chave inválida, ausente ou revogada.
- `403`: chave sem permissão para a operação.
- `404`: rota ou registro não encontrado.
- `409`: conflito, como tag em uso.
- `422`: campo inválido ou ausente.
- `500`: falha interna; não repita gravações automaticamente.

## 8. Prompt de sistema sugerido

```text
Você é um assistente financeiro conectado à API FinansaaS.

Use somente rotas documentadas sob https://finansaas.online/api.
Autentique cada chamada usando X-Finansaas-Api-Key obtida do cofre de segredos.
Nunca revele, imprima ou repita a chave. Nunca use /api/query ou /api/auth.

Antes de criar uma transação, determine tipo, descrição, valor positivo, data e
status. Se algum dado estiver ambíguo, pergunte ao usuário. Antes de excluir,
mostre o registro encontrado e peça confirmação explícita. Não invente dados ou
UUIDs. Não repita POST, PATCH ou DELETE automaticamente depois de timeout.

Traduza income como receita, expense como despesa, paid como pago/recebido e
pending como pendente. Depois de uma gravação bem-sucedida, informe objetivamente
o que foi registrado e o identificador retornado.
```

## 9. Teste antes de liberar o agente

Execute nesta ordem:

```bash
curl -i 'https://finansaas.online/api/health'
curl -i 'https://finansaas.online/api/openapi.json'
curl -i 'https://finansaas.online/api/transactions?limit=1' \
  -H "X-Finansaas-Api-Key: $FINANSAAS_API_KEY"
```

Somente libere o agente quando os resultados forem, respectivamente, `200`,
`200` e `200` no domínio de produção.
