import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, Boxes, Building2, CalendarClock, Search, Truck, AlertCircle, Clock, Minus, CheckCircle, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/hospital/app-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DBHospital, DBMaterial, logAuditAction } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window !== 'undefined') {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw redirect({ to: '/login' });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Locais — Controle Gusson" },
      { name: "description", content: "Painel regional de logística e estoque de materiais hospitalares." },
      { property: "og:title", content: "Locais — Controle Gusson" },
      { property: "og:description", content: "Acompanhe estoques e movimentações dos hospitais da região." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { role, user } = useAuth();
  const [query, setQuery] = useState("");
  const queryClient = useQueryClient();
  
  const { data: hospitals = [], isLoading: loadingHospitals } = useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospitals').select('*').order('name');
      if (error) throw error;
      return data as DBHospital[];
    }
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as DBMaterial[];
    }
  });

  const [standbyMaterialId, setStandbyMaterialId] = useState<string | null>(null);
  const [standbyComment, setStandbyComment] = useState("");

  const visibleHospitals = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return hospitals;
    return hospitals.filter((hospital) => `${hospital.name} ${hospital.city}`.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [query, hospitals]);

  const pendingMaterials = useMemo(() => {
    return materials.filter(m => !m.is_approved || m.pending_withdrawal_boxes > 0 || m.status === 'Standby' || m.status === 'Pendente de verificação');
  }, [materials]);

  const handleStandby = async () => {
    if (!standbyMaterialId) return;
    if (!standbyComment.trim()) {
      alert("Por favor, adicione um comentário sobre o problema.");
      return;
    }
    const material = materials.find(m => m.id === standbyMaterialId);
    if (!material) return;

    const { error } = await supabase.from('materials').update({ 
      status: 'Standby',
      pending_withdrawal_comment: standbyComment.trim()
    }).eq('id', standbyMaterialId);

    if (error) {
      alert("Erro ao colocar em Standby: " + error.message);
    } else {
      if (user) logAuditAction(user.id, material.hospital_id, material.name, 'Enviado para Standby', { comment: standbyComment.trim() });
      setStandbyMaterialId(null);
      setStandbyComment("");
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    }
  };

  const handleApproveAdd = async (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    
    // If it's just 'Pendente de verificação' (Delivery), change it directly to 'Entregue'
    if (material?.status === 'Pendente de verificação') {
      const { error } = await supabase.from('materials').update({ status: 'Entregue' }).eq('id', materialId);
      if (error) {
        alert("Erro ao aprovar verificação de entrega: " + error.message);
      } else {
        if (user) logAuditAction(user.id, material.hospital_id, material.name, 'Entrega Confirmada (Pós-Verificação)', { material_id: materialId, boxes: material.boxes });
        queryClient.invalidateQueries({ queryKey: ['materials'] });
      }
      return;
    }

    const { error } = await supabase.from('materials').update({ is_approved: true, status: 'Em trânsito' }).eq('id', materialId);
    if (error) {
      alert("Erro ao aprovar: " + error.message);
    } else {
      if (user && material) {
        logAuditAction(user.id, material.hospital_id, material.name, 'Aprovação de Entrada (Painel)', { material_id: materialId, boxes: material.boxes });
      }
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    }
  };

  const processTransfer = async (material: DBMaterial, amount: number, destId: string | null) => {
    if (destId) {
      const { error } = await supabase.from('materials').insert([{
        hospital_id: destId,
        section: material.section,
        stock_type: material.stock_type,
        name: material.name,
        boxes: amount,
        status: 'Aguardando',
        is_approved: false,
        created_by: user?.id || null,
        pending_withdrawal_boxes: 0
      }]);
      if (error) {
        console.error("Erro na transferência:", error);
        alert("Erro ao transferir material: " + error.message);
      } else {
        if (user) logAuditAction(user.id, destId, material.name, 'Entrada por Transferência (Pendente)', { boxes: amount, sourceHospitalId: material.hospital_id });
      }
    }
  };

  const handleApproveWithdraw = async (materialId: string, approve: boolean) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    if (approve) {
      const newBoxes = material.boxes - material.pending_withdrawal_boxes;
      let updateError = null;

      if (newBoxes <= 0) {
        const { error } = await supabase.from('materials').delete().eq('id', materialId);
        updateError = error;
      } else {
        const { error } = await supabase.from('materials').update({ 
          boxes: newBoxes, 
          status: material.status === 'Pendente de verificação' ? 'Entregue' : material.status,
          pending_withdrawal_boxes: 0,
          pending_withdrawal_reason: null,
          pending_withdrawal_hospital_id: null,
          pending_withdrawal_comment: null
        }).eq('id', materialId);
        updateError = error;
      }

      if (updateError) {
        alert("Erro ao aprovar: " + updateError.message);
        return;
      }
      if (user) logAuditAction(user.id, material.hospital_id, material.name, 'Aprovação de Saída (Painel)', { material_id: materialId, boxes: material.pending_withdrawal_boxes });

      if (material.pending_withdrawal_reason === 'hospital') {
        await processTransfer(material, material.pending_withdrawal_boxes, material.pending_withdrawal_hospital_id || null);
      }
    } else {
      const { error } = await supabase.from('materials').update({ 
        pending_withdrawal_boxes: 0,
        status: material.status === 'Pendente de verificação' ? 'Entregue' : material.status,
        pending_withdrawal_reason: null,
        pending_withdrawal_hospital_id: null,
        pending_withdrawal_comment: null
      }).eq('id', materialId);
      if (error) {
        alert("Erro ao rejeitar: " + error.message);
        return;
      }
      if (user) logAuditAction(user.id, material.hospital_id, material.name, 'Rejeição de Saída (Painel)', { boxes: material.pending_withdrawal_boxes });
    }
    queryClient.invalidateQueries({ queryKey: ['materials'] });
  };

  const totalBoxes = materials.reduce((sum, mat) => sum + (mat.is_approved ? mat.boxes : 0), 0);
  const totalTransit = materials.filter(m => m.status === 'Em trânsito' && m.is_approved).reduce((sum, m) => sum + m.boxes, 0);
  const totalAlerts = materials.filter(m => m.status === 'Prazo próximo' && m.is_approved).length;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="page-enter mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Painel regional</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Locais</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Acompanhe os materiais hospitalares em trânsito e consignados em cada unidade.</p>
          </div>
          <label className="relative block w-full md:max-w-sm">
            <span className="sr-only">Buscar hospital</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar hospital ou cidade..." className="h-11 rounded-xl bg-card/70 pl-10 backdrop-blur-md" />
          </label>
        </section>

        {['Admin', 'Estoque', 'Conferente'].includes(role || '') && pendingMaterials.length > 0 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 rounded-3xl border border-warning/30 bg-warning/5 p-5 sm:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-warning">
              <AlertCircle className="size-5" />
              <h2 className="font-display text-lg font-bold">Avisos e Pendências ({pendingMaterials.length})</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingMaterials.map(mat => {
                const hospital = hospitals.find(h => h.id === mat.hospital_id);
                const destHospital = mat.pending_withdrawal_hospital_id ? hospitals.find(h => h.id === mat.pending_withdrawal_hospital_id) : null;
                const isAdd = !mat.is_approved;
                const isStandby = mat.status === 'Standby';
                const isVerifiedDelivery = mat.status === 'Pendente de verificação' && mat.pending_withdrawal_boxes === 0;
                const isVerifiedWithdrawal = mat.status === 'Pendente de verificação' && mat.pending_withdrawal_boxes > 0;
                
                return (
                  <div key={`${mat.id}-${isAdd ? 'add' : 'withdraw'}`} className={`flex flex-col justify-between rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md ${isStandby ? 'border-orange-500/50 hover:border-orange-500/80 bg-orange-50/50' : 'border-border/50 hover:border-warning/50'}`}>
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        {isStandby ? (
                          <span className="flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-600"><AlertCircle className="size-3" /> Em Standby</span>
                        ) : isAdd ? (
                          <span className="flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning"><Clock className="size-3" /> Nova Entrada</span>
                        ) : isVerifiedDelivery ? (
                          <span className="flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-600"><CheckCircle className="size-3" /> Verificar Entrega</span>
                        ) : isVerifiedWithdrawal ? (
                          <span className="flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-600"><CheckCircle className="size-3" /> Verificar Retirada</span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive"><Minus className="size-3" /> Retirada Pendente</span>
                        )}
                        <span className="text-[10px] font-medium text-muted-foreground">{mat.section}</span>
                      </div>
                      <p className="font-semibold text-foreground line-clamp-1">{mat.name}</p>
                      
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="size-3" />
                        <Link to="/locais/$hospitalId" params={{ hospitalId: mat.hospital_id }} className="hover:text-primary hover:underline">
                          {hospital?.name || 'Hospital desconhecido'}
                        </Link>
                      </div>

                      {(!isAdd || isStandby) && (
                        <div className="mt-2 rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
                          {!isAdd && mat.pending_withdrawal_boxes > 0 && <p><strong className="font-medium text-foreground">Destino:</strong> {mat.pending_withdrawal_reason === 'hospital' ? `Transferência p/ ${destHospital?.name}` : 'Retorno ao Estoque'}</p>}
                          {mat.pending_withdrawal_comment && <p className="mt-1 italic">"{mat.pending_withdrawal_comment}"</p>}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-3">
                      <span className="text-xs font-medium text-foreground">{isAdd || isVerifiedDelivery ? mat.boxes : mat.pending_withdrawal_boxes} caixas pendentes</span>
                      
                      {isAdd || isVerifiedDelivery ? (
                        <div className="flex items-center gap-2">
                          {!isStandby && (
                            <Button size="sm" variant="outline" className="h-8 flex-1 border-orange-500/30 text-orange-600 hover:bg-orange-500/10" onClick={() => setStandbyMaterialId(mat.id)}>
                              <AlertCircle className="size-3 mr-1.5" /> Standby
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 flex-1 border-accent/30 text-accent hover:bg-accent/10" onClick={() => handleApproveAdd(mat.id)}>
                            <CheckCircle className="size-3 mr-1.5" /> Aprovar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-8 flex-1 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => handleApproveWithdraw(mat.id, false)}>
                              <XCircle className="size-3 mr-1.5" /> Rejeitar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 flex-1 border-accent/30 text-accent hover:bg-accent/10" onClick={() => handleApproveWithdraw(mat.id, true)}>
                              <CheckCircle className="size-3 mr-1.5" /> Aprovar
                            </Button>
                          </div>
                          {!isStandby && (
                            <Button size="sm" variant="outline" className="h-8 w-full border-orange-500/30 text-orange-600 hover:bg-orange-500/10" onClick={() => setStandbyMaterialId(mat.id)}>
                              <AlertCircle className="size-3 mr-1.5" /> Colocar em Standby
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Dialog open={!!standbyMaterialId} onOpenChange={(open) => !open && setStandbyMaterialId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Mover para Standby</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Motivo / Problema encontrado</Label>
                <Textarea 
                  placeholder="Ex: Faltando peça X, caixa quebrada..." 
                  value={standbyComment}
                  onChange={e => setStandbyComment(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setStandbyMaterialId(null)}>Cancelar</Button>
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleStandby}>Confirmar Standby</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <section aria-label="Resumo operacional" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Hospitais ativos", value: hospitals.length, icon: Building2, tone: "text-primary bg-primary/10" },
            { label: "Caixas ativas", value: totalBoxes, icon: Boxes, tone: "text-foreground bg-secondary" },
            { label: "Em trânsito", value: totalTransit, icon: Truck, tone: "text-primary bg-primary/10" },
            { label: "Perto do prazo", value: totalAlerts, icon: CalendarClock, tone: "text-warning bg-warning/10" },
          ].map((metric) => (
            <div key={metric.label} className="glass-subtle rounded-2xl p-4 sm:p-5">
              <div className={`mb-3 grid size-9 place-items-center rounded-xl ${metric.tone}`}><metric.icon className="size-4" /></div>
              <p className="font-display text-2xl font-bold">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </section>

        <section className="glass-panel overflow-hidden rounded-3xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display font-semibold">Hospitais da região</h2>
              <p className="text-xs text-muted-foreground">{loadingHospitals ? 'Carregando...' : `${visibleHospitals.length} locais encontrados`}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {visibleHospitals.map((hospital) => {
              const hospMats = materials.filter(m => m.hospital_id === hospital.id && m.is_approved);
              const activeBoxes = hospMats.reduce((sum, m) => sum + m.boxes, 0);
              const inTransit = hospMats.filter(m => m.status === 'Em trânsito').reduce((sum, m) => sum + m.boxes, 0);
              const alerts = hospMats.filter(m => m.status === 'Prazo próximo').length;

              return (
                <Link key={hospital.id} to="/locais/$hospitalId" params={{ hospitalId: hospital.id }} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-card/60 sm:px-6 sm:py-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display font-bold text-primary">{hospital.name.substring(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{hospital.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hospital.city}{hospital.contact ? ` · ${hospital.contact}` : ''}</span>
                  </span>
                  <span className="hidden grid-cols-3 gap-7 text-right text-xs md:grid">
                    <span><span className="block text-muted-foreground">Caixas ativas</span><strong className="font-display text-base text-foreground">{activeBoxes}</strong></span>
                    <span><span className="block text-muted-foreground">Em trânsito</span><strong className="font-display text-base text-primary">{inTransit}</strong></span>
                    <span><span className="block text-muted-foreground">Alertas</span><strong className="font-display text-base text-warning">{alerts}</strong></span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-all group-hover:translate-x-1 group-hover:bg-primary/10 group-hover:text-primary"><ArrowRight className="size-4" /></span>
                </Link>
              )
            })}
            {visibleHospitals.length === 0 && !loadingHospitals && <div className="px-6 py-14 text-center text-sm text-muted-foreground">Nenhum hospital encontrado.</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
