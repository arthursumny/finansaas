-- Remover a constraint que impede amount = 0 para permitir abatimentos totais
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_amount_check;

-- Adicionar nova constraint que permite amount >= 0
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_amount_check CHECK (amount >= 0);