/**
 * server/cards.js
 * Módulo de gestão de cartões de crédito e ciclos de fatura do FinanSaaS
 */

import { randomUUID } from "node:crypto";

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
 * Calcula próximo fechamento, dias restantes e flag closing_soon
 * closing_soon = true quando 0 <= days <= 3
 */
export function computeClosingInfo(cardOrClosingDay, referenceDate = new Date()) {
  const closingDay = typeof cardOrClosingDay === "object" && cardOrClosingDay !== null
    ? Number(cardOrClosingDay.closing_day || 1)
    : Number(cardOrClosingDay || 1);

  const d = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const daysInThisMonth = new Date(year, month, 0).getDate();
  const actualClosingDay = Math.min(Math.max(closingDay, 1), daysInThisMonth);

  let nextYear = year;
  let nextMonth = month;
  let nextDay = actualClosingDay;

  if (day > actualClosingDay) {
    if (month === 12) {
      nextYear = year + 1;
      nextMonth = 1;
    } else {
      nextMonth = month + 1;
    }
    const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();
    nextDay = Math.min(Math.max(closingDay, 1), daysInNextMonth);
  }

  const next_closing_date = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;

  const d1 = Date.UTC(year, month - 1, day);
  const d2 = Date.UTC(nextYear, nextMonth - 1, nextDay);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days_until_closing = Math.max(0, Math.round((d2 - d1) / msPerDay));
  const closing_soon = days_until_closing >= 0 && days_until_closing <= 3;

  return {
    next_closing_date,
    days_until_closing,
    closing_soon,
  };
}

export const computeClosingAlert = computeClosingInfo;

/**
 * Retorna os detalhes da fatura de um cartão para um determinado mês de referência
 */
export function getCardInvoiceDetails(db, card, referenceMonth, options = {}) {
  const includeAdditional = options.includeAdditional !== false;
  const cycle = computeInvoiceCycle(card.closing_day, card.due_day, referenceMonth);

  let cardsIncluded = [{ id: card.id, name: card.name }];
  let cardIds = [card.id];

  if (includeAdditional && !card.parent_card_id) {
    const additionals = db.prepare("SELECT id, name FROM cards WHERE parent_card_id = ? AND user_id = ?").all(card.id, card.user_id);
    if (additionals.length > 0) {
      cardsIncluded = [{ id: card.id, name: card.name }, ...additionals.map((a) => ({ id: a.id, name: a.name }))];
      cardIds = cardsIncluded.map((c) => c.id);
    }
  }

  const placeholders = cardIds.map(() => "?").join(", ");

  const txs = db.prepare(`
    SELECT t.id, t.description, t.amount, t.date, t.category, t.status,
           t.installment_number, t.installment_total, t.card_id,
           c.name as card_name
    FROM transactions t
    LEFT JOIN cards c ON c.id = t.card_id
    WHERE t.card_id IN (${placeholders})
      AND t.user_id = ?
      AND t.type = 'expense'
      AND substr(t.date, 1, 10) > ?
      AND substr(t.date, 1, 10) <= ?
    ORDER BY t.date DESC, t.id DESC
  `).all(...cardIds, card.user_id, cycle.cycleStart, cycle.cycleEnd);

  const payments = db.prepare(`
    SELECT id, user_id, card_id, reference_month, amount, created_at
    FROM card_invoice_payments
    WHERE card_id IN (${placeholders})
      AND reference_month = ?
      AND user_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(...cardIds, referenceMonth, card.user_id);

  let total = 0;
  let txPaid = 0;
  let txPending = 0;

  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    total += amt;
    if (t.status === "paid") {
      txPaid += amt;
    } else {
      txPending += amt;
    }
  }

  let paymentsTotal = 0;
  for (const p of payments) {
    paymentsTotal += Number(p.amount) || 0;
  }

  total = Math.round(total * 100) / 100;
  txPaid = Math.round(txPaid * 100) / 100;
  paymentsTotal = Math.round(paymentsTotal * 100) / 100;

  // Paid = soma das transações do ciclo com status pago + soma dos card_invoice_payments do ciclo
  const rawPaid = Math.round((txPaid + paymentsTotal) * 100) / 100;
  const paid = Math.min(total, rawPaid);
  const pending = Math.max(0, Math.round((total - paid) * 100) / 100);

  let status = "open";
  if (pending <= 0.005) {
    status = "paid";
  } else if (paid > 0) {
    status = "partial";
  }

  const minPercent = card.min_payment_percent !== undefined && card.min_payment_percent !== null
    ? Number(card.min_payment_percent)
    : 15;
  const minimum_payment = Math.round(((total * minPercent) / 100) * 100) / 100;
  const minimum_remaining = Math.max(0, Math.round((minimum_payment - paid) * 100) / 100);

  return {
    reference_month: referenceMonth,
    cycle_start: cycle.cycleStart,
    cycle_end: cycle.cycleEnd,
    due_date: cycle.dueDate,
    total,
    paid,
    paid_total: paid,
    pending,
    pending_total: pending,
    status,
    min_payment_percent: minPercent,
    minimum_payment,
    minimum_remaining,
    payments,
    cards_included: cardsIncluded,
    transactions_count: txs.length,
    transactions: txs,
  };
}

/**
 * Retorna o resumo de todos os cartões ativos de um usuário
 *
 * options.referenceMonth (YYYY-MM): quando informado e válido, usa esse mês
 * como fatura de referência de cada cartão em vez do ciclo aberto atual.
 */
export function getCardsSummary(db, userId, referenceDate = new Date(), options = {}) {
  const cards = db.prepare(`
    SELECT * FROM cards
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at ASC, name ASC
  `).all(userId);

  const optionReferenceMonth = options && typeof options.referenceMonth === "string"
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(options.referenceMonth)
    ? options.referenceMonth
    : null;

  // Mapear titulares primeiro para calcular limites e usos de família
  const parentSummaries = new Map();

  for (const card of cards) {
    if (!card.parent_card_id) {
      const openMonth = optionReferenceMonth || getCurrentReferenceMonth(card, referenceDate);
      const invoice = getCardInvoiceDetails(db, card, openMonth, { includeAdditional: true });
      const nextMonth = getNextMonth(openMonth);
      const nextInvoice = getCardInvoiceDetails(db, card, nextMonth, { includeAdditional: true });

      const limit_amount = Number(card.limit_amount) || 0;
      const used_amount = invoice.total;
      const available_amount = Math.max(0, Math.round((limit_amount - used_amount) * 100) / 100);
      const usage_percent = limit_amount > 0
        ? Math.round(((used_amount / limit_amount) * 100) * 100) / 100
        : 0;

      const closingInfo = computeClosingInfo(card.closing_day, referenceDate);
      const { transactions, ...current_invoice } = invoice;

      parentSummaries.set(card.id, {
        ...card,
        is_active: Boolean(card.is_active),
        limit_amount,
        used_amount,
        available_amount,
        usage_percent,
        current_invoice,
        next_invoice_total: nextInvoice.total,
        ...closingInfo,
        shared_with_parent: false,
      });
    }
  }

  // Agora processar cartões adicionais
  const additionalsList = [];
  for (const card of cards) {
    if (card.parent_card_id) {
      const parent = parentSummaries.get(card.parent_card_id) || db.prepare("SELECT * FROM cards WHERE id = ?").get(card.parent_card_id);
      const openMonth = optionReferenceMonth || getCurrentReferenceMonth(card, referenceDate);
      const invoice = getCardInvoiceDetails(db, card, openMonth, { includeAdditional: false });
      const nextMonth = getNextMonth(openMonth);
      const nextInvoice = getCardInvoiceDetails(db, card, nextMonth, { includeAdditional: false });

      const limit_amount = parent ? Number(parent.limit_amount) : (Number(card.limit_amount) || 0);
      const used_amount = parent ? parent.used_amount : invoice.total;
      const available_amount = parent ? parent.available_amount : Math.max(0, Math.round((limit_amount - used_amount) * 100) / 100);
      const usage_percent = parent ? parent.usage_percent : (limit_amount > 0 ? Math.round(((used_amount / limit_amount) * 100) * 100) / 100 : 0);

      const closingInfo = computeClosingInfo(card.closing_day, referenceDate);
      const { transactions, ...current_invoice } = invoice;

      additionalsList.push({
        ...card,
        is_active: Boolean(card.is_active),
        limit_amount,
        used_amount,
        available_amount,
        usage_percent,
        current_invoice,
        next_invoice_total: nextInvoice.total,
        ...closingInfo,
        shared_with_parent: true,
        parent_card_name: parent ? parent.name : null,
      });
    }
  }

  // Intercalar: cada titular seguido de seus adicionais
  const result = [];
  const addedIds = new Set();

  for (const parent of parentSummaries.values()) {
    result.push(parent);
    addedIds.add(parent.id);
    for (const add of additionalsList) {
      if (add.parent_card_id === parent.id) {
        result.push(add);
        addedIds.add(add.id);
      }
    }
  }

  // Se houver algum adicional cujo pai não esteja ativo/encontrado
  for (const add of additionalsList) {
    if (!addedIds.has(add.id)) {
      result.push(add);
    }
  }

  return result;
}

/**
 * Retorna os últimos 12 ciclos de faturas de um cartão
 */
export function getCardInvoicesHistory(db, card, count = 12, referenceDate = new Date(), options = {}) {
  const includeAdditional = options.includeAdditional !== false;
  let cardIds = [card.id];

  if (includeAdditional && !card.parent_card_id) {
    const additionals = db.prepare("SELECT id FROM cards WHERE parent_card_id = ? AND user_id = ?").all(card.id, card.user_id);
    if (additionals.length > 0) {
      cardIds = [card.id, ...additionals.map((a) => a.id)];
    }
  }

  const placeholders = cardIds.map(() => "?").join(", ");
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
      WHERE card_id IN (${placeholders})
        AND user_id = ?
        AND type = 'expense'
        AND substr(date, 1, 10) > ?
        AND substr(date, 1, 10) <= ?
    `).get(...cardIds, card.user_id, cycle.cycleStart, cycle.cycleEnd);

    const paymentsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as payments_total
      FROM card_invoice_payments
      WHERE card_id IN (${placeholders})
        AND reference_month = ?
        AND user_id = ?
    `).get(...cardIds, currentMonth, card.user_id);

    const total = Math.round((row?.total || 0) * 100) / 100;
    const txPaid = Math.round((row?.paid_total || 0) * 100) / 100;
    const paymentsSum = Math.round((paymentsRow?.payments_total || 0) * 100) / 100;
    const paid = Math.min(total, Math.round((txPaid + paymentsSum) * 100) / 100);
    const pending = Math.max(0, Math.round((total - paid) * 100) / 100);

    let status = "open";
    if (pending <= 0.005) {
      status = "paid";
    } else if (paid > 0) {
      status = "partial";
    }

    invoices.push({
      reference_month: currentMonth,
      cycle_start: cycle.cycleStart,
      cycle_end: cycle.cycleEnd,
      due_date: cycle.dueDate,
      total,
      paid,
      paid_total: paid,
      pending,
      pending_total: pending,
      status,
      transactions_count: row?.transactions_count || 0,
    });

    currentMonth = getPrevMonth(currentMonth);
  }

  return invoices;
}

/**
 * Registra as rotas de cartões no Express app
 */
export function registerCardRoutes(app, { db, requireUser, requireSession }) {
  // GET /api/cards/summary?reference_month=YYYY-MM
  app.get("/api/cards/summary", requireUser, requireSession, (req, res) => {
    try {
      const referenceMonth = req.query.reference_month;
      if (referenceMonth !== undefined && referenceMonth !== null && referenceMonth !== "") {
        if (typeof referenceMonth !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) {
          return res.status(400).json({ error: { message: "Mês inválido. Formato esperado: YYYY-MM." } });
        }
      }

      const options = {};
      if (referenceMonth) options.referenceMonth = referenceMonth;

      const summary = getCardsSummary(db, req.user.id, new Date(), options);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao obter resumo dos cartões." } });
    }
  });

  // GET /api/cards/:id/invoice?month=YYYY-MM&include_additional=1
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

      const includeAdditional = req.query.include_additional !== "0" && req.query.include_additional !== "false";
      const invoice = getCardInvoiceDetails(db, card, referenceMonth, { includeAdditional });

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
          min_payment_percent: card.min_payment_percent ?? 15,
          parent_card_id: card.parent_card_id ?? null,
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

      const includeAdditional = req.query.include_additional !== "0" && req.query.include_additional !== "false";
      const invoices = getCardInvoicesHistory(db, card, 12, new Date(), { includeAdditional });
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

      let cardIds = [card.id];
      if (!card.parent_card_id) {
        const additionals = db.prepare("SELECT id FROM cards WHERE parent_card_id = ? AND user_id = ?").all(card.id, req.user.id);
        if (additionals.length > 0) {
          cardIds = [card.id, ...additionals.map((a) => a.id)];
        }
      }
      const placeholders = cardIds.map(() => "?").join(", ");

      const cycle = computeInvoiceCycle(card.closing_day, card.due_day, month);

      const txs = db.prepare(`
        SELECT id, amount FROM transactions
        WHERE card_id IN (${placeholders})
          AND user_id = ?
          AND type = 'expense'
          AND status = 'pending'
          AND substr(date, 1, 10) > ?
          AND substr(date, 1, 10) <= ?
      `).all(...cardIds, req.user.id, cycle.cycleStart, cycle.cycleEnd);

      const total_paid = Math.round(txs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100;
      const nowIso = new Date().toISOString();

      const result = db.prepare(`
        UPDATE transactions
        SET status = 'paid', updated_at = ?
        WHERE card_id IN (${placeholders})
          AND user_id = ?
          AND type = 'expense'
          AND status = 'pending'
          AND substr(date, 1, 10) > ?
          AND substr(date, 1, 10) <= ?
      `).run(nowIso, ...cardIds, req.user.id, cycle.cycleStart, cycle.cycleEnd);

      res.json({
        updated: result.changes,
        total_paid,
        reference_month: month,
        pending: 0,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao pagar fatura." } });
    }
  });

  // POST /api/cards/:id/invoice/:month/pay-minimum
  app.post("/api/cards/:id/invoice/:month/pay-minimum", requireUser, requireSession, (req, res) => {
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

      const currentInvoice = getCardInvoiceDetails(db, card, month, { includeAdditional: true });
      const pending = currentInvoice.pending;

      let amount = req.body?.amount !== undefined ? Number(req.body.amount) : currentInvoice.minimum_remaining;

      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: { message: "Valor de pagamento deve ser maior que zero." } });
      }

      if (amount > pending + 0.01) {
        return res.status(400).json({
          error: {
            message: `Valor informado (R$ ${amount.toFixed(2)}) é maior que o saldo pendente (R$ ${pending.toFixed(2)}).`,
          },
        });
      }

      if (amount > pending) {
        amount = pending;
      }
      amount = Math.round(amount * 100) / 100;

      // O pagamento parcial é registrado no cartão titular
      const targetCardId = card.parent_card_id ? card.parent_card_id : card.id;
      const paymentId = randomUUID();
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO card_invoice_payments (id, user_id, card_id, reference_month, amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(paymentId, req.user.id, targetCardId, month, amount, createdAt);

      const updatedInvoice = getCardInvoiceDetails(db, card, month, { includeAdditional: true });

      res.json({
        paid: updatedInvoice.paid,
        pending: updatedInvoice.pending,
        amount,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao pagar valor mínimo da fatura." } });
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

      let cardIds = [card.id];
      if (!card.parent_card_id) {
        const additionals = db.prepare("SELECT id FROM cards WHERE parent_card_id = ? AND user_id = ?").all(card.id, req.user.id);
        if (additionals.length > 0) {
          cardIds = [card.id, ...additionals.map((a) => a.id)];
        }
      }
      const placeholders = cardIds.map(() => "?").join(", ");

      const cycle = computeInvoiceCycle(card.closing_day, card.due_day, month);
      const nowIso = new Date().toISOString();

      let reverted = 0;
      const tx = db.transaction(() => {
        const result = db.prepare(`
          UPDATE transactions
          SET status = 'pending', updated_at = ?
          WHERE card_id IN (${placeholders})
            AND user_id = ?
            AND type = 'expense'
            AND status = 'paid'
            AND substr(date, 1, 10) > ?
            AND substr(date, 1, 10) <= ?
        `).run(nowIso, ...cardIds, req.user.id, cycle.cycleStart, cycle.cycleEnd);
        reverted = result.changes;

        db.prepare(`
          DELETE FROM card_invoice_payments
          WHERE card_id IN (${placeholders})
            AND reference_month = ?
            AND user_id = ?
        `).run(...cardIds, month, req.user.id);
      });
      tx();

      const newInvoice = getCardInvoiceDetails(db, card, month, { includeAdditional: true });

      res.json({
        updated: reverted,
        reverted,
        pending: newInvoice.pending,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao reabrir fatura." } });
    }
  });

  // DELETE /api/cards/:id/invoice/:month/payments/:paymentId
  app.delete("/api/cards/:id/invoice/:month/payments/:paymentId", requireUser, requireSession, (req, res) => {
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

      let cardIds = [card.id];
      if (!card.parent_card_id) {
        const additionals = db.prepare("SELECT id FROM cards WHERE parent_card_id = ? AND user_id = ?").all(card.id, req.user.id);
        if (additionals.length > 0) {
          cardIds = [card.id, ...additionals.map((a) => a.id)];
        }
      }
      const placeholders = cardIds.map(() => "?").join(", ");

      const payment = db.prepare(`
        SELECT * FROM card_invoice_payments
        WHERE id = ?
          AND user_id = ?
          AND reference_month = ?
          AND card_id IN (${placeholders})
      `).get(req.params.paymentId, req.user.id, month, ...cardIds);

      if (!payment) {
        return res.status(404).json({ error: { message: "Pagamento parcial não encontrado." } });
      }

      db.prepare("DELETE FROM card_invoice_payments WHERE id = ? AND user_id = ?").run(payment.id, req.user.id);

      const updatedInvoice = getCardInvoiceDetails(db, card, month, { includeAdditional: true });

      res.json({
        ok: true,
        deleted: payment.id,
        paid: updatedInvoice.paid,
        pending: updatedInvoice.pending,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao excluir pagamento parcial." } });
    }
  });
}
