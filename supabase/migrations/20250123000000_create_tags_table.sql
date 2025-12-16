-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Cor padrão azul
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  PRIMARY KEY (id),
  UNIQUE(user_id, name) -- Evita tags duplicadas por usuário
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags
CREATE POLICY "Users can manage own tags" 
ON public.tags 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Create transaction_tags junction table (many-to-many)
CREATE TABLE public.transaction_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  PRIMARY KEY (id),
  UNIQUE(transaction_id, tag_id) -- Evita relacionamentos duplicados
);

-- Enable RLS on transaction_tags
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for transaction_tags
CREATE POLICY "Users can manage own transaction tags" 
ON public.transaction_tags 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.transactions 
    WHERE transactions.id = transaction_tags.transaction_id 
    AND transactions.user_id = auth.uid()
  )
) 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.transactions 
    WHERE transactions.id = transaction_tags.transaction_id 
    AND transactions.user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_transaction_tags_transaction_id ON public.transaction_tags(transaction_id);
CREATE INDEX idx_transaction_tags_tag_id ON public.transaction_tags(tag_id);
CREATE INDEX idx_tags_user_id ON public.tags(user_id);

