-- Criar tabela de metas de economia
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_amount DECIMAL(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount DECIMAL(10,2) DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  period TEXT NOT NULL CHECK (period IN ('monthly', 'yearly', 'custom')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_period ON goals(period);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);

-- Habilitar RLS (Row Level Security)
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Política para que usuários só vejam suas próprias metas
CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);

-- Política para que usuários só possam inserir metas para si mesmos
CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para que usuários só possam atualizar suas próprias metas
CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

-- Política para que usuários só possam deletar suas próprias metas
CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para marcar meta como completa automaticamente
CREATE OR REPLACE FUNCTION check_goal_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o valor atual atingiu ou superou a meta e o status ainda é 'active'
  IF NEW.current_amount >= NEW.target_amount AND NEW.status = 'active' THEN
    NEW.status = 'completed';
    NEW.completed_at = NOW();
  -- Se o valor atual ficou abaixo da meta e estava completa
  ELSIF NEW.current_amount < NEW.target_amount AND OLD.status = 'completed' THEN
    NEW.status = 'active';
    NEW.completed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para verificar conclusão da meta automaticamente
CREATE TRIGGER check_goal_completion_trigger
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION check_goal_completion();