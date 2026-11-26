import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Reservas — Painel Pousada do Surf" },
      { name: "description", content: "Gerencie as reservas da Pousada do Surf." },
      { property: "og:title", content: "Reservas — Painel" },
      { property: "og:description", content: "Gerencie as reservas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Status = "pendente" | "confirmada" | "cancelada";
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.rpc("has_role", { _user_id: u.user!.id, _role: "admin" });
      return !!data;
    },
  });
  const { data: reservas = [], isLoading } = useQuery({
    queryKey: ["reservas"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function setStatus(id: string, status: Status) {
    await supabase.from("reservas").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["reservas"] });
  }
  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-muted px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-primary">Reservas</h1>
          <Button variant="outline" onClick={sair}>Sair</Button>
        </div>
        {isAdmin === false && <p className="text-muted-foreground">Esta conta não tem acesso ao painel.</p>}
        {isAdmin && isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {isAdmin && !isLoading && reservas.length === 0 && <p className="text-muted-foreground">Nenhuma reserva ainda.</p>}
        <div className="space-y-4">
          {reservas.map((r) => (
            <article key={r.id} className="rounded-2xl bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">{r.nome}</h2>
                  <p className="text-sm text-muted-foreground">
                    {fmt(r.check_in)} → {fmt(r.check_out)} · {r.hospedes} hóspede(s)
                  </p>
                </div>
                <Badge variant={r.status === "confirmada" ? "default" : r.status === "cancelada" ? "destructive" : "secondary"}>
                  {r.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm">
                <a className="text-primary underline" href={`https://wa.me/${r.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                {r.email && <> · {r.email}</>}
              </p>
              {r.mensagem && <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>}
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setStatus(r.id, "confirmada")}>Confirmar</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "cancelada")}>Cancelar</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
