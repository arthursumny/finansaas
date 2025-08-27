-- Adicionar campos para melhorar transações recorrentes e pagamentos com desconto
ALTER TABLE public.transactions 
ADD COLUMN recurrence_start_date DATE,
ADD COLUMN recurrence_end_date DATE,
ADD COLUMN original_amount NUMERIC,
ADD COLUMN discount_amount NUMERIC DEFAULT 0;

-- Atualizar transações existentes para ter original_amount igual ao amount
UPDATE public.transactions 
SET original_amount = amount 
WHERE original_amount IS NULL;