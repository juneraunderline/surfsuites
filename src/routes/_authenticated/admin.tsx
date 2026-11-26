import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmarReservaEEnviarEmail } from "@/lib/confirm-reservation";
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
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const { data: isAdmin } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data, error } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      if (error) throw error;
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

  async function confirmarEEnviar(id: string) {
    setConfirmando(id);
    setFeedback((current) => ({ ...current, [id]: "" }));
    try {
      const result = await confirmarReservaEEnviarEmail({ data: { id } });
      setFeedback((current) => ({ ...current, [id]: result.message }));
      await qc.invalidateQueries({ queryKey: ["reservas"] });
    } catch (error) {
      setFeedback((current) => ({
        ...current,
        [id]: error instanceof Error ? error.message : "Não foi possível confirmar a reserva.",
      }));
    } finally {
      setConfirmando(null);
    }
  }

  async function setStatus(id: string, status: Status) {
    const { error } = await supabase.from("reservas").update({ status }).eq("id", id);
    if (error) {
      setFeedback((current) => ({ ...current, [id]: "Não foi possível atualizar o status da reserva." }));
      return;
    }
    setFeedback((current) => ({ ...current, [id]: "" }));
    await qc.invalidateQueries({ queryKey: ["reservas"] });
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
                <a className="text-primary underline" href={`https://wa.me/${r.telefone.replace(/\\D/g, "")}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                {r.email ? <> · {r.email}</> : <> · <span className="text-destructive">E-mail não informado</span></>}
              </p>
              {r.mensagem && <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={confirmando === r.id || !r.email} onClick={() => confirmarEEnviar(r.id)}>
                  {confirmando === r.id ? "Enviando…" : r.status === "confirmada" ? "Reenviar e-mail" : "Confirmar e enviar e-mail"}
                </Button>
                <Button size="sm" variant="outline" disabled={confirmando === r.id} onClick={() => setStatus(r.id, "cancelada")}>Cancelar</Button>
              </div>
              {feedback[r.id] && <p className="mt-3 text-sm text-muted-foreground" role="status">{feedback[r.id]}</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
