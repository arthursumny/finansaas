-- Fix search_path security issues by updating functions with secure search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Insert default categories for income
  INSERT INTO public.categories (user_id, name, type) VALUES
    (NEW.id, 'Salário', 'income'),
    (NEW.id, 'Freelance', 'income'),
    (NEW.id, 'Investimentos', 'income'),
    (NEW.id, 'Outros', 'income');
  
  -- Insert default categories for expense
  INSERT INTO public.categories (user_id, name, type) VALUES
    (NEW.id, 'Moradia', 'expense'),
    (NEW.id, 'Alimentação', 'expense'),
    (NEW.id, 'Transporte', 'expense'),
    (NEW.id, 'Saúde', 'expense'),
    (NEW.id, 'Educação', 'expense'),
    (NEW.id, 'Lazer', 'expense'),
    (NEW.id, 'Contas', 'expense'),
    (NEW.id, 'Outros', 'expense');
  
  RETURN NEW;
END;
$$;

-- Fix the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;