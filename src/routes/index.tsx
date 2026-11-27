import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Waves, MapPin, Phone, Users, Flame, Utensils, Mountain, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import surfSuitesLogo from "@/assets/surf-suites-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pousada do Surf — 50 m da praia em Peruíbe-SP" },
      { name: "description", content: "Suítes duplex para até 8 pessoas, com churrasqueira, cozinha equipada e vista para o mar e a montanha, a 50 metros da praia do centro de Peruíbe." },
      { property: "og:title", content: "Pousada do Surf — Peruíbe-SP" },
      { property: "og:description", content: "Suítes duplex a 50 m da praia. Reserve online." },
    ],
  }),
  component: Index,
});

const hoje = () => new Date().toISOString().slice(0, 10);

function Index() {
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adultos, setAdultos] = useState(1);
  const [criancas, setCriancas] = useState(0);

  async function reservar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const check_in = String(f.get("check_in"));
    const check_out = String(f.get("check_out"));
    if (check_out <= check_in) return setErro("A saída precisa ser depois da entrada.");

    const email = String(f.get("email") || "").trim();
    if (!email) return setErro("Informe seu e-mail para receber a confirmação da reserva.");

    const hospedes = Number(f.get("hospedes"));
    const quantidadeCriancas = Number(f.get("criancas") || 0);
    if (hospedes + quantidadeCriancas > 8) return setErro("A hospedagem permite no máximo 8 pessoas no total, incluindo adultos e crianças.");
    const idadesCriancas = Array.from({ length: quantidadeCriancas }, (_, index) =>
      String(f.get(`idade_crianca_${index + 1}`) || "").trim()
    );
    if (idadesCriancas.some((idade) => idade === "" || Number(idade) < 0 || Number(idade) > 17)) {
      return setErro("Informe a idade de cada criança.");
    }

    setLoading(true);
    setErro(null);
    const mensagemLivre = String(f.get("mensagem") || "").trim();
    const detalhesCriancas = quantidadeCriancas > 0
      ? `Crianças: ${quantidadeCriancas} (idades: ${idadesCriancas.map((idade) => `${idade} anos`).join(", ")}).`
      : "Crianças: não.";
    const mensagem = [mensagemLivre, detalhesCriancas].filter(Boolean).join("\n\n");
    const { error } = await supabase.from("reservas").insert({
      nome: String(f.get("nome")).trim(),
      telefone: String(f.get("telefone")).trim(),
      email,
      mensagem: mensagem || null,
      check_in,
      check_out,
      hospedes,
    });
    setLoading(false);
    if (error) setErro("Não foi possível enviar. Confira os dados e tente novamente.");
    else setEnviado(true);
  }

  return (
    <main>
      <section className="relative h-[240px] overflow-hidden md:h-[280px] lg:h-[320px]">
        <img src="https://lh3.googleusercontent.com/gps-cs-s/ANWiy9RcahhdV5oYmQt5xauyTz2-g8HPS2BGsggxm1axemV2QFkUf84jgJk5OoEB7jWPFVaDsXvTopZWDl5GX78OlhkTiLInwgXKNR0XLtPXDz3qeyc7jogHubTLYR4yrks1m87awf1U=s680-w680-h510-rw" alt="Fachada da Pousada Surf Suítes em Peruíbe" width={680} height={510} className="absolute inset-0 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-black/45 md:bg-black/70" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-5xl px-5 text-primary-foreground">
            <p className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-secondary md:mb-3 md:text-sm"><Waves className="h-4 w-4" /> Peruíbe · SP</p>
            <img src={surfSuitesLogo} alt="Surf Suites" className="mb-3 w-full max-w-[280px] object-contain object-left md:mb-2 md:max-w-[310px]" />
            <p className="mt-0 max-w-md text-sm md:mt-2 md:text-base">A 50 metros da praia do centro. Suítes duplex para até 8 pessoas.</p>
            <Button asChild size="lg" className="mx-auto mt-5 flex w-fit bg-accent text-accent-foreground hover:bg-accent/90 md:mx-0 md:mt-4">
              <a href="#reserva">Reservar agora</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-2 lg:grid-cols-3 md:py-16">
        {[
          { icon: Waves, t: "50 metros da praia", d: "Aproveite a praia do centro de Peruíbe a poucos passos da pousada." },
          { icon: Users, t: "Suítes duplex para até 8 pessoas", d: "Mais espaço e conforto para curtir a estadia com a família e os amigos." },
          { icon: Flame, t: "Churrasqueira", d: "Suítes com churrasqueira para aproveitar bons momentos durante a hospedagem." },
          { icon: Utensils, t: "Cozinha equipada", d: "Estrutura para preparar suas refeições, equipada para atender até 7 pessoas." },
          { icon: Mountain, t: "Vista para o mar e a montanha", d: "Um cenário especial para aproveitar sua estadia em Peruíbe." },
          { icon: MessageCircle, t: "Valores a combinar", d: "Consulte os valores e condições diretamente pelo nosso WhatsApp." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl bg-card p-6 shadow-sm">
            <Icon className="h-7 w-7 text-primary" />
            <h3 className="mt-3 text-xl font-bold">{t}</h3>
            <p className="mt-1 text-muted-foreground">{d}</p>
            {t === "Valores a combinar" && (
              <a href="https://wa.me/5513997539696" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-[#1DA851] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"><MessageCircle className="h-5 w-5" /> Consultar pelo WhatsApp</a>
            )}
          </div>
        ))}
      </section>

      <section id="reserva" className="bg-primary px-5 py-16 text-primary-foreground">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-4xl font-extrabold">Faça sua reserva</h2>
          <p className="mt-2 opacity-90">Envie seu pedido e a nossa equipe entrará em contato.</p>
          {enviado ? (
            <div className="mt-8 rounded-2xl bg-card p-8 text-card-foreground">
              <h3 className="text-2xl font-bold">Pedido recebido! 🏄</h3>
              <p className="mt-2 text-muted-foreground">Entraremos em contato para confirmar sua reserva.</p>
            </div>
          ) : (
            <form onSubmit={reservar} className="mt-8 grid gap-4 rounded-2xl bg-card p-6 text-card-foreground md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label htmlFor="nome">Nome</Label><Input id="nome" name="nome" required minLength={2} maxLength={100} /></div>
              <div className="space-y-2"><Label htmlFor="telefone">WhatsApp</Label><Input id="telefone" name="telefone" type="tel" required minLength={8} maxLength={30} placeholder="(11) 99999-9999" /></div>
              <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" name="email" type="email" required maxLength={255} autoComplete="email" /></div>
              <div className="space-y-2"><Label htmlFor="check_in">Entrada</Label><Input id="check_in" name="check_in" type="date" min={hoje()} required /></div>
              <div className="space-y-2"><Label htmlFor="check_out">Saída</Label><Input id="check_out" name="check_out" type="date" min={hoje()} required /></div>
              <div className="space-y-2"><Label htmlFor="hospedes">Hóspedes adultos</Label>
                <select id="hospedes" name="hospedes" value={adultos} onChange={(e) => setAdultos(Number(e.target.value))} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "pessoa" : "pessoas"}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="criancas">Há crianças na hospedagem?</Label>
                <select id="criancas" name="criancas" value={criancas} onChange={(e) => setCriancas(Number(e.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Array.from({ length: 9 }, (_, i) => i).map((n) => <option key={n} value={n}>{n === 0 ? "Não" : n === 1 ? "Sim, 1 criança" : `Sim, ${n} crianças`}</option>)}
                </select>
              </div>
              {adultos + criancas > 8 && (
                <p role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-amber-800 md:col-span-2">
                  Atenção: limite máximo de 8 hóspedes atingido. A contagem inclui adultos e crianças.
                </p>
              )}
              {criancas > 0 && (
                <div className="grid gap-4 rounded-lg border p-4 md:col-span-2 sm:grid-cols-2">
                  <p className="font-semibold sm:col-span-2">Idade de cada criança</p>
                  {Array.from({ length: criancas }, (_, i) => i + 1).map((n) => (
                    <div key={n} className="space-y-2">
                      <Label htmlFor={`idade_crianca_${n}`}>Idade da criança {n}</Label>
                      <Input id={`idade_crianca_${n}`} name={`idade_crianca_${n}`} type="number" min="0" max="17" required placeholder="Idade em anos" />
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 md:col-span-2"><Label htmlFor="mensagem">Mensagem (opcional)</Label><Textarea id="mensagem" name="mensagem" maxLength={1000} /></div>
              {erro && <p className="text-sm text-destructive md:col-span-2">{erro}</p>}
              <Button type="submit" size="lg" disabled={loading} className="md:col-span-2 bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Enviando…" : "Enviar pedido de reserva"}
              </Button>
            </form>
          )}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl space-y-3 px-5 py-10 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center gap-2 text-center"><MapPin className="h-4 w-4 shrink-0" /> Rua Erasmo Pinheiro Ribas, 11 — Peruíbe, SP</p>
        <p className="flex items-center justify-center gap-2 text-center"><Phone className="h-4 w-4 shrink-0" /> <a className="underline" href="https://wa.me/5513997539696">+55 13 99753-9696</a></p>
        <p className="text-center"><Link to="/admin" className="underline">Área da pousada</Link></p>
      </footer>
      <div className="bg-black px-5 py-5 text-center text-xs text-white">
        <p>© {new Date().getFullYear()} Surf Suítes. Todos os direitos reservados.</p>
        <p className="mt-2">Feito por: <a href="https://www.instagram.com/lpsdeveloper?lqvp=bThvbnI4YndqZjB1" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">LPS Developer</a></p>
      </div>
    </main>
  );
}
