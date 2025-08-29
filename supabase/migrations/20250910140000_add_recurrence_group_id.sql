ALTER TABLE public.transactions
ADD COLUMN recurrence_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_recurrence_group_id ON public.transactions(recurrence_group_id);