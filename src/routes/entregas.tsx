import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/hospital/app-header";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DBHospital, DBMaterial, logAuditAction } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { Truck, MapPin, CheckCircle, Search, Building2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";

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
      const { data, error } = await supabase.from('materials').select('*').eq('status', 'Em trânsito').eq('is_approved', true);
      if (error) throw error;
      return data as DBMaterial[];
    }
  });

  const transitMaterials = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    let result = materials;
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
  }, [materials, hospitals, query]);

  // Agrupar por hospital
  const groupedByHospital = useMemo(() => {
    const groups: Record<string, { hospital: DBHospital, materials: DBMaterial[] }> = {};
    transitMaterials.forEach(mat => {
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
  }, [transitMaterials, hospitals]);

  const handleDeliver = async (material: DBMaterial) => {
    if (!confirm(`Confirmar entrega de ${material.name}?`)) return;
    setIsProcessing(material.id);

    try {
      const { error } = await supabase.from('materials').update({ status: 'Entregue' }).eq('id', material.id);
      if (error) throw error;

      if (user) {
        logAuditAction(user.id, material.hospital_id, material.name, 'Entrega Confirmada', { boxes: material.boxes });
      }

      queryClient.invalidateQueries({ queryKey: ['materials_transit'] });
    } catch (err: any) {
      alert("Erro ao confirmar entrega: " + err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <main className="page-enter mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Logística</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl flex items-center gap-2">
            <Truck className="size-6 text-primary" /> Minhas Entregas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Confirme a entrega de materiais que estão em rota.</p>
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
              <CheckCircle className="size-6" />
            </div>
            <h3 className="font-display text-lg font-medium">Tudo entregue!</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              Não há materiais em trânsito no momento ou a sua busca não encontrou resultados.
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
                  {materials.map(mat => (
                    <div key={mat.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] uppercase">
                            {mat.section}
                          </Badge>
                          <span className="text-[10px] font-medium text-muted-foreground uppercase">{mat.stock_type}</span>
                        </div>
                        <h3 className="font-medium text-sm text-foreground flex items-center gap-1.5">
                          <Package className="size-3.5 text-muted-foreground" />
                          {mat.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mat.boxes} caixa{mat.boxes !== 1 && 's'}
                        </p>
                      </div>
                      
                      <Button 
                        onClick={() => handleDeliver(mat)}
                        disabled={isProcessing === mat.id}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-sm"
                      >
                        {isProcessing === mat.id ? "Processando..." : (
                          <>
                            <CheckCircle className="size-4 mr-2" />
                            Entregue
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
