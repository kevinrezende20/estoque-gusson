import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useHospitals } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/hospital/app-header";
import { Plus, Trash2, Building2, Pencil } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/hospitais")({
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
  component: AdminHospitals,
});

function AdminHospitals() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [contact, setContact] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [cmeDelivery, setCmeDelivery] = useState("");
  const [cmePickup, setCmePickup] = useState("");
  const [opmeDelivery, setOpmeDelivery] = useState("");
  const [opmePickup, setOpmePickup] = useState("");
  const queryClient = useQueryClient();
  const { data: hospitals = [], isLoading: loadingList } = useHospitals();

  const openEdit = (hospital: any) => {
    setEditingId(hospital.id);
    setName(hospital.name);
    setCity(hospital.city);
    setContact(hospital.contact || "");
    setCmeDelivery(hospital.cme_delivery_time || "");
    setCmePickup(hospital.cme_pickup_time || "");
    setOpmeDelivery(hospital.opme_delivery_time || "");
    setOpmePickup(hospital.opme_pickup_time || "");
    setOpen(true);
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setName("");
    setCity("");
    setContact("");
    setCmeDelivery("");
    setCmePickup("");
    setOpmeDelivery("");
    setOpmePickup("");
    setOpen(true);
  };

  const handleSaveHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !city) return;
    setIsLoading(true);

    try {
      const payload = {
        name,
        city,
        contact: contact || null,
        cme_delivery_time: cmeDelivery || null,
        cme_pickup_time: cmePickup || null,
        opme_delivery_time: opmeDelivery || null,
        opme_pickup_time: opmePickup || null
      };

      if (editingId) {
        const { error } = await supabase.from('hospitals').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hospitals').insert([payload]);
        if (error) throw error;
      }

      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar hospital.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este hospital? Todos os materiais associados serão excluídos.")) return;
    const { error } = await supabase.from('hospitals').delete().eq('id', id);
    if (error) {
      alert("Erro ao remover hospital.");
      console.error(error);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="page-enter mx-auto max-w-5xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Administração</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Hospitais</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Gerencie o cadastro de hospitais do sistema.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button className="h-10 rounded-xl shadow-sm shadow-primary/30" onClick={handleOpenNew}><Plus className="size-4 mr-1" />Novo Hospital</Button>
            <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl">
              <DialogHeader className="border-b border-border px-6 py-5 pr-14">
                <DialogTitle className="font-display text-xl">{editingId ? "Editar Hospital" : "Cadastrar Hospital"}</DialogTitle>
                <DialogDescription>Preencha os dados do hospital e horários de funcionamento.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveHospital} className="space-y-5 px-6 py-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Hospital</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hospital São Paulo" required className="h-11 rounded-xl bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade / Estado</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo, SP" required className="h-11 rounded-xl bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Telefone / Contato</Label>
                  <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="(11) 4002-8800" className="h-11 rounded-xl bg-card" />
                </div>
                
                <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
                  <h4 className="font-display font-medium text-sm text-foreground">Horários CME</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Entrega</Label>
                      <Input value={cmeDelivery} onChange={(e) => setCmeDelivery(e.target.value)} placeholder="Ex: 08:00 às 10:00" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Retirada</Label>
                      <Input value={cmePickup} onChange={(e) => setCmePickup(e.target.value)} placeholder="Ex: 14:00 às 16:00" className="h-9 text-sm" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
                  <h4 className="font-display font-medium text-sm text-foreground">Horários OPME</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Entrega</Label>
                      <Input value={opmeDelivery} onChange={(e) => setOpmeDelivery(e.target.value)} placeholder="Ex: 09:00 às 11:00" className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Retirada</Label>
                      <Input value={opmePickup} onChange={(e) => setOpmePickup(e.target.value)} placeholder="Ex: 15:00 às 17:00" className="h-9 text-sm" />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 border-t border-border pt-5">
                  <DialogClose asChild><Button type="button" variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
                  <Button type="submit" disabled={isLoading} className="rounded-xl">{isLoading ? "Salvando..." : "Cadastrar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <section className="glass-panel overflow-hidden rounded-3xl">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-display font-semibold">Hospitais Cadastrados</h2>
            <p className="text-xs text-muted-foreground">{loadingList ? 'Carregando...' : `${hospitals.length} hospitais`}</p>
          </div>
          {hospitals.length === 0 && !loadingList ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="size-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhum hospital cadastrado ainda.</p>
            </div>
          ) : (
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Nome</TableHead>
                  <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Cidade</TableHead>
                  <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Contato</TableHead>
                  <TableHead className="px-6 text-right text-[11px] uppercase tracking-[0.1em]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hospitals.map((hospital) => (
                  <TableRow key={hospital.id} className="border-border hover:bg-card/50">
                    <TableCell className="px-6 py-4 font-medium">{hospital.name}</TableCell>
                    <TableCell className="px-6 py-4 text-muted-foreground">{hospital.city}</TableCell>
                    <TableCell className="px-6 py-4 text-muted-foreground">{hospital.contact || '—'}</TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(hospital)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(hospital.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}
