import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, PackageOpen, Settings, Truck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: '/login', replace: true });
  };

  const userEmail = user?.email || "";
  const displayName = user?.user_metadata?.display_name || userEmail;
  const initials = displayName ? displayName.substring(0, 2).toUpperCase() : "??";

  const { data: standbyCount = 0 } = useQuery({
    queryKey: ['standby_alerts'],
    queryFn: async () => {
      const { count } = await supabase
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Standby');
      return count || 0;
    },
    refetchInterval: 15000, // Atualiza a cada 15 segundos
    enabled: !!user && (role === 'Admin' || role === 'Estoque'), // Apenas Estoque/Admin precisam ver o alerta do Conferente
  });

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label="Controle Gusson — início">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <PackageOpen className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">Controle Gusson</span>
            <span className="block text-[11px] text-muted-foreground">Gestão de Materiais Hospitalares</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          <nav aria-label="Navegação principal" className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
            <Link to="/" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary">Locais</Link>
            <Link to="/guias" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary">Guias</Link>
            <Link to="/arquivados" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary">Arquivados</Link>
            {(role === "Admin" || role === "Motorista") && (
              <Link to="/entregas" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary text-blue-500 font-semibold flex items-center gap-1">
                <Truck className="size-3" /> Entregas
              </Link>
            )}
            {role === "Admin" && (
              <>
                <Link to="/relatorios" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary">Relatórios</Link>
                <Link to="/admin/hospitais" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary">Hospitais</Link>
                <Link to="/admin/usuarios" className="rounded-lg px-3 py-1.5 transition-colors hover:text-primary flex items-center gap-1">
                  <Settings className="size-3" />Usuários
                </Link>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2.5 border-l border-border pl-4">
            {(role === 'Admin' || role === 'Estoque') && (
              <Link to="/" className="relative mr-2 flex items-center justify-center text-muted-foreground hover:text-orange-500 transition-colors" title="Alertas de Standby">
                <Bell className="size-5" />
                {standbyCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white shadow-sm animate-pulse">
                    {standbyCount}
                  </span>
                )}
              </Link>
            )}
            <div className="text-right leading-tight">
              <p className="text-[13px] font-semibold">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">{role || 'Sem nível'}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-accent/15 font-display text-[13px] font-bold text-accent">{initials}</span>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={handleLogout} title="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[85vw] max-w-sm sm:max-w-md pt-12">
            <nav className="flex flex-col gap-4 text-[15px] font-medium text-foreground">
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted">Locais</Link>
              <Link to="/guias" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted">Guias</Link>
              <Link to="/arquivados" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted">Arquivados</Link>
              {(role === "Admin" || role === "Motorista") && (
                <Link to="/entregas" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted text-blue-500 flex items-center gap-2">
                  <Truck className="size-4" /> Entregas
                </Link>
              )}
              {role === "Admin" && (
                <>
                  <Link to="/relatorios" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted">Relatórios</Link>
                  <Link to="/admin/hospitais" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted">Hospitais</Link>
                  <Link to="/admin/usuarios" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg px-3 py-2 transition-colors hover:bg-muted flex items-center gap-2">
                    <Settings className="size-4" /> Usuários
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-8 border-t border-border pt-6 flex items-center gap-3 px-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent/15 font-display text-[15px] font-bold text-accent">{initials}</span>
              <div className="flex-1 leading-tight">
                <p className="text-[14px] font-semibold">{displayName}</p>
                <p className="text-[12px] text-muted-foreground">{role || 'Sem nível'}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} title="Sair">
                <LogOut className="size-5" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
