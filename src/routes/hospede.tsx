import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { Waves, MapPin, Compass, Utensils, ShoppingBag, HeartPulse, TreePine, Landmark, Sun, CloudRain, MessageCircle, LogOut, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/hospede")({
  head: () => ({ meta: [{ title: "Guia do Hóspede — Surf Suítes" }, { name: "description", content: "Seu guia de hospedagem, lazer e turismo em Peruíbe." }, { name: "robots", content: "noindex" }] }),
  component: GuiaHospede,
});

const atracoes = [
  { nome: "Praia do Centro", tipo: "Praia", descricao: "Orla urbanizada com calçadão, ciclovia, jardins e quiosques. É a opção prática para curtir o mar pertinho da pousada.", busca: "Praia do Centro Peruíbe SP", icone: Waves },
  { nome: "Praia do Costão", tipo: "Praia e natureza", descricao: "Costão rochoso, vegetação e uma bica natural de água doce. Um passeio bonito para conhecer a paisagem do litoral.", busca: "Praia do Costão Peruíbe SP", icone: Waves },
  { nome: "Guaraú e Rio Guaraú", tipo: "Natureza", descricao: "Região de praia, rio e manguezal, porta de entrada para passeios ecológicos e paisagens preservadas.", busca: "Praia do Guaraú Peruíbe SP", icone: TreePine },
  { nome: "Ruínas do Abarebebê", tipo: "História", descricao: "Sítio histórico ligado à ocupação portuguesa do século XVI e à história indígena da região. Consulte o funcionamento antes de ir.", busca: "Ruínas do Abarebebê Peruíbe", icone: Landmark },
  { nome: "Aquário Municipal", tipo: "Passeio em família", descricao: "Uma opção de passeio urbano para conhecer espécies marinhas. Confirme horários e funcionamento antes da visita.", busca: "Aquário Municipal de Peruíbe", icone: Waves },
  { nome: "Feiras de artesanato", tipo: "Compras e cultura", descricao: "Conheça o artesanato local e aproveite as praças e o comércio do Centro.", busca: "Feira de artesanato Praça Redonda Peruíbe", icone: ShoppingBag },
  { nome: "Colônia Veneza e Capela de Mosaicos", tipo: "Cultura", descricao: "Um passeio cultural para apreciar a capela decorada com mosaicos e conhecer outro lado da cidade.", busca: "Colônia Veneza Capela de Mosaicos Peruíbe", icone: Landmark },
  { nome: "Cachoeira do Paraíso", tipo: "Ecoturismo", descricao: "Atração natural na região da Jureia-Itatins. O acesso pode depender de regras ambientais, condições da trilha e autorização; informe-se antes de sair.", busca: "Cachoeira do Paraíso Peruíbe", icone: TreePine },
  { nome: "Corredeiras do Perequê", tipo: "Aventura", descricao: "Trecho de rio conhecido pelas águas e piscinas naturais. Verifique acesso, condições do tempo e orientações locais.", busca: "Corredeiras do Perequê Peruíbe", icone: TreePine },
  { nome: "Lama Negra de Peruíbe", tipo: "Bem-estar", descricao: "Uma das experiências tradicionais da cidade, associada ao turismo de saúde e bem-estar. Consulte o Complexo Termal para informações atualizadas.", busca: "Complexo Termal Lama Negra Peruíbe", icone: HeartPulse },
];

const dicas = [
  { titulo: "Dia de sol", texto: "Praia do Centro pela manhã, almoço na região central e fim de tarde no Costão ou no Guaraú." , icon: Sun },
  { titulo: "Dia nublado ou chuvoso", texto: "Aproveite o comércio do Centro, feiras de artesanato, Museu Histórico e outros passeios culturais — confirme horários antes.", icon: CloudRain },
  { titulo: "Com crianças", texto: "Prefira passeios urbanos e a orla, respeitando as condições do mar e a supervisão constante dos pequenos.", icon: HeartPulse },
];

function GuiaHospede() {
  const navigate = useNavigate();
  const { data: user, isLoading: carregandoUsuario } = useQuery({
    queryKey: ["guia-hospede-usuario"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });
  useEffect(() => {
    if (!carregandoUsuario && !user) navigate({ to: "/auth", search: { redirect: "/hospede" } as never, replace: true });
  }, [carregandoUsuario, user, navigate]);

  const { data: videos = [] } = useQuery({
    queryKey: ["guia-hospede-videos"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("videos_pousada").select("id,titulo,descricao,url,plataforma").eq("ativo", true).order("ordem", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (carregandoUsuario || !user) return <main className="grid min-h-screen place-items-center bg-muted"><p className="text-muted-foreground">Preparando seu guia…</p></main>;

  return (
    <main className="min-h-screen bg-background">
      <header className="bg-primary px-5 py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-secondary"><Waves className="h-4 w-4" /> Surf Suítes · Peruíbe</p><h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Seu guia de experiências</h1><p className="mt-2 max-w-2xl text-sm opacity-90">Olá! Reunimos dicas para você aproveitar a pousada e descobrir o melhor de Peruíbe.</p></div>
          <Button variant="outline" className="shrink-0 border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={sair}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-12 px-5 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border bg-card p-5"><Waves className="h-7 w-7 text-primary" /><h2 className="mt-3 text-lg font-bold">A poucos passos do mar</h2><p className="mt-1 text-sm text-muted-foreground">A Surf Suítes fica a cerca de 50 metros da praia do Centro de Peruíbe.</p></article>
          <article className="rounded-2xl border bg-card p-5"><FlameIcon /><h2 className="mt-3 text-lg font-bold">Curta a estrutura</h2><p className="mt-1 text-sm text-muted-foreground">Suítes duplex, churrasqueira e cozinha equipada para você aproveitar com família e amigos.</p></article>
          <article className="rounded-2xl border bg-card p-5"><MessageCircle className="h-7 w-7 text-primary" /><h2 className="mt-3 text-lg font-bold">Precisa de ajuda?</h2><p className="mt-1 text-sm text-muted-foreground">Fale diretamente com a equipe da pousada pelo WhatsApp.</p><a className="mt-3 inline-flex items-center gap-2 font-semibold text-primary underline" href="https://wa.me/5513997539696" target="_blank" rel="noreferrer">Chamar a pousada <ExternalLink className="h-4 w-4" /></a></article>
        </section>

        {videos.length > 0 && <section><div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-primary">Conheça por dentro</p><h2 className="mt-1 text-2xl font-extrabold">Entretenimento e espaços da pousada</h2><p className="mt-1 text-sm text-muted-foreground">Assista aos vídeos publicados pela Surf Suítes.</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{videos.map((v) => <article key={v.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm"><VideoPlayer url={v.url} title={v.titulo} /><div className="p-4"><h3 className="font-bold">{v.titulo}</h3>{v.descricao && <p className="mt-1 text-sm text-muted-foreground">{v.descricao}</p>}</div></article>)}</div></section>}

        <section><div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Explore a região</p><h2 className="mt-1 text-2xl font-extrabold">O que conhecer em Peruíbe</h2><p className="mt-1 text-sm text-muted-foreground">Ideias de passeios para diferentes estilos de viagem.</p></div><Compass className="hidden h-9 w-9 text-primary sm:block" /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{atracoes.map((a) => { const Icon = a.icone; return <article key={a.nome} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><Icon className="h-7 w-7 text-primary" /><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{a.tipo}</span></div><h3 className="mt-4 text-lg font-bold">{a.nome}</h3><p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{a.descricao}</p><a className="mt-4 inline-flex items-center gap-2 font-semibold text-primary underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.busca)}`} target="_blank" rel="noreferrer"><MapPin className="h-4 w-4" /> Ver no mapa <ExternalLink className="h-3 w-3" /></a></article>})}</div></section>

        <section><div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-primary">Escolha seu clima</p><h2 className="mt-1 text-2xl font-extrabold">Dicas para aproveitar cada dia</h2></div><div className="grid gap-4 md:grid-cols-3">{dicas.map((d) => { const Icon = d.icon; return <article key={d.titulo} className="rounded-2xl bg-muted p-5"><Icon className="h-7 w-7 text-primary" /><h3 className="mt-3 font-bold">{d.titulo}</h3><p className="mt-2 text-sm text-muted-foreground">{d.texto}</p></article>})}</div></section>

        <section className="rounded-2xl bg-primary p-6 text-primary-foreground md:p-8"><h2 className="text-2xl font-extrabold">Informações úteis</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="font-semibold">Centro de Atendimento ao Turista</p><p className="text-sm opacity-90">Avenida Padre Anchieta, 998 — Centro</p><p className="text-sm opacity-90">(13) 3455-9426</p></div><div><p className="font-semibold">Rodoviária de Peruíbe</p><p className="text-sm opacity-90">Avenida 24 de Dezembro, 650 — Estação</p><p className="text-sm opacity-90">(13) 3454-1917</p></div></div><a href="https://www.peruibe.sp.gov.br/turismo/" target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-primary">Guia oficial de turismo <ExternalLink className="h-4 w-4" /></a></section>
        <div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => navigate({ to: "/" })}>Voltar ao site</Button><Button onClick={() => window.open("https://wa.me/5513997539696", "_blank")}><MessageCircle className="mr-2 h-4 w-4" /> Falar com a pousada</Button></div>
      </div>
      <footer className="bg-black px-5 py-5 text-center text-xs text-white">© {new Date().getFullYear()} Surf Suítes. Todos os direitos reservados. · Feito por LPS Developer</footer>
    </main>
  );
}

function FlameIcon() { return <span className="text-2xl" aria-hidden="true">🔥</span>; }
