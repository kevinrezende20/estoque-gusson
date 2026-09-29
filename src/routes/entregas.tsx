import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/hospital/app-header";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DBHospital, DBMaterial, logAuditAction, uploadMaterialDocument } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { Truck, MapPin, Search, Building2, Package, Upload, ArrowUpFromLine, ArrowDownToLine, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DeliverySignatureDialog, type DeliverySignatureResult } from "@/components/hospital/DeliverySignatureDialog";
import { MaterialDocumentsDialog } from "@/components/hospital/MaterialDocumentsDialog";
export const Route = createFileRoute("/entregas")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).single();
    if (data?.role !== 'Admin' && data?.role !== 'Motorista') {
      throw redirect({ to: '/' });
    }
  },
  component: EntregasPage,
});

function EntregasPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<{ mat: DBMaterial, type: 'entrega' | 'retirada' } | null>(null);

  const { data: hospitals = [] } = useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospitals').select('*');
      if (error) throw error;
      return data as DBHospital[];
    }
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['materials_transit'],
    queryFn: async () => {
      // Pega todos os materiais aprovados e filtra no cliente para cobrir entregas e retiradas
      const { data, error } = await supabase.from('materials').select('*').eq('is_approved', true);
      if (error) throw error;
      return data as DBMaterial[];
    }
  });

  const activeMaterials = useMemo(() => {
    return materials.filter(m => 
      (m.status === 'Em trânsito') || 
      (m.status === 'Pendente de verificação') ||
      (m.pending_withdrawal_boxes > 0)
    );
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    let result = activeMaterials;
    if (normalized) {
      result = result.filter(m => {
        const hospital = hospitals.find(h => h.id === m.hospital_id);
        const nameMatch = m.name.toLocaleLowerCase("pt-BR").includes(normalized);
        const hospMatch = hospital?.name.toLocaleLowerCase("pt-BR").includes(normalized);
        const cityMatch = hospital?.city.toLocaleLowerCase("pt-BR").includes(normalized);
        return nameMatch || hospMatch || cityMatch;
      });
    }
    return result;
  }, [activeMaterials, hospitals, query]);

  const groupedByHospital = useMemo(() => {
    const groups: Record<string, { hospital: DBHospital, materials: DBMaterial[] }> = {};
    filteredMaterials.forEach(mat => {
      if (!groups[mat.hospital_id]) {
        const hosp = hospitals.find(h => h.id === mat.hospital_id);
        if (hosp) {
          groups[mat.hospital_id] = { hospital: hosp, materials: [] };
        }
      }
      if (groups[mat.hospital_id]) {
        groups[mat.hospital_id].materials.push(mat);
      }
    });
    return Object.values(groups);
  }, [filteredMaterials, hospitals]);

  const handleActionClick = (mat: DBMaterial, type: 'entrega' | 'retirada') => {
    setSelectedMaterial({ mat, type });
    setDialogOpen(true);
  };

  const handleSaveSignature = async (result: DeliverySignatureResult) => {
    if (!selectedMaterial || !user) return;
    const { mat, type } = selectedMaterial;
    
    setDialogOpen(false);
    setIsProcessing(mat.id);

    try {
      for (const photo of result.photos) {
        await uploadMaterialDocument(mat.id, user.id, 'foto', type, photo);
      }
      
      if (result.signatureDriver) {
        await uploadMaterialDocument(mat.id, user.id, 'assinatura', type, result.signatureDriver);
      }
      if (result.signatureNurse) {
        await uploadMaterialDocument(mat.id, user.id, 'assinatura', type, result.signatureNurse); 
      }

      if (result.checklistFiles && result.checklistFiles.length > 0) {
        for (const file of result.checklistFiles) {
          await uploadMaterialDocument(mat.id, user.id, 'checklist', type, file);
        }
      }

      const { error } = await supabase.from('materials').update({ status: 'Pendente de verificação' }).eq('id', mat.id);
      if (error) throw error;

      logAuditAction(user.id, mat.hospital_id, mat.name, `Verificação de ${type === 'entrega' ? 'Entrega' : 'Retirada'} (Motorista)`, { boxes: mat.boxes });

      queryClient.invalidateQueries({ queryKey: ['materials_transit'] });
    } catch (err: any) {
      alert("Erro ao confirmar e enviar documentos: " + err.message);
    } finally {
      setIsProcessing(null);
      setSelectedMaterial(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <main className="page-enter mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Logística</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <Truck className="size-6 text-primary" /> Minha Rota
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Confirme entregas e retiradas pendentes.</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Buscar por hospital, material ou cidade..." 
            className="h-11 rounded-xl bg-card pl-9 shadow-sm" 
          />
        </div>

        {groupedByHospital.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-16 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground mb-4">
              <Truck className="size-6" />
            </div>
            <h3 className="font-display text-lg font-medium">Rota finalizada!</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              Não há materiais pendentes para entrega ou retirada.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByHospital.map(({ hospital, materials }) => (
              <section key={hospital.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <h2 className="font-display font-semibold text-foreground">{hospital.name}</h2>
                    </div>
                    <Badge variant="outline" className="bg-background">
                      {materials.length} ite{materials.length === 1 ? 'm' : 'ns'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    <span>{hospital.city}</span>
                  </div>
                </div>
                
                <div className="divide-y divide-border">
                  {materials.map(mat => {
                    const isPendenteVerificacao = mat.status === 'Pendente de verificação';
                    const isEntrega = (mat.status === 'Em trânsito' || (isPendenteVerificacao && mat.pending_withdrawal_boxes === 0));
                    const isRetirada = (mat.pending_withdrawal_boxes > 0 && !isEntrega) || (isPendenteVerificacao && mat.pending_withdrawal_boxes > 0);
                    
                    return (
                      <div key={mat.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4 transition-colors ${isPendenteVerificacao ? 'bg-muted/10 opacity-80' : 'hover:bg-muted/30'}`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            {isEntrega && (
                              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] uppercase">
                                <ArrowDownToLine className="size-3 mr-1" /> Entrega
                              </Badge>
                            )}
                            {isRetirada && (
                              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-[10px] uppercase">
                                <ArrowUpFromLine className="size-3 mr-1" /> Retirada
                              </Badge>
                            )}
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">{mat.section} · {mat.stock_type}</span>
                          </div>
                          <h3 className="font-medium text-sm text-foreground flex items-center gap-1.5">
                            <Package className="size-3.5 text-muted-foreground" />
                            {mat.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isEntrega ? mat.boxes : mat.pending_withdrawal_boxes} caixa(s)
                          </p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-0">
                          <MaterialDocumentsDialog materialId={mat.id} materialName={mat.name} />
                          <Button 
                            onClick={() => handleActionClick(mat, isEntrega ? 'entrega' : 'retirada')}
                            disabled={isProcessing === mat.id || isPendenteVerificacao}
                            variant={isPendenteVerificacao ? "outline" : "default"}
                            className={`w-full sm:w-auto shadow-sm ${!isPendenteVerificacao && (isEntrega ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white')}`}
                          >
                            {isProcessing === mat.id ? (
                              <><Loader2 className="size-4 mr-2 animate-spin" /> Processando...</>
                            ) : isPendenteVerificacao ? (
                              <><Loader2 className="size-4 mr-2" /> Pendente de verificação</>
                            ) : (
                              <>
                                <Upload className="size-4 mr-2" />
                                {isEntrega ? 'Confirmar Entrega' : 'Confirmar Retirada'}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {selectedMaterial && (
          <DeliverySignatureDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={`Documentação de ${selectedMaterial.type === 'entrega' ? 'Entrega' : 'Retirada'}`}
            description={`Material: ${selectedMaterial.mat.name}`}
            onSave={handleSaveSignature}
          />
        )}
      </main>
    </div>
  );
}
