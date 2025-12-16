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
import { Plus, Edit, Trash2, ArrowLeft, Tag as TagIcon } from 'lucide-react';
import { useTags, Tag, TagFormData } from '@/hooks/useTags';
import { TagEditModal } from './TagEditModal';

interface TagManagerProps {
  onBack?: () => void;
}

/**
 * Componente para gerenciar tags de transações
 */
export const TagManager = ({ onBack }: TagManagerProps) => {
  const {
    tags,
    loading,
    addTag,
    updateTag,
    deleteTag,
  } = useTags();

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    tag?: Tag | null;
    isEditing: boolean;
  }>({ isOpen: false, tag: null, isEditing: false });

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    tag?: Tag | null;
  }>({ isOpen: false, tag: null });

  /**
   * Abre modal para criar nova tag
   */
  const handleCreateTag = () => {
    setEditModal({
      isOpen: true,
      tag: null,
      isEditing: false,
    });
  };

  /**
   * Abre modal para editar tag existente
   */
  const handleEditTag = (tag: Tag) => {
    setEditModal({
      isOpen: true,
      tag,
      isEditing: true,
    });
  };

  /**
   * Abre dialog de confirmação para deletar tag
   */
  const handleDeleteTag = (tag: Tag) => {
    setDeleteDialog({
      isOpen: true,
      tag,
    });
  };

  /**
   * Confirma a exclusão da tag
   */
  const confirmDeleteTag = async () => {
    if (deleteDialog.tag) {
      await deleteTag(deleteDialog.tag.id);
      setDeleteDialog({ isOpen: false, tag: null });
    }
  };

  /**
   * Manipula o envio do formulário de tag
   */
  const handleSubmitTag = async (data: TagFormData) => {
    if (editModal.isEditing && editModal.tag) {
      await updateTag(editModal.tag.id, data);
    } else {
      await addTag(data);
    }
    setEditModal({ isOpen: false, tag: null, isEditing: false });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gerenciar Tags</h2>
          <p className="text-muted-foreground mt-1">
            Crie tags personalizadas para organizar e filtrar suas transações.
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <TagIcon className="h-5 w-5 text-primary" />
              <span>Suas Tags</span>
              <Badge variant="secondary" className="ml-2">
                {tags.length}
              </Badge>
            </div>
            <Button
              onClick={handleCreateTag}
              size="sm"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova Tag
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <TagIcon className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>Nenhuma tag encontrada.</p>
              <p className="text-sm mt-1">Clique em "Nova Tag" para criar uma tag.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <Badge
                      variant="outline"
                      style={{ 
                        backgroundColor: tag.color + '15', 
                        borderColor: tag.color + '40', 
                        color: tag.color 
                      }}
                    >
                      {tag.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTag(tag)}
                      className="h-8 w-8 p-0"
                      title="Editar tag"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTag(tag)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir tag"
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
      <TagEditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, tag: null, isEditing: false })}
        onSubmit={handleSubmitTag}
        tag={editModal.tag}
        isEditing={editModal.isEditing}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, tag: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tag "{deleteDialog.tag?.name}"?
              Esta ação não pode ser desfeita.
              {deleteDialog.tag && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <strong>Nota:</strong> Se existirem transações usando esta tag,
                  a exclusão será impedida. Remova as tags das transações primeiro.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTag}
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

