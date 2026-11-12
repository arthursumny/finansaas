/**
 * server/installments.js
 * Módulo de compras parceladas no cartão de crédito do FinanSaaS
 */

import { randomUUID } from "node:crypto";

/**
 * Divide um valor total em parcelas, calculando datas e valores com precisão de centavos
 * 
 * @param {number} totalAmount - Valor total da compra (> 0)
 * @param {number} count - Quantidade de parcelas (2 a 36)
 * @param {string} firstDate - Data da primeira parcela (YYYY-MM-DD)
 * @returns {Array<{ amount: number, date: string, number: number }>}
 */
export function splitInstallments(totalAmount, count, firstDate) {
  const c = Number(count);
  if (!Number.isInteger(c) || c < 2 || c > 36) {
    throw new Error(`Quantidade de parcelas inválida (${count}). Deve ser um número inteiro entre 2 e 36.`);
  }

  const total = Number(totalAmount);
  if (isNaN(total) || total <= 0) {
    throw new Error(`Valor total inválido (${totalAmount}). Deve ser maior que zero.`);
  }

  const dateStr = String(firstDate || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(`Data inicial inválida: ${firstDate}. Formato esperado: YYYY-MM-DD.`);
  }

  const baseYear = parseInt(match[1], 10);
  const baseMonth = parseInt(match[2], 10);
  const baseDay = parseInt(match[3], 10);

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / c);
  const remainderCents = totalCents - (baseCents * c);

  const installments = [];

  for (let i = 1; i <= c; i++) {
    const cents = i === 1 ? baseCents + remainderCents : baseCents;
    const amount = Math.round(cents) / 100;

    const offsetMonths = i - 1;
    const targetMonthIndex = (baseMonth - 1) + offsetMonths;
    const targetYear = baseYear + Math.floor(targetMonthIndex / 12);
    const targetMonth = (targetMonthIndex % 12) + 1;

    // Último dia do targetMonth (new Date com dia 0 do mês seguinte)
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const actualDay = Math.min(baseDay, daysInTargetMonth);

    const date = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;

    installments.push({
      number: i,
      amount,
      date,
    });
  }

  return installments;
}

/**
 * Registra as rotas de parcelamento no Express app
 */
export function registerInstallmentRoutes(app, { db, requireUser, requireSession }) {
  // POST /api/transactions/installments
  app.post("/api/transactions/installments", requireUser, requireSession, (req, res) => {
    try {
      const {
        description,
        amount,
        date,
        type = "expense",
        category,
        status = "pending",
        card_id,
        payment_method = "credit",
        installments,
      } = req.body;

      const count = Number(installments);
      if (!Number.isInteger(count) || count < 2 || count > 36) {
        return res.status(400).json({ error: { message: "Número de parcelas deve ser entre 2 e 36." } });
      }

      const totalAmount = Number(amount);
      if (isNaN(totalAmount) || totalAmount <= 0) {
        return res.status(400).json({ error: { message: "Valor total deve ser maior que zero." } });
      }

      const cleanDescription = String(description || "").trim();
      if (!cleanDescription) {
        return res.status(400).json({ error: { message: "Descrição é obrigatória." } });
      }

      const cleanCategory = String(category || "").trim();
      if (!cleanCategory) {
        return res.status(400).json({ error: { message: "Categoria é obrigatória." } });
      }

      if (!card_id) {
        return res.status(400).json({ error: { message: "Cartão é obrigatório para compras parceladas." } });
      }

      const card = db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").get(card_id, req.user.id);
      if (!card) {
        return res.status(400).json({ error: { message: "Cartão inválido ou não pertence ao usuário." } });
      }

      const initialDate = date || new Date().toISOString().slice(0, 10);
      const plan = splitInstallments(totalAmount, count, initialDate);
      const groupId = randomUUID();
      const nowIso = new Date().toISOString();

      const insertStmt = db.prepare(`
        INSERT INTO transactions (
          id, user_id, type, description, amount, date, category, status,
          is_recurring, card_id, payment_method, installment_group_id,
          installment_number, installment_total, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          0, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);

      const createdTxs = [];
      const insertAll = db.transaction(() => {
        for (const item of plan) {
          const txId = randomUUID();
          const itemDescription = `${cleanDescription} (${item.number}/${count})`;
          insertStmt.run(
            txId,
            req.user.id,
            type,
            itemDescription,
            item.amount,
            item.date,
            cleanCategory,
            status,
            card.id,
            payment_method,
            groupId,
            item.number,
            count,
            nowIso,
            nowIso
          );
          createdTxs.push({
            id: txId,
            user_id: req.user.id,
            type,
            description: itemDescription,
            amount: item.amount,
            date: item.date,
            category: cleanCategory,
            status,
            is_recurring: false,
            card_id: card.id,
            payment_method,
            installment_group_id: groupId,
            installment_number: item.number,
            installment_total: count,
            created_at: nowIso,
            updated_at: nowIso,
          });
        }
      });

      insertAll();

      res.status(201).json({
        group_id: groupId,
        created: count,
        total: Math.round(totalAmount * 100) / 100,
        installments: createdTxs,
      });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao registrar parcelamento." } });
    }
  });

  // DELETE /api/transactions/installment-group/:groupId
  app.delete("/api/transactions/installment-group/:groupId", requireUser, requireSession, (req, res) => {
    try {
      const { groupId } = req.params;
      const result = db.prepare(
        "DELETE FROM transactions WHERE installment_group_id = ? AND user_id = ?"
      ).run(groupId, req.user.id);

      res.json({ deleted: result.changes });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao excluir grupo de parcelas." } });
    }
  });

  // PATCH /api/transactions/installment-group/:groupId
  app.patch("/api/transactions/installment-group/:groupId", requireUser, requireSession, (req, res) => {
    try {
      const { groupId } = req.params;
      const { description, category, card_id, payment_method } = req.body;

      if (card_id) {
        const card = db.prepare("SELECT id FROM cards WHERE id = ? AND user_id = ?").get(card_id, req.user.id);
        if (!card) {
          return res.status(400).json({ error: { message: "Cartão inválido ou não pertence ao usuário." } });
        }
      }

      const pendingTxs = db.prepare(`
        SELECT id, installment_number, installment_total
        FROM transactions
        WHERE installment_group_id = ? AND user_id = ? AND status != 'paid'
      `).all(groupId, req.user.id);

      const nowIso = new Date().toISOString();

      const updateAll = db.transaction(() => {
        for (const tx of pendingTxs) {
          const updates = [];
          const params = [];

          if (description !== undefined) {
            const cleanDesc = String(description).replace(/\s*\(\d+\/\d+\)$/, "").trim();
            updates.push("description = ?");
            params.push(`${cleanDesc} (${tx.installment_number}/${tx.installment_total})`);
          }
          if (category !== undefined) {
            updates.push("category = ?");
            params.push(String(category).trim());
          }
          if (card_id !== undefined) {
            updates.push("card_id = ?");
            params.push(card_id);
          }
          if (payment_method !== undefined) {
            updates.push("payment_method = ?");
            params.push(payment_method);
          }

          if (updates.length > 0) {
            updates.push("updated_at = ?");
            params.push(nowIso);
            params.push(tx.id);
            params.push(req.user.id);

            db.prepare(`UPDATE transactions SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`).run(...params);
          }
        }
      });

      updateAll();

      res.json({ updated: pendingTxs.length });
    } catch (error) {
      res.status(500).json({ error: { message: error.message || "Erro ao atualizar parcelamento." } });
    }
  });
}
