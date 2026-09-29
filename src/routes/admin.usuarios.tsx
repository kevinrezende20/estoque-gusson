import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { AppHeader } from "@/components/hospital/app-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/usuarios")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
    if (data?.role !== 'Admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminUsuarios,
});

type UserView = {
  id: string;
  email: string;
  display_name: string | null;
  role: string | null;
  created_at: string;
};

const ROLES = ["Admin", "Estoque", "Conferente", "Motorista", "Remover Acesso"];

function AdminUsuarios() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users_view')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserView[];
    }
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Tem certeza que deseja alterar o acesso deste usuário para ${newRole}?`)) return;
    setUpdatingId(userId);

    try {
      if (newRole === "Remover Acesso") {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').upsert({
          user_id: userId,
          role: newRole
        }, { onConflict: 'user_id' });
        
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    } catch (err: any) {
      console.error(err);
      alert("Erro ao alterar cargo: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="page-enter mx-auto max-w-5xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Administração</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Usuários e Acessos</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Aprove novos cadastros e gerencie os níveis de acesso de todos os funcionários.
            </p>
          </div>
        </div>

        <section className="glass-panel overflow-hidden rounded-3xl">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-display font-semibold">Membros da Plataforma</h2>
          </div>
          
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Usuário</TableHead>
                <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Data de Cadastro</TableHead>
                <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Status / Cargo Atual</TableHead>
                <TableHead className="px-6 text-right text-[11px] uppercase tracking-[0.1em]">Ação (Atribuir Cargo)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Carregando usuários...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isPending = !u.role;
                  return (
                    <TableRow key={u.id} className="border-border hover:bg-card/50">
                      <TableCell className="px-6 py-4">
                        <div className="font-medium">{u.display_name || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {isPending ? (
                          <Badge className="bg-warning/15 text-warning border-warning/30">Aguardando Aprovação</Badge>
                        ) : (
                          <Badge className="bg-primary/10 text-primary border-primary/20">{u.role}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Select 
                          disabled={updatingId === u.id} 
                          onValueChange={(val) => handleRoleChange(u.id, val)}
                        >
                          <SelectTrigger className="w-[160px] h-8 ml-auto text-xs">
                            <SelectValue placeholder={updatingId === u.id ? "Alterando..." : isPending ? "Aprovar como..." : "Alterar cargo..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => (
                              <SelectItem key={r} value={r} className={r === 'Remover Acesso' ? 'text-destructive font-medium' : ''}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}
