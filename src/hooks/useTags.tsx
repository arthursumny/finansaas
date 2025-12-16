import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface TagFormData {
  name: string;
  color?: string;
}

/**
 * Hook para gerenciar tags de transações
 * Fornece funcionalidades para buscar, criar, editar e deletar tags
 */
export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Busca todas as tags do usuário logado
   */
  const fetchTags = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setTags((data as Tag[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar tags",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Cria uma nova tag
   */
  const addTag = async (tagData: TagFormData) => {
    if (!user) return;

    try {
      // Verifica se já existe uma tag com o mesmo nome
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', tagData.name.trim())
        .single();

      if (existing) {
        toast({
          title: "Tag já existe",
          description: `A tag "${tagData.name}" já existe.`,
          variant: "destructive",
        });
        throw new Error('Tag já existe');
      }

      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: tagData.name.trim(),
          color: tagData.color || '#3b82f6',
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setTags(prev => [...prev, data as Tag]);
      toast({
        title: "Tag criada",
        description: `Tag "${tagData.name}" criada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      if (error.message !== 'Tag já existe') {
        toast({
          title: "Erro ao criar tag",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  /**
   * Atualiza uma tag existente
   */
  const updateTag = async (id: string, tagData: TagFormData) => {
    if (!user) return;

    try {
      // Verifica se já existe outra tag com o mesmo nome
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', tagData.name.trim())
        .neq('id', id)
        .single();

      if (existing) {
        toast({
          title: "Tag já existe",
          description: `A tag "${tagData.name}" já existe.`,
          variant: "destructive",
        });
        throw new Error('Tag já existe');
      }

      const updateData: Partial<TagFormData> = {
        name: tagData.name.trim(),
      };
      
      if (tagData.color) {
        updateData.color = tagData.color;
      }

      const { data, error } = await supabase
        .from('tags')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setTags(prev => 
        prev.map(tag => tag.id === id ? (data as Tag) : tag)
      );
      
      toast({
        title: "Tag atualizada",
        description: `Tag "${tagData.name}" atualizada com sucesso!`,
      });
      
      return data;
    } catch (error: any) {
      if (error.message !== 'Tag já existe') {
        toast({
          title: "Erro ao atualizar tag",
          description: error.message,
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  /**
   * Deleta uma tag
   */
  const deleteTag = async (id: string) => {
    if (!user) return;

    try {
      // Verificar se existem transações usando esta tag
      const { data: transactionTags, error: checkError } = await supabase
        .from('transaction_tags')
        .select('id')
        .eq('tag_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (transactionTags && transactionTags.length > 0) {
        toast({
          title: "Não é possível excluir",
          description: "Esta tag possui transações associadas. Remova as tags das transações primeiro.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setTags(prev => prev.filter(tag => tag.id !== id));
      toast({
        title: "Tag excluída",
        description: "Tag removida com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tag",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Carregar tags quando o usuário estiver disponível
  useEffect(() => {
    if (user) {
      fetchTags();
    }
  }, [user]);

  return {
    tags,
    loading,
    addTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
};

