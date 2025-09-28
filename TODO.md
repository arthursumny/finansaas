# 📋 TODO - FinanceApp

## 🎯 Funcionalidades Futuras

### 🟢 **Prioridade Alta - Fácil Implementação**

#### 📊 Gráficos e Visualizações
- [x] **Gráfico de evolução mensal** (receitas vs despesas) ✅
  - ✅ Usar Chart.js ou Recharts (Recharts implementado)
  - ✅ Mostrar últimos 6 meses
  - ✅ Implementar no Dashboard

- [x] **Gráfico de pizza por categorias** ✅
  - ✅ Distribuição de gastos por categoria
  - ✅ Filtro por período (implementado com toggle de visibilidade)

#### 🔍 Filtros e Busca
- [x] **Filtros avançados nas transações** ✅
  - ✅ Por período (data início/fim)
  - ✅ Por categoria
  - ✅ Por valor (mínimo/máximo)
  - ✅ Por tipo (receita/despesa)
  - ✅ Por status (pago/pendente)
  - ✅ Integração completa no Dashboard
  - ✅ Componente TransactionFilters funcional
  - ✅ Hook useTransactionFilters implementado

- [x] **Busca inteligente** ✅
  - ✅ Buscar por descrição
  - ✅ Buscar por valor
  - ✅ Autocomplete
  - ✅ Sugestões baseadas em histórico de transações
  - ✅ Navegação por teclado (setas, Enter, Escape)
  - ✅ Filtros rápidos (receita, despesa, pendente, este mês)
  - ✅ Busca por valor (exato e aproximado)
  - ✅ Busca por data
  - ✅ Histórico de buscas recentes
  - ✅ Integração com sistema de filtros

#### 🎨 Interface
- [x] **Modo escuro/claro** ✅
  - ✅ Toggle no header (ThemeToggle component)
  - ✅ Persistir preferência no localStorage
  - ✅ CSS variables para temas implementadas
  - ✅ Suporte a tema sistema (auto)
  - ✅ Context API para gerenciamento de estado
  - ✅ Integração completa no Dashboard

- [x] **Exportação de dados** ✅
  - ✅ Exportar transações para PDF
  - ✅ Exportar para Excel/CSV
  - ✅ Relatório mensal em PDF
  - ✅ Modal de exportação com opções avançadas
  - ✅ Tabelas profissionais com jspdf-autotable

### 🟡 **Prioridade Média - Esforço Moderado**

#### 💰 Orçamento e Metas
- [x] **Orçamento por categoria** ✅
  - ✅ Modelo de dados para orçamentos (tabela budgets)
  - ✅ Hook useBudgets para gerenciar orçamentos
  - ✅ Componente BudgetManager para CRUD de orçamentos
  - ✅ Modal BudgetEditModal para criar/editar orçamentos
  - ✅ Componente BudgetAlerts para alertas de limite
  - ✅ Componente BudgetProgressBar para visualização
  - ✅ Integração no Dashboard com botão de acesso
  - ✅ Cálculo automático de status (gasto, restante, porcentagem)
  - ✅ Alertas para orçamentos próximos ou acima do limite
  - ✅ Suporte a períodos mensais e anuais

- [x] **Metas de economia** ✅
  - ✅ Definir meta mensal/anual
  - ✅ Acompanhar progresso
  - ✅ Celebrar conquistas
  - ✅ Modelo de dados para metas (tabela goals)
  - ✅ Hook useGoals para gerenciar metas
  - ✅ Componentes GoalManager, GoalEditModal e GoalProgressCard
  - ✅ Integração no Dashboard com visualização de progresso
  - ✅ Funcionalidade de adicionar e remover valores
  - ✅ Marcação automática de metas como concluídas
  - ✅ Exibição condicional de metas ativas no Dashboard

#### 📥 Import/Export
- [x] **Import de extratos bancários** ✅ (Parcial - apenas CSV)
  - ✅ Suporte a CSV
  - [ ] Suporte a OFX
  - ✅ Mapeamento automático de categorias
  - ✅ Hook useImport para gerenciar importação
  - ✅ Componentes ImportModal e FileUpload
  - ✅ Parser CSV com detecção automática de separadores
  - ✅ Preview de transações antes da importação
  - ✅ Validação de arquivos e dados
  - ✅ Integração no Dashboard com botão de importação

#### 📱 Notificações
- [ ] **Sistema de notificações**
  - Lembretes de contas a pagar
  - Alertas de orçamento
  - Notificações push (PWA)

### 🔴 **Prioridade Baixa - Alto Esforço**

#### 🤖 Inteligência Artificial
- [ ] **Categorização automática**
  - IA para sugerir categorias
  - Aprendizado baseado no histórico
  - API de machine learning

#### 🏦 Integração Bancária
- [ ] **Open Banking**
  - Sincronização automática com bancos
  - Importação automática de transações
  - Compliance com regulamentações

#### 📊 Análises Avançadas
- [ ] **Relatórios de tendências**
  - Análise de padrões de gastos
  - Previsões baseadas no histórico
  - Insights personalizados

- [ ] **Comparativo entre períodos**
  - Mês atual vs anterior
  - Ano atual vs anterior
  - Análise de crescimento

#### 📈 Investimentos
- [ ] **Gestão básica de investimentos**
  - Acompanhar carteira
  - Calculadora de juros compostos
  - Simulador de investimentos

### 🎮 **Gamificação**

- [ ] **Sistema de conquistas**
  - Badges por metas atingidas
  - Streaks de economia
  - Ranking de categorias

- [ ] **Desafios mensais**
  - Desafio de economia
  - Desafio de organização
  - Recompensas virtuais

### 🔧 **Melhorias Técnicas**

#### 📱 PWA (Progressive Web App)
- [ ] **Transformar em PWA**
  - Service Worker
  - Manifest.json
  - Instalação no dispositivo
  - Funcionamento offline

#### 🔒 Segurança
- [ ] **Backup automático**
  - Backup na nuvem
  - Criptografia de dados
  - Recuperação de dados

#### 🚀 Performance
- [ ] **Otimizações de performance**
  - Lazy loading
  - Paginação de transações
  - Cache inteligente
  - Compressão de imagens

### 📋 **Roadmap Sugerido**

#### **Fase 1 (1-2 semanas)**
1. Gráficos básicos (Chart.js)
2. Filtros avançados
3. Modo escuro

#### **Fase 2 (2-3 semanas)**
1. Orçamento por categoria
2. Exportação PDF/CSV
3. Busca inteligente

#### **Fase 3 (3-4 semanas)**
1. Múltiplas contas
2. Import de CSV
3. Metas de economia

#### **Fase 4 (Longo prazo)**
1. PWA
2. Integração bancária
3. IA para categorização

---

## 📝 **Notas de Implementação**

### **Bibliotecas Recomendadas:**
- **Gráficos:** Chart.js, Recharts, Victory
- **Exportação:** jsPDF, xlsx
- **Datas:** date-fns (já em uso)
- **Notificações:** react-hot-toast (já em uso)
- **PWA:** Vite PWA Plugin

### **Estrutura de Pastas Sugerida:**
```
src/
├── components/
│   ├── charts/
│   ├── filters/
│   ├── reports/
│   └── budget/
├── hooks/
│   ├── useCharts.tsx
│   ├── useBudget.tsx
│   └── useFilters.tsx
├── utils/
│   ├── export.ts
│   ├── charts.ts
│   └── calculations.ts
└── types/
    ├── budget.ts
    └── charts.ts
```

### **Considerações:**
- Manter compatibilidade com a estrutura atual
- Implementar testes para novas funcionalidades
- Documentar APIs e componentes
- Considerar acessibilidade (a11y)
- Otimizar para dispositivos móveis

---

**Última atualização:** Janeiro 2025
**Versão atual:** 1.0.0
**Próxima versão planejada:** 1.1.0 (Gráficos + Filtros)