# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f80b2f27-caec-46f3-b056-2f50866ff9a7

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f80b2f27-caec-46f3-b056-2f50866ff9a7) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

### VPS com Docker Compose

Esta branch roda fora da Vercel e sem Supabase. A stack local é:

- `app`: API Node/Express servindo também o build Vite
- `finansaas-data`: volume Docker com o SQLite em `/data/finansaas.sqlite`

O frontend mantém os hooks existentes, mas `src/integrations/supabase/client.ts` agora é um cliente local que fala com `/api`. Não há GoTrue, PostgREST, RLS ou chaves Supabase no runtime.

```sh
cp .env.compose.example .env.compose
docker compose --env-file .env.compose up -d --build
```

Depois acesse:

```sh
http://localhost:8096
```

Para VPS com domínio, ajuste no `.env.compose`:

```sh
APP_PORT=8096
```

O app ficará disponível na porta configurada:

```sh
http://SEU_SERVIDOR:8096
```

Para backup, copie o arquivo SQLite do volume Docker ou monte `api` em um diretório do host no `docker-compose.yml`.

### API Keys

Os tokens gerados em `Dashboard > API` ficam no SQLite, com hash SHA-256. Para integrações externas, envie o token no header:

```sh
X-Finansaas-Api-Key: fs_token_gerado_na_interface
```

A API local aceita esse header nos endpoints `/api/*` que exigem autenticação e atualiza `last_used_at` quando a chave é usada. Chaves revogadas deixam de autenticar.

Rotas públicas para agentes:

- `GET /api/docs` e `GET /api/openapi.json`
- `GET /api/summary` e `GET /api/charts/*`
- `GET/POST /api/categories`
- `GET/POST /api/tags` e `PATCH/DELETE /api/tags/:id`
- `GET/POST /api/transactions` e `GET/PATCH/DELETE /api/transactions/:id`

O endpoint `/api/query` é exclusivo do frontend autenticado por sessão e rejeita API keys. Consulte `docs/LLM_API_MANUAL.md` para o contrato de integração e as regras de segurança.

### Dokploy

No Dokploy, use o `docker-compose.yml` e aponte o domínio para:

- Serviço: `app`
- Porta interna: `3001`

O Traefik do Dokploy faz o proxy externo e HTTPS. Não precisa Nginx/Caddy no projeto.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
