import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Surf Suítes" }, { name: "description", content: "Acesse seu guia de hóspede ou o painel da pousada." }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(/confirm/i.test(error.message) ? "Confirme seu e-mail pelo link que enviamos antes de entrar." : "E-mail ou senha incorretos.");
      } else if (data.user) {
        const { data: admin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        navigate({ to: admin ? "/admin" : "/hospede", replace: true });
      }
    } else {
      // Evita reaproveitar uma sessão administrativa que já estava aberta neste navegador.
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/hospede` },
      });
      if (error) {
        setMsg(`Falha ao criar conta (${error.status ?? "sem status"}): ${error.message}`);
      } else if (data.session) {
        navigate({ to: "/hospede", replace: true });
      } else {
        setMsg("Cadastro iniciado! Confirme seu e-mail pelo link enviado. Depois, entre com sua conta para acessar o Guia do Hóspede. Confira também o spam.");
      }
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-8 shadow-lg">
        <Button type="button" variant="outline" className="w-full" onClick={() => navigate({ to: "/" })}>Voltar ao site</Button>
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Surf Suítes · Peruíbe</p><h1 className="mt-2 text-2xl font-extrabold text-primary">{mode === "login" ? "Acesse sua área" : "Crie sua conta de hóspede"}</h1><p className="mt-1 text-sm text-muted-foreground">{mode === "login" ? "Entre para abrir seu guia de experiências ou o painel administrativo." : "Tenha dicas da pousada, passeios e informações úteis de Peruíbe."}</p></div>
        <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar minha conta"}</Button>
        <button type="button" className="w-full text-sm text-primary underline" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }}>{mode === "login" ? "Sou novo por aqui — criar conta" : "Já tenho conta — entrar"}</button>
      </form>
    </main>
  );
}
