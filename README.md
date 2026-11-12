# FinanSaaS 💰

> Sistema completo de gestão financeira pessoal e empresarial leve, moderno e autônomo, construído para controle total de receitas, despesas, orçamentos, cartões de crédito e metas.

---

## 📌 Sobre o Projeto

O **FinanSaaS** é uma aplicação completa de gestão financeira pessoal projetada para ser ágil, responsiva e pronta para auto-hospedagem (self-hosted). O sistema oferece controle refinado sobre suas finanças, permitindo operar de forma 100% autônoma com backend Node.js e banco SQLite local em arquivo, ou opcionalmente integrado ao Supabase para autenticação e edge functions.

### ✨ Principais Funcionalidades

Baseado no código-fonte e histórico de desenvolvimento:

- 💵 **Gestão de Receitas e Despesas**: Cadastro detalhado com valor, data de vencimento/pagamento, status (pago/pendente), suporte a descontos, abatimentos e lançamentos recorrentes.
- 🏷️ **Categorias e Tags**: Organização de gastos por categorias personalizadas (com cores e ícones) e marcadores (tags) flexíveis.
- 📊 **Orçamentos por Categoria (Budgets)**: Definição de limites mensais e anuais por categoria de despesa, acompanhamento percentual com barras de progresso e alertas visuais de estouro de teto orçamentário.
- 💳 **Cartões de Crédito com Limite**:
  - Cadastro de múltiplos cartões físicos ou virtuais com bandeira, cor e limite de crédito.
  - Suporte a cartões adicionais com compartilhamento de limite e herança do titular.
  - Acompanhamento de limite total, limite utilizado e limite disponível em tempo real.
- 📅 **Ciclo de Fatura e Parcelamento de Compras**:
  - Configuração de dias de fechamento (melhor dia de compra) e dias de vencimento.
  - Divisão automática de compras parceladas com competência precisa nas faturas subsequentes.
  - Gestão de status de fatura (aberta, fechada e paga) e antecipação/estorno de parcelas.
- 📈 **Gráficos e Relatórios Visuais**:
  - Evolução mensal comparativa de receitas versus despesas (últimos 6 meses).
  - Gráfico de pizza com distribuição de despesas por categoria.
  - Visão consolidada de saldo acumulado e fluxo de caixa.
- 🎯 **Metas de Economia (Goals)**: Definição de metas financeiras (curto, médio e longo prazo) com registro de aportes/retiradas e celebração de progresso atingido.
- 🔍 **Filtros Avançados e Busca Inteligente**:
  - Filtros combináveis por período, categoria, faixa de valor e status de pagamento.
  - Busca rápida por descrição com histórico recente e sugestões contextuais.
- 🔄 **Assinaturas Recorrentes**: Painel para monitoramento de serviços por assinatura periódica.
- 📥 **Importação e Exportação**:
  - Importação de extratos bancários em formato CSV com pré-visualização e mapeamento de categorias.
  - Exportação de dados e relatórios completos em formato PDF e planilhas Excel/CSV.
- 🤖 **API Pública e Integrações para Agentes / LLMs**:
  - Emissão e gestão de tokens de API (`X-Finansaas-Api-Key`) com escopos granulares de leitura e escrita.
  - Documentação OpenAPI e Swagger integrada em `/api/docs` e `/api/openapi.json`.
- 🔐 **Autenticação e Segurança**:
  - Sessões locais criptografadas com tokens hasheados em SHA-256 no SQLite.
  - Proteção contra força bruta com rate limiting configurável por IP e por email.
  - Suporte a confirmação de conta e recuperação de senha via email transacional.
- 🌓 **Tema Claro e Escuro**: Suporte completo a Dark Mode persistente via CSS variables.

---

## 🛠️ Stack Tecnológica

- **Frontend**:
  - [React 19](https://react.dev/) / React 18
  - [Vite](https://vitejs.dev/) (Build tool e servidor de desenvolvimento ultra-rápido)
  - [TypeScript](https://www.typescriptlang.org/) (Tipagem estática estrita)
  - [Tailwind CSS](https://tailwindcss.com/) (Estilização utilitária moderna)
  - [shadcn/ui](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/) (Componentes acessíveis e customizáveis)
  - [Recharts](https://recharts.org/) (Visualização de dados e gráficos interativos)
  - [Lucide React](https://lucide.dev/) (Ícones)
- **Backend (`server/`)**:
  - [Node.js](https://nodejs.org/)
  - [Express](https://expressjs.com/) (API REST leve e performática)
  - [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite embarcado em modo WAL para alta velocidade e persistência simples)
  - Resend (Envio transacional de emails de ativação e recuperação de senha)
- **Autenticação e Nuvem (Opcional)**:
  - Backend próprio com sessões SQLite locais como padrão autônomo.
  - Suporte legado/alternativo ao [Supabase](https://supabase.com/) para autenticação via GoTrue e edge functions.
- **Deploy & Contêineres**:
  - [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (Build multi-stage gerando container único com a API Express servindo os assets estáticos do frontend).

---

## 🚀 Como Rodar Localmente

### Pré-requisitos

- **Node.js** (versão 20 ou superior recomendada) e **npm**
- Ou **Docker** e **Docker Compose**

### 1. Clonar o repositório e instalar dependências

```bash
git clone https://github.com/arthursumny/finansaas.git
cd finansaas
npm install
```

### 2. Configurar as variáveis de ambiente

Copie o arquivo de exemplo para criar seu `.env`:

```bash
cp .env.compose.example .env
```

### 3. Executar em Desenvolvimento

#### Frontend:
Para iniciar o servidor Vite de desenvolvimento:

```bash
npm run dev
```

Por padrão, a interface de desenvolvimento estará disponível em `http://localhost:8080`.

#### Backend (API Express):
Em outro terminal, inicie a API local:

```bash
node server/index.js
```

A API iniciará na porta configurada (padrão `3001` ou conforme variável `PORT`).

---

### 🐳 Execução via Docker Compose (Porta 8096)

Para rodar a aplicação completa pronta para uso (frontend compilado + backend Express + banco de dados SQLite persistido em volume):

```bash
# Iniciar os containers em segundo plano
docker compose --env-file .env up -d --build
```

A aplicação estará disponível em:
👉 **`http://localhost:8096`**

Para parar a execução:
```bash
docker compose down
```

---

## 🔑 Variáveis de Ambiente

As configurações do projeto são gerenciadas por variáveis de ambiente. Abaixo estão listadas as chaves disponíveis:

### Servidor e Aplicação
- `APP_PORT`: Porta exposta no host pelo Docker Compose (padrão: `8096`).
- `PORT`: Porta interna de escuta da API Express (padrão: `3001`).
- `VITE_API_URL`: Prefixo de chamada da API pelo frontend (ex: `/api`).
- `APP_PUBLIC_URL`: URL pública base da aplicação (usada nos links de confirmação e recuperação de senha).
- `DATA_DIR`: Diretório onde o arquivo de banco SQLite é armazenado.
- `DATABASE_PATH`: Caminho absoluto ou relativo para o arquivo `.sqlite`.
- `SERVE_STATIC_DIR`: Diretório onde estão os arquivos estáticos do build do frontend para o Express servir em produção.

### Email Transacional (Opcional)
- `RESEND_API_KEY`: Chave de API do serviço Resend.
- `EMAIL_FROM`: Endereço de email remetente (ex: `noreply@seudominio.com`).
*(Nota: Se não informadas, o envio de email fica em modo mock e os links de confirmação/reset são exibidos no console do servidor).*

### Segurança e Rate Limiting
- `AUTH_SIGNIN_LIMIT`: Quantidade máxima de tentativas de login permitidas por janela de tempo.
- `AUTH_SIGNIN_EMAIL_LIMIT`: Quantidade máxima de tentativas de login por email específico.

### Integração Supabase (Opcional)
- `VITE_SUPABASE_URL`: URL do projeto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Chave anônima/pública do Supabase.
- `VITE_SUPABASE_PROJECT_ID`: Identificador do projeto no Supabase.

---

## 📁 Estrutura de Pastas

```text
finansaas/
├── docs/                   # Manuais e documentações (ex: integração com LLM/agentes)
├── public/                 # Assets públicos, ícones e logos
├── server/                 # Backend Node.js / Express
│   ├── index.js            # Servidor principal, inicialização do SQLite e rotas REST
│   ├── cards.js            # Lógica de cartões, ciclo de fatura e limites
│   ├── installments.js     # Divisão de parcelas e competências de fatura
│   ├── public-api.js       # Endpoints públicos para agentes com autenticação por token
│   ├── email.js            # Módulo de envio de emails transacionais (Resend)
│   ├── Dockerfile          # Imagem Docker multi-stage (build Vite + runtime Node.js)
│   └── *.test.js           # Testes unitários e de integração do backend
├── src/                    # Código-fonte do Frontend (React + TypeScript)
│   ├── components/         # Componentes da interface
│   │   ├── charts/         # Componentes de visualização gráfica
│   │   ├── filters/        # Filtros de busca e listagem
│   │   └── ui/             # Componentes de design system (shadcn/ui e Radix)
│   ├── contexts/           # Contextos React (ThemeContext, etc.)
│   ├── hooks/              # Custom hooks para lógica de negócios e dados
│   ├── integrations/       # Clientes de integração (API local e suporte Supabase)
│   ├── lib/                # Funções utilitárias e helpers
│   ├── pages/              # Páginas da aplicação (Dashboard, Settings, Auth, etc.)
│   ├── App.tsx             # Roteador principal da aplicação
│   └── main.tsx            # Ponto de entrada do React
├── supabase/               # Configurações, migrações SQL e Edge Functions do Supabase
├── docker-compose.yml      # Orquestração do container Docker para produção local/VPS
├── .env.compose.example    # Arquivo modelo de variáveis de ambiente
├── package.json            # Dependências e scripts do projeto
├── tailwind.config.ts      # Configuração do Tailwind CSS
├── tsconfig.json           # Configurações de TypeScript
└── vite.config.ts          # Configuração do bundler Vite
```

---

## 🧪 Como Rodar os Testes

O projeto utiliza o runner nativo de testes do Node.js (`node:test`) para os testes de integração e regras de negócio do backend:

```bash
# Executar todos os testes do backend
npm test
```

Ou diretamente via Node.js:

```bash
node --test server/*.test.js
```

### Verificação de Tipos e Build

Para validar os tipos TypeScript em todo o frontend:

```bash
npm run typecheck
```

Para gerar o build de produção do frontend:

```bash
npm run build
```

---

## 📄 Licença

Este projeto está licenciado sob a licença [MIT](LICENSE) — consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

Copyright (c) 2026 Arthur Sumny Saggin
