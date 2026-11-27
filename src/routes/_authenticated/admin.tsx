import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [somAtivo, setSomAtivo] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | Status>("todas");
  const [busca, setBusca] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const reservasConhecidasRef = useRef<Set<string> | null>(null);
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
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("reservas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function tocarSino() {
    const context = audioContextRef.current;
    if (!context || context.state !== "running") return;

    const tocarNota = (frequencia: number, inicio: number) => {
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequencia, context.currentTime + inicio);
      volume.gain.setValueAtTime(0.0001, context.currentTime + inicio);
      volume.gain.exponentialRampToValueAtTime(0.22, context.currentTime + inicio + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + inicio + 1.1);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(context.currentTime + inicio);
      oscillator.stop(context.currentTime + inicio + 1.15);
    };

    // Duas badaladas curtas, lembrando o sino de balcão de hotel.
    tocarNota(880, 0);
    tocarNota(1174, 0.24);
    tocarNota(1568, 0.48);
  }

  async function ativarSom() {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      await audioContextRef.current.resume();
      setSomAtivo(true);
    } catch {
      setFeedback((current) => ({ ...current, geral: "Não foi possível ativar o som neste navegador." }));
    }
  }

  useEffect(() => {
    if (isLoading) return;
    const idsAtuais = new Set(reservas.map((reserva) => reserva.id));
    if (reservasConhecidasRef.current === null) {
      reservasConhecidasRef.current = idsAtuais;
      return;
    }

    const chegouReservaNova = reservas.some((reserva) => !reservasConhecidasRef.current?.has(reserva.id));
    reservasConhecidasRef.current = idsAtuais;
    if (chegouReservaNova && somAtivo) tocarSino();
  }, [reservas, somAtivo, isLoading]);

  const hoje = new Date().toISOString().slice(0, 10);
  const emSeteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const pendentes = reservas.filter((r) => r.status === "pendente");
  const confirmadas = reservas.filter((r) => r.status === "confirmada");
  const canceladas = reservas.filter((r) => r.status === "cancelada");
  const chegadasHoje = reservas.filter((r) => r.status !== "cancelada" && r.check_in === hoje);
  const proximasChegadas = reservas.filter((r) => r.status !== "cancelada" && r.check_in >= hoje && r.check_in <= emSeteDias);
  const totalHospedes = reservas.filter((r) => r.status !== "cancelada").reduce((total, r) => total + Number(r.hospedes || 0), 0);
  const reservasFiltradas = reservas.filter((r) => {
    const correspondeStatus = filtro === "todas" || r.status === filtro;
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const correspondeBusca = !termo || [r.nome, r.email, r.telefone].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(termo));
    return correspondeStatus && correspondeBusca;
  });

  async function confirmarReserva(id: string) {
    setConfirmando(id);
    setFeedback((current) => ({ ...current, [id]: "" }));
    const { error } = await supabase.from("reservas").update({ status: "confirmada" }).eq("id", id);
    setConfirmando(null);

    if (error) {
      setFeedback((current) => ({ ...current, [id]: "Não foi possível confirmar a reserva. Verifique suas permissões e tente novamente." }));
      return;
    }

    setFeedback((current) => ({ ...current, [id]: "Reserva confirmada! Agora envie a confirmação ao cliente pelo WhatsApp ou por e-mail." }));
    await qc.invalidateQueries({ queryKey: ["reservas"] });
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

  async function excluirReserva(id: string, nome: string) {
    const confirmar = window.confirm(`Tem certeza que deseja excluir permanentemente a reserva de ${nome}? Essa ação não poderá ser desfeita.`);
    if (!confirmar) return;

    setExcluindo(id);
    setFeedback((current) => ({ ...current, [id]: "" }));
    const { error } = await supabase.from("reservas").delete().eq("id", id);
    setExcluindo(null);

    if (error) {
      setFeedback((current) => ({ ...current, [id]: "Não foi possível excluir a reserva. Verifique suas permissões e tente novamente." }));
      return;
    }

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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h1 className="text-3xl font-extrabold text-primary">Reservas</h1>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <Button className="w-full" variant="outline" onClick={() => navigate({ to: "/" })}>Voltar ao site</Button>
            <Button className="w-full" variant="outline" onClick={sair}>Sair</Button>
            <Button className="col-span-2 w-full sm:col-span-1 sm:w-auto" variant="outline" onClick={() => somAtivo ? setSomAtivo(false) : ativarSom()}>
              {somAtivo ? "🔕 Desativar sino" : "🔔 Ativar sino de novas reservas"}
            </Button>
          </div>
        </div>
        {feedback.geral && <p className="mb-4 text-sm text-destructive" role="alert">{feedback.geral}</p>}
        {somAtivo && <p className="mb-4 text-sm text-muted-foreground">Aviso sonoro ligado. O painel verifica novas reservas a cada 10 segundos.</p>}
        {isAdmin === false && <p className="text-muted-foreground">Esta conta não tem acesso ao painel.</p>}
        {isAdmin && isLoading && <p className="text-muted-foreground">Carregando painel…</p>}
        {isAdmin && !isLoading && (
          <>
            <section className="mb-8">
              <div className="mb-4">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Visão geral</p>
                <h2 className="text-2xl font-bold text-primary">Resumo da pousada</h2>
                <p className="text-sm text-muted-foreground">Acompanhamento das reservas e chegadas.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Total de reservas", value: reservas.length, note: "Todos os registros", color: "border-l-primary" },
                  { label: "Aguardando confirmação", value: pendentes.length, note: "Precisam de atenção", color: "border-l-amber-500" },
                  { label: "Reservas confirmadas", value: confirmadas.length, note: "Hospedagens confirmadas", color: "border-l-emerald-600" },
                  { label: "Canceladas", value: canceladas.length, note: "Reservas canceladas", color: "border-l-rose-500" },
                  { label: "Chegadas hoje", value: chegadasHoje.length, note: "Check-in previsto para hoje", color: "border-l-sky-500" },
                  { label: "Próximos 7 dias", value: proximasChegadas.length, note: "Chegadas previstas", color: "border-l-violet-500" },
                  { label: "Hóspedes previstos", value: totalHospedes, note: "Em reservas não canceladas", color: "border-l-primary" },
                ].map((item) => (
                  <article key={item.label} className={`rounded-xl border border-l-4 bg-card p-4 shadow-sm ${item.color}`}>
                    <p className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</p>
                    <p className="mt-2 text-3xl font-extrabold text-primary">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="mb-8 rounded-2xl border bg-card p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold text-primary">Próximas chegadas</h2>
                  <p className="text-sm text-muted-foreground">Check-ins previstos para os próximos sete dias.</p>
                </div>
                <Badge variant="secondary">{proximasChegadas.length} reserva(s)</Badge>
              </div>
              {proximasChegadas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chegada prevista neste período.</p> : (
                <div className="divide-y">
                  {proximasChegadas.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div><p className="font-semibold">{r.nome}</p><p className="text-sm text-muted-foreground">{fmt(r.check_in)} · {r.hospedes} hóspede(s)</p></div>
                      <Badge variant={r.status === "confirmada" ? "default" : "secondary"}>{r.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-2xl font-bold text-primary">Gerenciar reservas</h2><p className="text-sm text-muted-foreground">Confirme, cancele ou exclua reservas recebidas.</p></div>
                <input aria-label="Buscar reserva" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone" className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:max-w-xs" />
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {(["todas", "pendente", "confirmada", "cancelada"] as const).map((status) => (
                  <Button key={status} size="sm" variant={filtro === status ? "default" : "outline"} onClick={() => setFiltro(status)}>{status === "todas" ? "Todas" : status[0].toUpperCase() + status.slice(1)}</Button>
                ))}
              </div>
              {reservas.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Nenhuma reserva ainda.</p>}
              {reservas.length > 0 && reservasFiltradas.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">Nenhuma reserva encontrada com esse filtro.</p>}
            </section>
          </>
        )}
        <div className="space-y-4">
          {isAdmin && reservasFiltradas.map((r) => (
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
                {r.email ? <> · <a className="text-primary underline" href={`mailto:${r.email}`}>{r.email}</a></> : <> · <span className="text-destructive">E-mail não informado</span></>}
              </p>
              {r.mensagem && <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={confirmando === r.id || r.status === "confirmada"} onClick={() => confirmarReserva(r.id)}>
                  {confirmando === r.id ? "Confirmando…" : r.status === "confirmada" ? "Reserva confirmada" : "Confirmar reserva"}
                </Button>
                <a
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  href={`https://wa.me/${r.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${r.nome}! Sua reserva na SurfSuites está confirmada. Entrada: ${fmt(r.check_in)}. Saída: ${fmt(r.check_out)}. Hóspedes: ${r.hospedes}. Aguardamos você!`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enviar pelo WhatsApp
                </a>
                {r.email ? (
                  <a
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    href={`mailto:${r.email}?subject=${encodeURIComponent("Confirmação de reserva - SurfSuites")}&body=${encodeURIComponent(`Olá, ${r.nome}! Sua reserva na SurfSuites está confirmada. Entrada: ${fmt(r.check_in)}. Saída: ${fmt(r.check_out)}. Hóspedes: ${r.hospedes}. Aguardamos você! Equipe SurfSuites.`)}`}
                  >
                    Preparar e-mail
                  </a>
                ) : (
                  <Button size="sm" variant="outline" disabled>Cliente sem e-mail</Button>
                )}
                <Button size="sm" variant="outline" disabled={confirmando === r.id || excluindo === r.id} onClick={() => setStatus(r.id, "cancelada")}>Cancelar</Button>
                <Button size="sm" variant="destructive" disabled={confirmando === r.id || excluindo === r.id} onClick={() => excluirReserva(r.id, r.nome)}>
                  {excluindo === r.id ? "Excluindo…" : "Excluir"}
                </Button>
              </div>
              {feedback[r.id] && <p className="mt-3 text-sm text-muted-foreground" role="status">{feedback[r.id]}</p>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
