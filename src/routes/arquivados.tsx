import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/hospital/app-header";
import { MaterialDocumentsDialog } from "@/components/hospital/MaterialDocumentsDialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useWithdrawnLogs, useHospitals, DBAuditLog } from "@/lib/queries";
import { format, parseISO, subDays } from "date-fns";
import { Archive, Building2, Package, Calendar, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/arquivados")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  head: () => ({
    meta: [
      { title: "Materiais Retirados — Controle Gusson" },
    ],
  }),
  component: ArquivadosPage,
});

function ArquivadosPage() {
  const { role } = useAuth();
  const { data: logs = [], isLoading, refetch } = useWithdrawnLogs();
  const { data: hospitals = [] } = useHospitals();
  const [query, setQuery] = useState("");

  // Auto-limpeza de registros com mais de 30 dias
  useEffect(() => {
    const cleanupOldLogs = async () => {
      if (role === 'Admin' || role === 'Estoque') {
        const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
        // Deleta registros de 'audit_logs' que sejam mais antigos que 30 dias
        const { error } = await supabase
          .from('audit_logs')
          .delete()
          .lt('created_at', thirtyDaysAgo);
        
        if (!error) {
          refetch(); // Atualiza a lista após limpeza (se algo foi apagado)
        }
      }
    };
    cleanupOldLogs();
  }, [role, refetch]);

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return logs;
    return logs.filter(log => {
      const hospital = hospitals.find(h => h.id === log.hospital_id);
      const hospitalName = hospital?.name || "";
      const materialName = log.material_name || "";
      return materialName.toLocaleLowerCase("pt-BR").includes(normalized) || 
             hospitalName.toLocaleLowerCase("pt-BR").includes(normalized);
    });
  }, [logs, hospitals, query]);

  const downloadCSV = () => {
    if (filteredLogs.length === 0) return;

    // Cabeçalhos do CSV
    let csvContent = "Data,Material,Quantidade,Hospital de Origem,Usuario\n";

    filteredLogs.forEach(log => {
      const hospital = hospitals.find(h => h.id === log.hospital_id);
      const details = log.details as Record<string, any> | undefined;
      const boxes = details?.['boxes'] || 0;
      const dataFormatada = format(parseISO(log.created_at), "dd/MM/yyyy HH:mm");
      const hospitalNome = hospital?.name || "Desconhecido";
      const usuario = log.users?.email || "Sistema";

      // Adiciona aspa nas strings para evitar quebra de colunas se houver vírgula
      csvContent += `"${dataFormatada}","${log.material_name}","${boxes}","${hospitalNome}","${usuario}"\n`;
    });

    // Cria o arquivo virtual para download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Arquivados_Gusson_${format(new Date(), "dd-MM-yyyy")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (role === "Motorista") {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="page-enter mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Estoque Arquivado</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Materiais Retirados</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Histórico de materiais com saída aprovada. Registros com mais de 30 dias são apagados automaticamente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-lg md:justify-end">
            <label className="relative block w-full">
              <span className="sr-only">Buscar material ou hospital</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={query} 
                onChange={(event) => setQuery(event.target.value)} 
                placeholder="Buscar material ou hospital..." 
                className="h-11 rounded-xl bg-card/70 pl-10 backdrop-blur-md" 
              />
            </label>
            {(role === 'Admin' || role === 'Estoque') && (
              <Button onClick={downloadCSV} variant="outline" className="h-11 border-primary/20 text-primary hover:bg-primary/10 gap-2 whitespace-nowrap">
                <Download className="size-4" /> Exportar
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-2 sm:p-6 shadow-sm overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Carregando dados...</p>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center">
              <Archive className="size-12 text-muted-foreground/30 mb-4" />
              <p className="text-base font-medium text-foreground">Nenhum material retirado encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">Materiais que tiveram saída aprovada nos últimos 30 dias aparecerão aqui.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-3 font-medium text-muted-foreground">Material</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Quantidade</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Hospital de Origem</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Data da Retirada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredLogs.map(log => {
                  const hospital = hospitals.find(h => h.id === log.hospital_id);
                  const details = log.details as Record<string, any> | undefined;
                  const boxes = details?.['boxes'] || 0;
                  
                  return (
                    <tr key={log.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Package className="size-4 text-muted-foreground" />
                          {log.material_name}
                          {details?.['material_id'] && (
                            <MaterialDocumentsDialog materialId={details['material_id']} materialName={log.material_name} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">
                          {boxes} {boxes === 1 ? 'caixa' : 'caixas'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="size-3.5" />
                          {hospital?.name || "Desconhecido"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          {format(parseISO(log.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}
