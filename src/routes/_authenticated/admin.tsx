import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer, getVideoEmbed } from "@/components/video-player";

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

function detalhesHospedes(reserva: { hospedes: number | string | null; mensagem?: string | null }) {
  const mensagemOriginal = String(reserva.mensagem || "");
  const matchCriancas = mensagemOriginal.match(/\s*Crianças:\s*(\d+)(?:\s*\(idades:\s*([^)]+)\))?\.?/i);
  const criancas = matchCriancas ? Number(matchCriancas[1]) : 0;
  const idades = matchCriancas?.[2]?.trim();
  const adultos = Number(reserva.hospedes || 0);
  const partes = [
    `${adultos} hóspede${adultos === 1 ? "" : "s"} adulto${adultos === 1 ? "" : "s"}`,
  ];
  if (criancas > 0) {
    partes.push(`${criancas} criança${criancas === 1 ? "" : "s"}${idades ? ` (idades: ${idades})` : ""}`);
  }
  return {
    resumo: partes.join(" + "),
    mensagem: mensagemOriginal.replace(matchCriancas?.[0] || "", "").trim(),
    criancas,
  };
}

// O WhatsApp exige o número internacional: código do Brasil (55) + DDD + telefone.
const telefoneWhatsApp = (telefone: string) => {
  const digitos = String(telefone || "").replace(/\D/g, "").replace(/^0+/, "");
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
};

function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [somAtivo, setSomAtivo] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | Status>("todas");
  const [busca, setBusca] = useState("");
  const [videoTitulo, setVideoTitulo] = useState("");
  const [videoDescricao, setVideoDescricao] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoOrdem, setVideoOrdem] = useState("0");
  const [salvandoVideo, setSalvandoVideo] = useState(false);
  const [videoFeedback, setVideoFeedback] = useState("");
  const [arquivoVideo, setArquivoVideo] = useState<File | null>(null);
  const [tituloArquivo, setTituloArquivo] = useState("");
  const [descricaoArquivo, setDescricaoArquivo] = useState("");
  const [ordemArquivo, setOrdemArquivo] = useState("0");
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [bucketPronto, setBucketPronto] = useState(false);
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
  useEffect(() => {
    if (isAdmin !== true) return;
    let cancelado = false;
    async function prepararBucket() {
      const { data, error } = await supabase.storage.getBucket("videos-pousada");
      if (!error && data) {
        if (!cancelado) setBucketPronto(true);
        return;
      }
      const { error: criarErro } = await supabase.storage.createBucket("videos-pousada", {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime", "video/ogg"],
      });
      if (criarErro && !cancelado) {
        setVideoFeedback("Não foi possível preparar o espaço de vídeos. " + criarErro.message);
        return;
      }
      if (!cancelado) setBucketPronto(true);
    }
    void prepararBucket();
    return () => { cancelado = true; };
  }, [isAdmin]);

  const { data: videos = [], refetch: recarregarVideos } = useQuery({
    queryKey: ["videos-pousada-admin"],
    enabled: isAdmin === true,
    queryFn: async () => {
      const { data, error } = await supabase.from("videos_pousada").select("*").order("ordem", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
  const totalHospedes = reservas.filter((r) => r.status !== "cancelada").reduce((total, r) => total + Number(r.hospedes || 0) + detalhesHospedes(r).criancas, 0);
  const reservasFiltradas = reservas.filter((r) => {
    const correspondeStatus = filtro === "todas" || r.status === filtro;
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const correspondeBusca = !termo || [r.nome, r.email, r.telefone].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(termo));
    return correspondeStatus && correspondeBusca;
  });

  async function adicionarVideo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const embed = getVideoEmbed(videoUrl.trim());
    if (!embed) {
      setVideoFeedback("Cole um link público do YouTube, Instagram, TikTok, Facebook ou Vimeo.");
      return;
    }
    setSalvandoVideo(true);
    setVideoFeedback("");
    const { error } = await supabase.from("videos_pousada").insert({
      titulo: videoTitulo.trim(),
      descricao: videoDescricao.trim() || null,
      url: videoUrl.trim(),
      plataforma: embed.platform,
      ordem: Number(videoOrdem) || 0,
      ativo: true,
    });
    setSalvandoVideo(false);
    if (error) {
      setVideoFeedback("Não foi possível salvar o vídeo. Confira os dados e tente novamente.");
      return;
    }
    setVideoTitulo("");
    setVideoDescricao("");
    setVideoUrl("");
    setVideoOrdem("0");
    setVideoFeedback("Vídeo adicionado à galeria!");
    await recarregarVideos();
  }

  async function enviarArquivoVideo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!arquivoVideo) {
      setVideoFeedback("Selecione um vídeo do computador ou celular.");
      return;
    }
    const tiposPermitidos = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];
    if (!tiposPermitidos.includes(arquivoVideo.type)) {
      setVideoFeedback("Formato não aceito. Envie MP4, WebM, MOV ou OGG.");
      return;
    }
    const limite = 50 * 1024 * 1024;
    if (arquivoVideo.size > limite) {
      setVideoFeedback("O vídeo ultrapassa o limite de 50 MB.");
      return;
    }
    if (tituloArquivo.trim().length < 2) {
      setVideoFeedback("Informe um título com pelo menos 2 caracteres.");
      return;
    }

    setEnviandoArquivo(true);
    setVideoFeedback("");
    const extensao = arquivoVideo.name.split(".").pop()?.toLowerCase() || "mp4";
    const caminho = `${crypto.randomUUID()}.${extensao}`;
    const { error: uploadError } = await supabase.storage
      .from("videos-pousada")
      .upload(caminho, arquivoVideo, { cacheControl: "3600", upsert: false, contentType: arquivoVideo.type });
    if (uploadError) {
      setEnviandoArquivo(false);
      setVideoFeedback("Falha ao enviar o arquivo: " + uploadError.message);
      return;
    }
    const { data: publicUrl } = supabase.storage.from("videos-pousada").getPublicUrl(caminho);
    const { error: insertError } = await supabase.from("videos_pousada").insert({
      titulo: tituloArquivo.trim(),
      descricao: descricaoArquivo.trim() || null,
      url: publicUrl.publicUrl,
      plataforma: "arquivo",
      ordem: Number(ordemArquivo) || 0,
      ativo: true,
    });
    if (insertError) {
      await supabase.storage.from("videos-pousada").remove([caminho]);
      setEnviandoArquivo(false);
      setVideoFeedback("O arquivo foi enviado, mas não foi possível cadastrá-lo na galeria: " + insertError.message);
      return;
    }
    setArquivoVideo(null);
    setTituloArquivo("");
    setDescricaoArquivo("");
    setOrdemArquivo("0");
    setEnviandoArquivo(false);
    setVideoFeedback("Vídeo enviado e publicado na galeria!");
    await recarregarVideos();
  }

  async function alternarVideo(id: string, ativo: boolean) {
    const { error } = await supabase.from("videos_pousada").update({ ativo: !ativo, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      setVideoFeedback("Não foi possível atualizar a exibição do vídeo.");
      return;
    }
    setVideoFeedback("Exibição do vídeo atualizada.");
    await recarregarVideos();
  }

  async function excluirVideo(id: string, titulo: string) {
    if (!window.confirm(`Excluir o vídeo "${titulo}" da galeria?`)) return;
    const video = videos.find((item) => item.id === id);
    const { error } = await supabase.from("videos_pousada").delete().eq("id", id);
    if (error) {
      setVideoFeedback("Não foi possível excluir o vídeo: " + error.message);
      return;
    }
    if (video?.plataforma === "arquivo") {
      const marcador = "/storage/v1/object/public/videos-pousada/";
      const indice = video.url.indexOf(marcador);
      if (indice >= 0) {
        const caminho = decodeURIComponent(video.url.slice(indice + marcador.length));
        await supabase.storage.from("videos-pousada").remove([caminho]);
      }
    }
    setVideoFeedback("Vídeo excluído da galeria.");
    await recarregarVideos();
  }

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
              <div className="mb-5">
                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Conteúdo do site</p>
                <h2 className="text-2xl font-bold text-primary">Vídeos da pousada</h2>
                <p className="text-sm text-muted-foreground">Envie arquivos do computador ou celular, ou adicione links públicos de redes sociais.</p>
              </div>
              <form onSubmit={enviarArquivoVideo} className="mb-6 grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <h3 className="font-semibold text-primary">Enviar vídeo do dispositivo</h3>
                  <p className="text-xs text-muted-foreground">Escolha um arquivo na pasta do computador ou na galeria do celular. Limite: 50 MB por vídeo.</p>
                </div>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">Arquivo de vídeo
                  <input type="file" required accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg" onChange={(e) => setArquivoVideo(e.target.files?.[0] || null)} className="w-full rounded-md border bg-background px-3 py-2 font-normal file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
                </label>
                {arquivoVideo && <p className="text-xs text-muted-foreground sm:col-span-2">{arquivoVideo.name} · {(arquivoVideo.size / (1024 * 1024)).toFixed(1)} MB</p>}
                <label className="space-y-1 text-sm font-medium">Título
                  <input required minLength={2} maxLength={120} value={tituloArquivo} onChange={(e) => setTituloArquivo(e.target.value)} placeholder="Ex.: Nossa suíte por dentro" className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Ordem de exibição
                  <input type="number" min="0" max="999" value={ordemArquivo} onChange={(e) => setOrdemArquivo(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">Descrição (opcional)
                  <textarea maxLength={300} rows={2} value={descricaoArquivo} onChange={(e) => setDescricaoArquivo(e.target.value)} placeholder="Uma breve descrição do vídeo" className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={enviandoArquivo || !bucketPronto || !arquivoVideo}>{enviandoArquivo ? "Enviando vídeo…" : !bucketPronto ? "Preparando envio…" : "Enviar e publicar vídeo"}</Button>
                </div>
              </form>
              <form onSubmit={adicionarVideo} className="mb-6 grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><h3 className="font-semibold text-primary">Ou adicionar por link</h3><p className="text-xs text-muted-foreground">Para vídeos que já estão publicados no YouTube, Instagram, TikTok, Facebook ou Vimeo.</p></div>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">Link do vídeo
                  <input type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Cole o link do YouTube, Instagram, TikTok, Facebook ou Vimeo" className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Título
                  <input required minLength={2} maxLength={120} value={videoTitulo} onChange={(e) => setVideoTitulo(e.target.value)} placeholder="Ex.: Conheça nossa suíte" className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium">Ordem de exibição
                  <input type="number" min="0" max="999" value={videoOrdem} onChange={(e) => setVideoOrdem(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">Descrição (opcional)
                  <textarea maxLength={300} rows={2} value={videoDescricao} onChange={(e) => setVideoDescricao(e.target.value)} placeholder="Uma breve descrição do vídeo" className="w-full rounded-md border bg-background px-3 py-2 font-normal" />
                </label>
                {videoUrl && getVideoEmbed(videoUrl) && (
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Prévia do player</p>
                    <div className="max-w-xl overflow-hidden rounded-xl border">
                      <VideoPlayer url={videoUrl} title={videoTitulo || "Prévia do vídeo"} />
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={salvandoVideo}>{salvandoVideo ? "Salvando…" : "Adicionar vídeo"}</Button>
                  {videoFeedback && <p role="status" className="text-sm text-muted-foreground">{videoFeedback}</p>}
                </div>
              </form>
              {videos.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum vídeo cadastrado ainda. Adicione o primeiro link acima.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {videos.map((video) => (
                    <article key={video.id} className="overflow-hidden rounded-xl border bg-background">
                      <VideoPlayer url={video.url} title={video.titulo} />
                      <div className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold">{video.titulo}</h3>
                          <Badge variant={video.ativo ? "default" : "secondary"}>{video.ativo ? "Publicado" : "Oculto"}</Badge>
                        </div>
                        {video.descricao && <p className="text-sm text-muted-foreground">{video.descricao}</p>}
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">{video.plataforma} · Ordem {video.ordem}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => alternarVideo(video.id, video.ativo)}>{video.ativo ? "Ocultar do site" : "Publicar no site"}</Button>
                          <Button type="button" size="sm" variant="destructive" onClick={() => excluirVideo(video.id, video.titulo)}>Excluir</Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
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
                      <div><p className="font-semibold">{r.nome}</p><p className="text-sm text-muted-foreground">{fmt(r.check_in)} · {detalhesHospedes(r).resumo}</p></div>
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
                    {fmt(r.check_in)} → {fmt(r.check_out)} · {detalhesHospedes(r).resumo}
                  </p>
                </div>
                <Badge variant={r.status === "confirmada" ? "default" : r.status === "cancelada" ? "destructive" : "secondary"}>
                  {r.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm">
                <a className="text-primary underline" href={`https://wa.me/${telefoneWhatsApp(r.telefone)}`} target="_blank" rel="noreferrer">{r.telefone}</a>
                {r.email ? <> · <a className="text-primary underline" href={`mailto:${r.email}`}>{r.email}</a></> : <> · <span className="text-destructive">E-mail não informado</span></>}
              </p>
              {detalhesHospedes(r).mensagem && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{detalhesHospedes(r).mensagem}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={confirmando === r.id || r.status === "confirmada"} onClick={() => confirmarReserva(r.id)}>
                  {confirmando === r.id ? "Confirmando…" : r.status === "confirmada" ? "Reserva confirmada" : "Confirmar reserva"}
                </Button>
                <a
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  href={`https://wa.me/${telefoneWhatsApp(r.telefone)}?text=${encodeURIComponent(`Olá, ${r.nome}! Sua reserva na SurfSuites está confirmada. Entrada: ${fmt(r.check_in)}. Saída: ${fmt(r.check_out)}. Hóspedes: ${detalhesHospedes(r).resumo}. Aguardamos você!`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enviar pelo WhatsApp
                </a>
                {r.email ? (
                  <a
                    className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                    href={`mailto:${r.email}?subject=${encodeURIComponent("Confirmação de reserva - SurfSuites")}&body=${encodeURIComponent(`Olá, ${r.nome}! Sua reserva na SurfSuites está confirmada. Entrada: ${fmt(r.check_in)}. Saída: ${fmt(r.check_out)}. Hóspedes: ${detalhesHospedes(r).resumo}. Aguardamos você! Equipe SurfSuites.`)}`}
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
