# SurfSuites

Site institucional e sistema de reservas online da Pousada do Surf, em Peruíbe-SP.

## Stack

- **Frontend e aplicação:** React + TanStack Start
- **Hospedagem e deploy:** Vercel
- **Autenticação e banco de dados:** Supabase
- **Build:** Vite + Nitro

## Desenvolvimento local

Requisitos: Node.js 20+ e Bun.

```bash
git clone https://github.com/juneraunderline/surfsuites.git
cd surfsuites
bun install
bun run dev
```

## Variáveis de ambiente

Configure as variáveis no painel da Vercel em **Settings → Environment Variables**:

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase, usada pelo navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase, usada pelo navegador |
| `SUPABASE_URL` | URL do Supabase no servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do Supabase no servidor |
| `CRON_SECRET` | Segredo opcional para proteger rotinas agendadas, se utilizadas |
| `CRON_SECRET_PREVIOUS` | Segredo anterior opcional durante rotação |

Nunca coloque chaves secretas ou a service role em variáveis com prefixo `VITE_`.

## Build

```bash
bun run build
```

A Vercel detecta o TanStack Start e usa Nitro para gerar as funções de servidor.
