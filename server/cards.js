/**
 * server/cards.js
 * Módulo de gestão de cartões de crédito e ciclos de fatura do FinanSaaS
 */

/**
 * Calcula o ciclo de fatura de referência YYYY-MM
 * 
 * Regra: a fatura de referência fecha no closing_day desse mês;
 * O ciclo vai do dia seguinte ao fechamento do mês anterior até o closing_day do mês de referência.
 * Compra entra na fatura se cycleStart < data <= cycleEnd.
 * dueDate = due_day no mesmo mês se due_day >= closing_day, senão no mês seguinte.
 * Trata meses com menos dias usando o último dia do mês.
 */
export function computeInvoiceCycle(arg1, arg2, arg3) {
  let closingDay;
  let dueDay = 10;
  let referenceMonth;

  if (typeof arg1 === "object" && arg1 !== null) {
    closingDay = Number(arg1.closing_day ?? arg1.closingDay ?? 1);
    dueDay = Number(arg1.due_day ?? arg1.dueDay ?? 10);
    referenceMonth = String(arg1.reference_month ?? arg1.referenceMonth);
  } else if (typeof arg2 === "string" && arg2.includes("-")) {
    closingDay = Number(arg1);
    referenceMonth = String(arg2);
    if (arg3 !== undefined && arg3 !== null) dueDay = Number(arg3);
  } else if (typeof arg2 === "number") {
    closingDay = Number(arg1);
    dueDay = Number(arg2);
    referenceMonth = String(arg3);
  } else {
    closingDay = Number(arg1);
    referenceMonth = String(arg2);
    if (arg3 !== undefined && arg3 !== null) dueDay = Number(arg3);
  }

  const match = /^(\d{4})-(\d{2})$/.exec(String(referenceMonth || ""));
  if (!match) {
    throw new Error(`Mês de referência inválido: ${referenceMonth}. Esperado YYYY-MM.`);
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new Error(`Mês inválido: ${month}. Deve estar entre 01 e 12.`);
  }

  // 1) Dias no mês de referência (fechamento da fatura)
  const daysInRefMonth = new Date(year, month, 0).getDate();
  const actualClosingDay = Math.min(Math.max(closingDay, 1), daysInRefMonth);
  const cycleEnd = `${year}-${String(month).padStart(2, "0")}-${String(actualClosingDay).padStart(2, "0")}`;

  // 2) Mês anterior para o início do ciclo (dia de fechamento anterior)
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const actualPrevClosingDay = Math.min(Math.max(closingDay, 1), daysInPrevMonth);
  const cycleStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(actualPrevClosingDay).padStart(2, "0")}`;

  // 3) Vencimento: due_day no mesmo mês se due_day >= closing_day, senão no mês seguinte
  let dueYear = year;
  let dueMonth = month;
  if (dueDay < closingDay) {
    if (month === 12) {
      dueYear = year + 1;
      dueMonth = 1;
    } else {
      dueMonth = month + 1;
    }
  }

  const daysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
  const actualDueDay = Math.min(Math.max(dueDay, 1), daysInDueMonth);
  const dueDate = `${dueYear}-${String(dueMonth).padStart(2, "0")}-${String(actualDueDay).padStart(2, "0")}`;

  return { cycleStart, cycleEnd, dueDate };
}

/**
 * Retorna true se a data de uma transação estiver dentro do ciclo (cycleStart < date <= cycleEnd)
 */
export function isTransactionInCycle(date, cycleStart, cycleEnd) {
  if (!date) return false;
  const d = String(date).slice(0, 10);
  return d > cycleStart && d <= cycleEnd;
}

/**
 * Calcula o mês de referência da fatura atualmente aberta para um cartão
 */
export function getCurrentReferenceMonth(card, referenceDate = new Date()) {
  const d = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const closingDay = Number(card.closing_day || 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const actualClosingDay = Math.min(closingDay, daysInMonth);

  // Se a data de hoje já passou do dia de fechamento deste mês,
  // a fatura deste mês já fechou e o ciclo ABERTO atual é o do mês seguinte.
  if (day > actualClosingDay) {
    if (month === 12) {
      return `${year + 1}-01`;
    }
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Retorna o próximo mês no formato YYYY-MM
 */
export function getNextMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Retorna o mês anterior no formato YYYY-MM
 */
export function getPrevMonth(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Retorna os detalhes da fatura de um cartão para um determinado mês de referência
 */
export function getCardInvoiceDetails(db, card, referenceMonth) {
  const cycle = computeInvoiceCycle(card.closing_day, card.due_day, referenceMonth);

  const txs = db.prepare(`
    SELECT id, description, amount, date, category, status, installment_number, installment_total
    FROM transactions
    WHERE card_id = ?
      AND user_id = ?
      AND type = 'expense'
      AND substr(date, 1, 10) > ?
      AND substr(date, 1, 10) <= ?
    ORDER BY date DESC, id DESC
  `).all(card.id, card.user_id, cycle.cycleStart, cycle.cycleEnd);

  let total = 0;
  let paid_total = 0;
  let pending_total = 0;

  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    total += amt;
    if (t.status === "paid") {
      paid_total += amt;
    } else {
      pending_total += amt;
    }
  }

  total = Math.round(total * 100) / 100;
  paid_total = Math.round(paid_total * 100) / 100;
  pending_total = Math.round(pending_total * 100) / 100;

  return {
    reference_month: referenceMonth,
    cycle_start: cycle.cycleStart,
    cycle_end: cycle.cycleEnd,
    due_date: cycle.dueDate,
    total,
    paid_total,
    pending_total,
    transactions_count: txs.length,
    transactions: txs,
  };
}

/**
 * Retorna o resumo de todos os cartões ativos de um usuário
 */
export function getCardsSummary(db, userId, referenceDate = new Date()) {
  const cards = db.prepare(`
    SELECT * FROM cards
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at ASC, name ASC
  `).all(userId);

  return cards.map((card) => {
    const openMonth = getCurrentReferenceMonth(card, referenceDate);
    const invoice = getCardInvoiceDetails(db, card, openMonth);
    const nextMonth = getNextMonth(openMonth);
    const nextInvoice = getCardInvoiceDetails(db, card, nextMonth);

    const limit_amount = Number(card.limit_amount) || 0;
    const used_amount = invoice.total;
    const available_amount = Math.max(0, Math.round((limit_amount - used_amount) * 100) / 100);
    const usage_percent = limit_amount > 0
      ? Math.round(((used_amount / limit_amount) * 100) * 100) / 100
      : 0;

    const { transactions, ...current_invoice } = invoice;

    return {
      ...card,
      is_active: Boolean(card.is_active),
      limit_amount,
      used_amount,
      available_amount,
      usage_percent,
      current_invoice,
      next_invoice_total: nextInvoice.total,
    };
  });
}

/**
 * Retorna os últimos 12 ciclos de faturas de um cartão
 */
export function getCardInvoicesHistory(db, card, count = 12, referenceDate = new Date()) {
  const currentOpenMonth = getCurrentReferenceMonth(card, referenceDate);
  const invoices = [];

  let currentMonth = currentOpenMonth;
  for (let i = 0; i < count; i++) {
    const cycle = computeInvoiceCycle(card.closing_day, card.due_day, currentMonth);

    const row = db.prepare(`
      SELECT
        COUNT(*) as transactions_count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_total,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_total
      FROM transactions
      WHERE card_id = ?
        AND user_id = ?
        AND type = 'expense'
        AND substr(date, 1, 10) > ?
        AND substr(date, 1, 10) <= ?
    `).get(card.id, card.user_id, cycle.cycleStart, cycle.cycleEnd);

    invoices.push({
      reference_month: currentMonth,
      cycle_start: cycle.cycleStart,
      cycle_end: cycle.cycleEnd,
      due_date: cycle.dueDate,
      total: Math.round((row.total || 0) * 100) / 100,
      paid_total: Math.round((row.paid_total || 0) * 100) / 100,
      pending_total: Math.round((row.pending_total || 0) * 100) / 100,
      transactions_count: row.transactions_count || 0,
    });

    currentMonth = getPrevMonth(currentMonth);
  }

  return invoices;
}

/**
 * Registra as rotas de cartões no Express app
 */
export function registerCardRoutes(app, { db, requireUser, requireSession }) {
  // GET /api/cards/summary
  app.get("/api/cards/summary", requireUser, requireSession, (req, res) => {
    try {
      const summary = getCardsSummary(db, req.user.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao obter resumo dos cartões." } });
    }
  });

  // GET /api/cards/:id/invoice?month=YYYY-MM
  app.get("/api/cards/:id/invoice", requireUser, requireSession, (req, res) => {
    try {
      const card = db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!card) {
        return res.status(404).json({ error: { message: "Cartão não encontrado." } });
      }

      let referenceMonth = req.query.month;
      if (referenceMonth) {
        if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
          return res.status(400).json({ error: { message: "Mês inválido. Formato esperado: YYYY-MM." } });
        }
        const m = parseInt(referenceMonth.split("-")[1], 10);
        if (m < 1 || m > 12) {
          return res.status(400).json({ error: { message: "Mês inválido. Deve estar entre 01 e 12." } });
        }
      } else {
        referenceMonth = getCurrentReferenceMonth(card);
      }

      const invoice = getCardInvoiceDetails(db, card, referenceMonth);
      res.json({
        card: {
          id: card.id,
          name: card.name,
          brand: card.brand,
          limit_amount: card.limit_amount,
          closing_day: card.closing_day,
          due_day: card.due_day,
          color: card.color,
          is_active: Boolean(card.is_active),
        },
        ...invoice,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao obter fatura do cartão." } });
    }
  });

  // GET /api/cards/:id/invoices
  app.get("/api/cards/:id/invoices", requireUser, requireSession, (req, res) => {
    try {
      const card = db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!card) {
        return res.status(404).json({ error: { message: "Cartão não encontrado." } });
      }

      const invoices = getCardInvoicesHistory(db, card, 12);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao obter histórico de faturas." } });
    }
  });

  // POST /api/cards/:id/invoice/:month/pay
  app.post("/api/cards/:id/invoice/:month/pay", requireUser, requireSession, (req, res) => {
    try {
      const card = db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!card) {
        return res.status(404).json({ error: { message: "Cartão não encontrado." } });
      }

      const month = req.params.month;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: { message: "Mês inválido. Formato esperado: YYYY-MM." } });
      }
      const m = parseInt(month.split("-")[1], 10);
      if (m < 1 || m > 12) {
        return res.status(400).json({ error: { message: "Mês inválido. Deve estar entre 01 e 12." } });
      }

      const cycle = computeInvoiceCycle(card.closing_day, card.due_day, month);

      const txs = db.prepare(`
        SELECT id, amount FROM transactions
        WHERE card_id = ?
          AND user_id = ?
          AND type = 'expense'
          AND status = 'pending'
          AND substr(date, 1, 10) > ?
          AND substr(date, 1, 10) <= ?
      `).all(card.id, req.user.id, cycle.cycleStart, cycle.cycleEnd);

      const total_paid = Math.round(txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100;
      const nowIso = new Date().toISOString();

      const result = db.prepare(`
        UPDATE transactions
        SET status = 'paid', updated_at = ?
        WHERE card_id = ?
          AND user_id = ?
          AND type = 'expense'
          AND status = 'pending'
          AND substr(date, 1, 10) > ?
          AND substr(date, 1, 10) <= ?
      `).run(nowIso, card.id, req.user.id, cycle.cycleStart, cycle.cycleEnd);

      res.json({
        updated: result.changes,
        total_paid,
        reference_month: month,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao pagar fatura." } });
    }
  });

  // POST /api/cards/:id/invoice/:month/unpay
  app.post("/api/cards/:id/invoice/:month/unpay", requireUser, requireSession, (req, res) => {
    try {
      const card = db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (!card) {
        return res.status(404).json({ error: { message: "Cartão não encontrado." } });
      }

      const month = req.params.month;
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: { message: "Mês inválido. Formato esperado: YYYY-MM." } });
      }
      const m = parseInt(month.split("-")[1], 10);
      if (m < 1 || m > 12) {
        return res.status(400).json({ error: { message: "Mês inválido. Deve estar entre 01 e 12." } });
      }

      const cycle = computeInvoiceCycle(card.closing_day, card.due_day, month);
      const nowIso = new Date().toISOString();

      const result = db.prepare(`
        UPDATE transactions
        SET status = 'pending', updated_at = ?
        WHERE card_id = ?
          AND user_id = ?
          AND type = 'expense'
          AND status = 'paid'
          AND substr(date, 1, 10) > ?
          AND substr(date, 1, 10) <= ?
      `).run(nowIso, card.id, req.user.id, cycle.cycleStart, cycle.cycleEnd);

      res.json({
        updated: result.changes,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao reabrir fatura." } });
    }
  });
}
