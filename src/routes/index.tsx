import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Waves, MapPin, Phone, Users, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import hero from "@/assets/hero.jpg";
import surfSuitesLogo from "@/assets/surf-suites-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pousada do Surf — 50 m da praia em Peruíbe-SP" },
      { name: "description", content: "Suítes duplex para até 5 pessoas a 50 metros da praia do centro de Peruíbe. Reserve online." },
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

  async function reservar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const check_in = String(f.get("check_in"));
    const check_out = String(f.get("check_out"));
    if (check_out <= check_in) return setErro("A saída precisa ser depois da entrada.");

    const email = String(f.get("email") || "").trim();
    if (!email) return setErro("Informe seu e-mail para receber a confirmação da reserva.");

    setLoading(true);
    setErro(null);
    const mensagem = String(f.get("mensagem") || "").trim();
    const { error } = await supabase.from("reservas").insert({
      nome: String(f.get("nome")).trim(),
      telefone: String(f.get("telefone")).trim(),
      email,
      mensagem: mensagem || null,
      check_in,
      check_out,
      hospedes: Number(f.get("hospedes")),
    });
    setLoading(false);
    if (error) setErro("Não foi possível enviar. Confira os dados e tente novamente.");
    else setEnviado(true);
  }

  return (
    <main>
      <section className="relative h-[540px] overflow-hidden md:h-auto">
        <img src={hero} alt="Fachada da Pousada Surf Suítes em Peruíbe" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover md:static md:h-auto md:object-contain" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-5xl px-5 text-primary-foreground">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-secondary md:mb-3 md:text-sm"><Waves className="h-4 w-4" /> Peruíbe · SP</p>
            <img src={surfSuitesLogo} alt="Surf Suites" className="-my-3 w-full max-w-[300px] object-contain object-left md:-my-5 md:max-w-[390px]" />
            <p className="mt-2 max-w-md text-sm md:mt-4 md:text-lg">A 50 metros da praia do centro. Suítes duplex para até 5 pessoas.</p>
            <Button asChild size="lg" className="mt-4 bg-accent text-accent-foreground hover:bg-accent/90 md:mt-8">
              <a href="#reserva">Reservar agora</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-5 py-16 md:grid-cols-3">
        {[
          { icon: Waves, t: "50 m da praia", d: "Acorde e caia no mar em um minuto." },
          { icon: Users, t: "Suítes duplex", d: "Espaço para até 5 pessoas." },
          { icon: Star, t: "100% recomendam", d: "100% de avaliações positivas." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl bg-card p-6 shadow-sm">
            <Icon className="h-7 w-7 text-primary" />
            <h3 className="mt-3 text-xl font-bold">{t}</h3>
            <p className="mt-1 text-muted-foreground">{d}</p>
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
              <div className="space-y-2"><Label htmlFor="hospedes">Hóspedes</Label>
                <select id="hospedes" name="hospedes" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
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
    </main>
  );
}
