import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

type Reservation = {
  id: string;
  nome: string;
  email: string | null;
  check_in: string;
  check_out: string;
  hospedes: number;
  status: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export const confirmarReservaEEnviarEmail = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => {
    if (!data || typeof data.id !== "string" || !/^[0-9a-f-]{36}$/i.test(data.id)) {
      throw new Error("Reserva inválida.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const authorization = getRequestHeader("authorization") ?? "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;

    if (!token) throw new Error("Faça login novamente para continuar.");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("A configuração do Supabase no servidor está incompleta.");
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await client.auth.getUser(token);
    if (authError || !authData.user) {
      throw new Error("Sua sessão expirou. Entre novamente no painel.");
    }

    const { data: isAdmin, error: roleError } = await client.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });
    if (roleError || !isAdmin) {
      throw new Error("Somente administradores podem confirmar reservas.");
    }

    const { data: reservationData, error: reservationError } = await client
      .from("reservas")
      .select("id,nome,email,check_in,check_out,hospedes,status")
      .eq("id", data.id)
      .single();

    if (reservationError || !reservationData) {
      throw new Error("Não foi possível localizar esta reserva.");
    }

    const reservation = reservationData as Reservation;
    if (!reservation.email?.trim()) {
      throw new Error("Esta reserva não possui e-mail. Peça ao cliente para informar um endereço válido.");
    }

    if (reservation.status !== "confirmada") {
      const { error: updateError } = await client
        .from("reservas")
        .update({ status: "confirmada" })
        .eq("id", reservation.id);
      if (updateError) throw new Error("Não foi possível confirmar a reserva.");
    }

    if (!resendApiKey || !resendFromEmail) {
      console.error("[Resend] Configure RESEND_API_KEY e RESEND_FROM_EMAIL no ambiente de produção.");
      return {
        success: false,
        confirmed: true,
        message: "Reserva confirmada, mas o e-mail não foi enviado: falta configurar o remetente ou a chave do Resend.",
      };
    }

    const name = escapeHtml(reservation.nome);
    const checkIn = formatDate(reservation.check_in);
    const checkOut = formatDate(reservation.check_out);
    const html = `
      <div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:600px;margin:auto">
        <h1 style="color:#0b526b">Sua reserva foi confirmada!</h1>
        <p>Olá, ${name}!</p>
        <p>Temos uma ótima notícia: sua reserva na <strong>SurfSuites</strong> foi confirmada com sucesso.</p>
        <p><strong>Entrada:</strong> ${checkIn}<br />
        <strong>Saída:</strong> ${checkOut}<br />
        <strong>Hóspedes:</strong> ${reservation.hospedes}</p>
        <p>Nossa equipe entrará em contato para conversar sobre os próximos detalhes da sua hospedagem.</p>
        <p>Agradecemos por escolher a SurfSuites. Será um prazer receber você!</p>
        <p>Atenciosamente,<br /><strong>Equipe SurfSuites</strong></p>
      </div>`;
    const text = `Olá, ${reservation.nome}! Sua reserva na SurfSuites foi confirmada com sucesso. Entrada: ${checkIn}. Saída: ${checkOut}. Hóspedes: ${reservation.hospedes}. Nossa equipe entrará em contato para conversar sobre os próximos detalhes da sua hospedagem. Agradecemos por escolher a SurfSuites. Atenciosamente, Equipe SurfSuites.`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `surfsuites-reserva-confirmada/${reservation.id}`,
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [reservation.email.trim()],
          subject: "Sua reserva foi confirmada – SurfSuites",
          html,
          text,
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        console.error("[Resend] Falha ao enviar confirmação:", response.status, details);
        return {
          success: false,
          confirmed: true,
          message: "Reserva confirmada, mas o Resend não conseguiu enviar o e-mail. Confira a configuração e tente reenviar.",
        };
      }

      return {
        success: true,
        confirmed: true,
        message: `Reserva confirmada e e-mail enviado para ${reservation.email.trim()}.`,
      };
    } catch (error) {
      console.error("[Resend] Erro de conexão ao enviar confirmação:", error);
      return {
        success: false,
        confirmed: true,
        message: "Reserva confirmada, mas houve uma falha de conexão ao enviar o e-mail. Tente reenviar.",
      };
    }
  });
