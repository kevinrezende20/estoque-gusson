import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useGuides } from '@/lib/queries';
import { AppHeader } from '@/components/hospital/app-header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';

export const Route = createFileRoute('/guias')({
  component: GuidesPage,
});

function GuidesPage() {
  const { session, role } = useAuth();
  const isAdmin = role === 'Admin' || role === 'admin';
  const { data: guides, isLoading } = useGuides();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Acesso negado. Por favor, faça login.</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas arquivos de imagem são permitidos.');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const compressImage = async (file: File) => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    };
    try {
      return await imageCompression(file, options);
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const handleCreateGuide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Título e descrição são obrigatórios');
      return;
    }

    try {
      setIsSubmitting(true);
      let photoUrl = null;

      if (selectedFile) {
        const compressedFile = await compressImage(selectedFile);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('guides')
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('guides')
          .getPublicUrl(filePath);
          
        photoUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('procedure_guides')
        .insert({
          title,
          description,
          photo_url: photoUrl
        });

      if (error) throw error;

      toast.success('Guia criado com sucesso!');
      setIsDialogOpen(false);
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['guides'] });

    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao criar guia: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, photoUrl: string | null) => {
    if (!window.confirm('Tem certeza que deseja apagar este guia?')) return;
    
    try {
      const { error } = await supabase.from('procedure_guides').delete().eq('id', id);
      if (error) throw error;

      // Opcional: deletar imagem do storage se existir
      if (photoUrl) {
        const urlParts = photoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        if (fileName) {
          await supabase.storage.from('guides').remove([fileName]);
        }
      }

      toast.success('Guia apagado!');
      queryClient.invalidateQueries({ queryKey: ['guides'] });
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao apagar: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="container mx-auto p-4 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Guias e Procedimentos</h1>
            <p className="text-slate-500 mt-2">Consulte o material explicativo para cada kit/procedimento.</p>
          </div>
          
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-800 hover:bg-slate-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Guia
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Criar Novo Guia</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateGuide} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título do Procedimento/Kit</Label>
                    <Input 
                      id="title" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Ex: Kit de Artroscopia"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="desc">Descrição / Itens do Kit</Label>
                    <Textarea 
                      id="desc" 
                      rows={5}
                      value={description} 
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Descreva o que compõe este kit, passos importantes, etc..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Foto Ilustrativa (Opcional)</Label>
                    <div className="flex items-center gap-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Escolher Foto
                      </Button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept="image/*" 
                        className="hidden" 
                      />
                    </div>
                    {previewUrl && (
                      <div className="mt-4 rounded-md overflow-hidden border border-slate-200">
                        <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-48 object-cover" />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button type="submit" disabled={isSubmitting} className="bg-slate-800 hover:bg-slate-700">
                      {isSubmitting ? 'Salvando...' : 'Salvar Guia'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
          </div>
        ) : !guides || guides.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500">
            Nenhum guia foi cadastrado ainda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map(guide => (
              <div key={guide.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {guide.photo_url ? (
                  <div className="aspect-video w-full overflow-hidden bg-slate-100">
                    <img 
                      src={guide.photo_url} 
                      alt={guide.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full bg-slate-50 flex items-center justify-center border-b border-slate-100">
                    <ImageIcon className="h-8 w-8 text-slate-300" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-slate-800 leading-tight">{guide.title}</h3>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDelete(guide.id, guide.photo_url)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Apagar Guia"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap">{guide.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
