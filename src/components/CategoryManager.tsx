import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { useCategories, Category, CategoryFormData } from '@/hooks/useCategories';
import { CategoryEditModal } from './CategoryEditModal';

interface CategoryManagerProps {
  onBack?: () => void;
}

/**
 * Componente para gerenciar categorias de receitas e despesas
 */
export const CategoryManager = ({ onBack }: CategoryManagerProps) => {
  const {
    categories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoriesByType,
  } = useCategories();

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    category?: Category | null;
    isEditing: boolean;
  }>({ isOpen: false, category: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    category?: Category | null;
  }>({ isOpen: false, category: null });

  const incomeCategories = getCategoriesByType('income');
  const expenseCategories = getCategoriesByType('expense');

  /**
   * Abre modal para criar nova categoria
   */
  const handleCreateCategory = (type: 'income' | 'expense') => {
    setEditModal({
      isOpen: true,
      category: { type } as Category,
      isEditing: false,
    });
  };

  /**
   * Abre modal para editar categoria existente
   */
  const handleEditCategory = (category: Category) => {
    setEditModal({
      isOpen: true,
      category,
      isEditing: true,
    });
  };

  /**
   * Abre dialog de confirmação para deletar categoria
   */
  const handleDeleteCategory = (category: Category) => {
    setDeleteDialog({
      isOpen: true,
      category,
    });
  };

  /**
   * Confirma a exclusão da categoria
   */
  const confirmDeleteCategory = async () => {
    if (deleteDialog.category) {
      await deleteCategory(deleteDialog.category.id);
      setDeleteDialog({ isOpen: false, category: null });
    }
  };

  /**
   * Manipula o envio do formulário de categoria
   */
  const handleSubmitCategory = async (data: CategoryFormData) => {
    if (editModal.isEditing && editModal.category) {
      await updateCategory(editModal.category.id, data);
    } else {
      await addCategory(data);
    }
    setEditModal({ isOpen: false, category: null, isEditing: false });
  };

  /**
   * Renderiza uma lista de categorias
   */
  const renderCategoryList = (categories: Category[], type: 'income' | 'expense') => {
    const typeLabel = type === 'income' ? 'Receitas' : 'Despesas';
    const typeIcon = type === 'income' ? TrendingUp : TrendingDown;
    const typeColor = type === 'income' ? 'text-primary' : 'text-destructive';
    const Icon = typeIcon;

    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${typeColor}`} />
              <span>Categorias de {typeLabel}</span>
              <Badge variant="secondary" className="ml-2">
                {categories.length}
              </Badge>
            </div>
            <Button
              onClick={() => handleCreateCategory(type)}
              size="sm"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma categoria de {typeLabel.toLowerCase()} encontrada.</p>
              <p className="text-sm mt-1">Clique em "Nova" para criar uma categoria.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      type === 'income' ? 'bg-primary' : 'bg-destructive'
                    }`} />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                      className="h-8 w-8 p-0"
                      title="Editar categoria"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir categoria"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          <div className="h-32 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciar Categorias</h2>
          <p className="text-muted-foreground mt-1">
            Organize suas receitas e despesas criando categorias personalizadas.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderCategoryList(incomeCategories, 'income')}
        {renderCategoryList(expenseCategories, 'expense')}
      </div>

      {/* Botão Voltar */}
      {onBack && (
        <div className="flex justify-center mt-8">
          <Button
            variant="outline"
            onClick={onBack}
            className="px-6 py-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Dashboard
          </Button>
        </div>
      )}

      {/* Modal de Edição/Criação */}
      <CategoryEditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, category: null, isEditing: false })}
        onSubmit={handleSubmitCategory}
        category={editModal.category}
        isEditing={editModal.isEditing}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, category: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{deleteDialog.category?.name}"?
              Esta ação não pode ser desfeita.
              {deleteDialog.category && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Nota:</strong> Se existirem transações usando esta categoria,
                  a exclusão será impedida.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};