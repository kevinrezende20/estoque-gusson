import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export function DisplayNamePrompt() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Se o usuário está logado mas NÃO tem o display_name no metadata, abre o modal
    if (user && !user.user_metadata?.['display_name']) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, digite um nome válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: name.trim() }
      });

      if (error) throw error;
      
      toast.success("Nome atualizado com sucesso!");
      setIsOpen(false);
      // Força um reload para o AppHeader pegar o novo user metadata caso não seja reativo
      window.location.reload(); 
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao atualizar o nome: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Como devemos te chamar?</DialogTitle>
          <DialogDescription>
            Parece que é o seu primeiro acesso. Escolha um nome para exibição no sistema.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Input 
              placeholder="Digite seu nome (Ex: João Silva)" 
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar e Continuar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
