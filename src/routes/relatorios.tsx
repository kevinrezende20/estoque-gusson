import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/hospital/app-header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useAuditLogs, useHospitals } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, CalendarDays, History, PackageOpen, CheckCircle, XCircle, LogOut, Printer, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { exportGlobalReportAsPdf } from "@/lib/pdf-generator";

export const Route = createFileRoute("/relatorios")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  head: () => ({
    meta: [
      { title: "Relatórios — Controle Gusson" },
    ],
  }),
  component: RelatoriosPage,
});

function getActionIcon(actionType: string) {
  if (actionType.includes("Adição")) return <PackageOpen className="size-4 text-primary" />;
  if (actionType.includes("Aprovação")) return <CheckCircle className="size-4 text-accent" />;
  if (actionType.includes("Rejeição")) return <XCircle className="size-4 text-destructive" />;
  if (actionType.includes("Retirada")) return <LogOut className="size-4 text-warning" />;
  return <Activity className="size-4 text-muted-foreground" />;
}

function getActionColor(actionType: string) {
  if (actionType.includes("Adição")) return "bg-primary/10 text-primary";
  if (actionType.includes("Aprovação")) return "bg-accent/10 text-accent";
  if (actionType.includes("Rejeição")) return "bg-destructive/10 text-destructive";
  if (actionType.includes("Retirada")) return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}

function RelatoriosPage() {
  const { role } = useAuth();
  const { data: logs = [], isLoading } = useAuditLogs();
  const { data: hospitals = [] } = useHospitals();
  const [selectedDateStr, setSelectedDateStr] = useState(format(new Date(), "yyyy-MM-dd"));

  if (role !== "Admin") {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-muted-foreground">Apenas administradores têm permissão para acessar o painel de relatórios globais.</p>
        </main>
      </div>
    );
  }

  // --- Linha do Tempo ---
  const formatTimeAgo = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return `Hoje às ${format(date, "HH:mm")}`;
    if (isYesterday(date)) return `Ontem às ${format(date, "HH:mm")}`;
    return format(date, "dd/MM/yyyy 'às' HH:mm");
  };

  // --- Resumo Diário ---
  const dailySummary = useMemo(() => {
    const filteredLogs = logs.filter(log => log.created_at.startsWith(selectedDateStr));
    
    // Agrupar por usuário
    const summary: Record<string, { email: string, adicoes: number, retiradas: number, aprovacoes: number, outras: number }> = {};
    
    filteredLogs.forEach(log => {
      const email = log.users?.email || "Usuário Desconhecido";
      const uid = log.user_id || "unknown";
      
      if (!summary[uid]) {
        summary[uid] = { email, adicoes: 0, retiradas: 0, aprovacoes: 0, outras: 0 };
      }
      
      const action = log.action_type.toLowerCase();
      if (action.includes("adição")) summary[uid].adicoes++;
      else if (action.includes("retirada")) summary[uid].retiradas++;
      else if (action.includes("aprovação") || action.includes("rejeição")) summary[uid].aprovacoes++;
      else summary[uid].outras++;
    });
    
    return Object.values(summary).sort((a, b) => b.adicoes - a.adicoes);
  }, [logs, selectedDateStr]);

  const handleExportPdf = () => {
    exportGlobalReportAsPdf(logs, hospitals);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="page-enter mx-auto max-w-6xl space-y-7 px-4 py-7 sm:px-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Controle e Auditoria</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Relatórios</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground no-print">
              Acompanhe a linha do tempo de alterações ou veja o resumo de produtividade diária.
            </p>
          </div>
          <Button onClick={handleExportPdf} variant="outline" className="no-print gap-2 shadow-sm rounded-xl h-10 w-full sm:w-auto text-primary border-primary/20 hover:bg-primary/5">
            <Download className="size-4" /> Exportar Relatório Oficial (PDF)
          </Button>
        </div>

        <Tabs defaultValue="timeline" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] no-print">
            <TabsTrigger value="timeline" className="flex items-center gap-2"><History className="size-4" /> Linha do Tempo</TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2"><CalendarDays className="size-4" /> Resumo Diário</TabsTrigger>
          </TabsList>
          
          <TabsContent value="timeline" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando histórico...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
                  {logs.map((log) => {
                    const hospital = hospitals.find(h => h.id === log.hospital_id);
                    return (
                      <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        {/* Ícone central */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-card bg-muted text-muted-foreground shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          {getActionIcon(log.action_type)}
                        </div>
                        
                        {/* Card do evento */}
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm transition-all hover:bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${getActionColor(log.action_type)}`}>
                              {log.action_type}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">{formatTimeAgo(log.created_at)}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground mb-1">{log.material_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Por <span className="font-medium text-foreground">{log.users?.email || "Usuário Removido"}</span> 
                            {hospital && <span> em <span className="font-medium text-foreground">{hospital.name}</span></span>}
                          </p>
                          
                          {/* Detalhes do JSON */}
                          {Object.keys(log.details || {}).length > 0 && (
                            <div className="mt-3 bg-muted/30 rounded-lg p-2 text-[11px] text-muted-foreground font-mono">
                              {log.details && log.details['boxes'] && <span>{log.details['boxes']} caixas </span>}
                              {log.details && log.details['reason'] && <span>(Motivo: {log.details['reason']}) </span>}
                              {log.details && log.details['comment'] && <span className="block mt-1 italic">"{log.details['comment']}"</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="daily" className="mt-6">
            <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">Resumo por Usuário</h3>
                <input 
                  type="date" 
                  value={selectedDateStr} 
                  onChange={(e) => setSelectedDateStr(e.target.value)}
                  className="h-9 rounded-lg border border-border/50 bg-background px-3 text-sm shadow-sm"
                />
              </div>

              {dailySummary.length === 0 ? (
                <div className="py-10 text-center">
                  <CalendarDays className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma atividade registrada nesta data.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {dailySummary.map((userStats, idx) => (
                    <div key={idx} className="rounded-xl border border-border/50 p-4">
                      <p className="font-semibold text-sm truncate mb-3">{userStats.email}</p>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center bg-primary/5 rounded px-2 py-1.5">
                          <span className="text-muted-foreground">Novas Entradas</span>
                          <span className="font-semibold text-primary">{userStats.adicoes}</span>
                        </div>
                        <div className="flex justify-between items-center bg-warning/5 rounded px-2 py-1.5">
                          <span className="text-muted-foreground">Retiradas</span>
                          <span className="font-semibold text-warning">{userStats.retiradas}</span>
                        </div>
                        <div className="flex justify-between items-center bg-accent/5 rounded px-2 py-1.5">
                          <span className="text-muted-foreground">Aprovações/Rej.</span>
                          <span className="font-semibold text-accent">{userStats.aprovacoes}</span>
                        </div>
                        {userStats.outras > 0 && (
                          <div className="flex justify-between items-center bg-muted/30 rounded px-2 py-1.5">
                            <span className="text-muted-foreground">Outros</span>
                            <span className="font-semibold text-foreground">{userStats.outras}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
