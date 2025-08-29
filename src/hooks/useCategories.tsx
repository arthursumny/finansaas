import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  user_id: string;
  created_at: string;
}

export interface CategoryFormData {
  name: string;
  type: 'income' | 'expense';
}

/**
 * Hook para gerenciar categorias de receitas e despesas
 * Fornece funcionalidades para buscar, criar, editar e deletar categorias
 */
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Busca todas as categorias do usuário logado
   */
  const fetchCategories = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data as Category[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar categorias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cria uma nova categoria
   */
  const addCategory = async (categoryData: CategoryFormData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...categoryData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data as Category]);
      toast({
        title: "Categoria criada",
        description: `Categoria "${categoryData.name}" criada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao criar categoria",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Atualiza uma categoria existente
   */
  const updateCategory = async (id: string, categoryData: CategoryFormData) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .update(categoryData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => 
        prev.map(cat => cat.id === id ? (data as Category) : cat)
      );
      
      toast({
        title: "Categoria atualizada",
        description: `Categoria "${categoryData.name}" atualizada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar categoria",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Deleta uma categoria
   */
  const deleteCategory = async (id: string) => {
    if (!user) return;

    try {
      // Verificar se existem transações usando esta categoria
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('category', categories.find(cat => cat.id === id)?.name || '');

      if (checkError) throw checkError;

      if (transactions && transactions.length > 0) {
        toast({
          title: "Não é possível excluir",
          description: "Esta categoria possui transações associadas. Exclua as transações primeiro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast({
        title: "Categoria excluída",
        description: "Categoria removida com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir categoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  /**
   * Retorna categorias filtradas por tipo
   */
  const getCategoriesByType = (type: 'income' | 'expense') => {
    return categories.filter(cat => cat.type === type);
  };

  /**
   * Retorna nomes das categorias por tipo (para compatibilidade com código existente)
   */
  const getCategoryNamesByType = (type: 'income' | 'expense') => {
    return categories
      .filter(cat => cat.type === type)
      .map(cat => cat.name);
  };

  // Carregar categorias quando o usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  return {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoriesByType,
    getCategoryNamesByType,
    refetch: fetchCategories,
  };
};