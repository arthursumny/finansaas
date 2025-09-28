import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // em MB
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.csv,.ofx,.qfx',
  maxSize = 10,
  disabled = false,
  className,
  children
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Função para validar o arquivo selecionado
   */
  const validateFile = (file: File): string | null => {
    // Verificar extensão
    const allowedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension)) {
      return `Tipo de arquivo não suportado. Aceitos: ${accept}`;
    }

    // Verificar tamanho
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `Arquivo muito grande. Tamanho máximo: ${maxSize}MB`;
    }

    return null;
  };

  /**
   * Função para processar o arquivo selecionado
   */
  const handleFileProcess = (file: File) => {
    setError(null);
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  /**
   * Função para lidar com o drop de arquivo
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  /**
   * Função para lidar com o drag over
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!disabled) {
      setDragActive(true);
    }
  };

  /**
   * Função para lidar com o drag leave
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  /**
   * Função para lidar com a seleção de arquivo via input
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  /**
   * Função para remover o arquivo selecionado
   */
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Função para abrir o seletor de arquivos
   */
  const openFileSelector = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  /**
   * Função para formatar o tamanho do arquivo
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Área de Upload */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer',
          {
            'border-primary bg-primary/5': dragActive && !disabled,
            'border-muted-foreground/25 hover:border-muted-foreground/50': !dragActive && !disabled,
            'border-muted-foreground/10 bg-muted/20 cursor-not-allowed': disabled,
            'border-red-300 bg-red-50 dark:bg-red-950': error,
            'border-green-300 bg-green-50 dark:bg-green-950': selectedFile && !error
          }
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={openFileSelector}
      >
        {selectedFile && !error ? (
          // Arquivo selecionado com sucesso
          <div className="space-y-3">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400">
                Arquivo selecionado
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFile();
              }}
              className="mt-2"
            >
              <X className="w-4 h-4 mr-2" />
              Remover arquivo
            </Button>
          </div>
        ) : error ? (
          // Estado de erro
          <div className="space-y-3">
            <AlertCircle className="w-12 h-12 mx-auto text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                Erro no arquivo
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
              }}
              className="mt-2"
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          // Estado inicial
          <div className="space-y-3">
            <Upload className={cn(
              'w-12 h-12 mx-auto',
              disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'
            )} />
            <div>
              <h3 className={cn(
                'text-lg font-semibold',
                disabled ? 'text-muted-foreground/50' : 'text-foreground'
              )}>
                {children || 'Arraste seu arquivo aqui'}
              </h3>
              <p className={cn(
                'text-sm mt-1',
                disabled ? 'text-muted-foreground/50' : 'text-muted-foreground'
              )}>
                ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Formatos aceitos: {accept} • Tamanho máximo: {maxSize}MB
              </p>
            </div>
            {!disabled && (
              <Button variant="outline" size="sm" className="mt-2">
                <FileText className="w-4 h-4 mr-2" />
                Selecionar Arquivo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};

export default FileUpload;