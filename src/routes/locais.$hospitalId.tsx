import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppHeader } from "@/components/hospital/app-header";
import { HospitalDetail } from "@/components/hospital/hospital-detail";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/locais/$hospitalId")({
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
      { title: "Hospital — Controle Gusson" },
      { property: "og:title", content: "Hospital — Controle Gusson" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HospitalPage,
});

function HospitalPage() {
  const { hospitalId } = Route.useParams();
  return (
    <div className="min-h-screen">
      <AppHeader />
      <HospitalDetail hospitalId={hospitalId} />
    </div>
  );
}
