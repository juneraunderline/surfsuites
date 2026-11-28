import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/guia-admin")({
  head: () => ({ meta: [{ title: "Editar Guia do Hóspede — Surf Suítes" }, { name: "robots", content: "noindex" }] }),
  component: GuiaAdmin,
});

type Item = { id: string; titulo: string; categoria: string; descricao: string; busca_mapa: string; ativo: boolean; ordem: number };

function GuiaAdmin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("Passeio");
  const [descricao, setDescricao] = useState("");
  const [mapa, setMapa] = useState("");
  const [ordem, setOrdem] = useState("0");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { data: admin } = useQuery({ queryKey: ["guia-admin-check"], queryFn: async () => { const { data: u } = await supabase.auth.getUser(); if (!u.user) return false; const { data, error } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }); if (error) throw error; return !!data; } });
  const { data: items = [], isLoading } = useQuery({ queryKey: ["guia-admin-items"], enabled: admin === true, queryFn: async () => { const { data, error } = await supabase.from("guia_hospede").select("*").order("ordem").order("titulo"); if (error) throw error; return data as Item[]; } });

  function limpar() { setEditId(null); setTitulo(""); setCategoria("Passeio"); setDescricao(""); setMapa(""); setOrdem("0"); setErro(""); }
  function editar(item: Item) { setEditId(item.id); setTitulo(item.titulo); setCategoria(item.categoria); setDescricao(item.descricao); setMapa(item.busca_mapa); setOrdem(String(item.ordem)); setErro(""); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSalvando(true); setErro("");
    const payload = { titulo: titulo.trim(), categoria: categoria.trim(), descricao: descricao.trim(), busca_mapa: mapa.trim(), ordem: Number(ordem) || 0, updated_at: new Date().toISOString() };
    const result = editId ? await supabase.from("guia_hospede").update(payload).eq("id", editId) : await supabase.from("guia_hospede").insert({ ...payload, ativo: true });
    setSalvando(false);
    if (result.error) { setErro("Não foi possível salvar: " + result.error.message); return; }
    limpar(); await qc.invalidateQueries({ queryKey: ["guia-admin-items"] });
  }

  async function alternar(item: Item) { const { error } = await supabase.from("guia_hospede").update({ ativo: !item.ativo, updated_at: new Date().toISOString() }).eq("id", item.id); if (error) setErro(error.message); else await qc.invalidateQueries({ queryKey: ["guia-admin-items"] }); }
  async function excluir(item: Item) { if (!window.confirm(`Excluir "${item.titulo}" do guia?`)) return; const { error } = await supabase.from("guia_hospede").delete().eq("id", item.id); if (error) setErro(error.message); else await qc.invalidateQueries({ queryKey: ["guia-admin-items"] }); }

  if (admin === false) return <main className="p-8">Esta conta não tem acesso administrativo.</main>;
  return <main className="min-h-screen bg-muted px-4 py-8"><div className="mx-auto max-w-4xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Surf Suítes</p><h1 className="text-3xl font-extrabold text-primary">Editar Guia do Hóspede</h1><p className="mt-1 text-sm text-muted-foreground">Cadastre passeios, restaurantes, serviços e dicas de Peruíbe.</p></div><Button variant="outline" onClick={() => navigate({ to: "/admin" })}>Voltar ao painel</Button></div>
    <form onSubmit={salvar} className="mb-8 grid gap-4 rounded-2xl bg-card p-6 shadow-sm md:grid-cols-2">
      <h2 className="text-xl font-bold md:col-span-2">{editId ? "Editar informação" : "Adicionar informação ao guia"}</h2>
      <div className="space-y-2"><Label htmlFor="gtitulo">Título</Label><Input id="gtitulo" value={titulo} onChange={e => setTitulo(e.target.value)} required maxLength={120} /></div>
      <div className="space-y-2"><Label htmlFor="gcategoria">Categoria</Label><Input id="gcategoria" value={categoria} onChange={e => setCategoria(e.target.value)} required maxLength={60} placeholder="Praia, Restaurante, Serviço…" /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="gdescricao">Descrição</Label><Textarea id="gdescricao" value={descricao} onChange={e => setDescricao(e.target.value)} required maxLength={1200} rows={3} /></div>
      <div className="space-y-2"><Label htmlFor="gmapa">Busca para abrir no Google Maps</Label><Input id="gmapa" value={mapa} onChange={e => setMapa(e.target.value)} required maxLength={200} placeholder="Nome do local + Peruíbe SP" /></div>
      <div className="space-y-2"><Label htmlFor="gordem">Ordem de exibição</Label><Input id="gordem" type="number" value={ordem} onChange={e => setOrdem(e.target.value)} /></div>
      {erro && <p role="alert" className="text-sm text-destructive md:col-span-2">{erro}</p>}
      <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={salvando}>{salvando ? "Salvando…" : editId ? "Salvar alterações" : "Adicionar ao guia"}</Button>{editId && <Button type="button" variant="outline" onClick={limpar}>Cancelar edição</Button>}</div>
    </form>
    <section className="space-y-3"><h2 className="text-xl font-bold">Conteúdo cadastrado ({items.length})</h2>{isLoading && <p>Carregando…</p>}{items.map(item => <article key={item.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.titulo}</h3><span className="rounded-full bg-muted px-2 py-1 text-xs">{item.categoria}</span><span className="text-xs text-muted-foreground">{item.ativo ? "Publicado" : "Oculto"}</span></div><p className="mt-1 text-sm text-muted-foreground">{item.descricao}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => editar(item)}>Editar</Button><Button size="sm" variant="outline" onClick={() => alternar(item)}>{item.ativo ? "Ocultar" : "Publicar"}</Button><Button size="sm" variant="destructive" onClick={() => excluir(item)}>Excluir</Button></div></article>)}</section>
  </div></main>;
}
