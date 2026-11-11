/**
 * Módulo de envio de emails do FinanSaaS via Resend.
 * Quando as variáveis RESEND_API_KEY e EMAIL_FROM não estiverem configuradas,
 * o envio é desativado de forma graciosa (loga o link no console e retorna controlado).
 */

export function isEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function extractLink(textOrHtml) {
  if (!textOrHtml) return null;
  const match = String(textOrHtml).match(/https?:\/\/[^\s"'<>]+/);
  return match ? match[0] : null;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailEnabled()) {
    const link = extractLink(text || html);
    console.log("[email] desativado — link:", link || "(sem link direto)", { to, subject });
    return { sent: false, reason: "email_disabled" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text,
        html,
      }),
    });

    if (response.ok) {
      return { sent: true };
    }

    const errorText = await response.text().catch(() => "");
    return { sent: false, reason: errorText || `HTTP ${response.status}` };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function passwordResetTemplate(resetUrl) {
  const subject = "FinanSaaS — Recuperação de senha";
  const text = `Olá!\n\nVocê solicitou a recuperação de senha no FinanSaaS.\n\nPara redefinir sua senha, acesse o link abaixo (válido por 60 minutos):\n${resetUrl}\n\nSe você não solicitou esta alteração, ignore este email.\n`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">FinanSaaS</h2>
      <p style="font-size: 15px; line-height: 1.5;">Olá,</p>
      <p style="font-size: 15px; line-height: 1.5;">Recebemos uma solicitação para redefinir a senha da sua conta no FinanSaaS.</p>
      <p style="font-size: 15px; line-height: 1.5;">Clique no botão abaixo para escolher uma nova senha (link válido por 60 minutos):</p>
      <div style="margin: 28px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: 500; font-size: 15px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir senha</a>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
      <p style="font-size: 13px; color: #2563eb; word-break: break-all; line-height: 1.4;">${resetUrl}</p>
      <hr style="margin: 28px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">Se você não solicitou esta recuperação, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.</p>
    </div>
  `;
  return { subject, text, html };
}

export function emailConfirmationTemplate(confirmUrl) {
  const subject = "FinanSaaS — Confirmação de novo email";
  const text = `Olá!\n\nVocê solicitou a alteração do email da sua conta no FinanSaaS.\n\nPara confirmar este novo endereço de email, acesse o link abaixo (válido por 24 horas):\n${confirmUrl}\n\nSe você não solicitou esta alteração, ignore este email.\n`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">FinanSaaS</h2>
      <p style="font-size: 15px; line-height: 1.5;">Olá,</p>
      <p style="font-size: 15px; line-height: 1.5;">Você solicitou a atualização do endereço de email associado à sua conta no FinanSaaS.</p>
      <p style="font-size: 15px; line-height: 1.5;">Clique no botão abaixo para confirmar este novo email (link válido por 24 horas):</p>
      <div style="margin: 28px 0;">
        <a href="${confirmUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; font-weight: 500; font-size: 15px; text-decoration: none; border-radius: 6px; display: inline-block;">Confirmar novo email</a>
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
      <p style="font-size: 13px; color: #2563eb; word-break: break-all; line-height: 1.4;">${confirmUrl}</p>
      <hr style="margin: 28px 0; border: none; border-top: 1px solid #e2e8f0;" />
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">Se você não solicitou esta alteração, nenhuma ação é necessária.</p>
    </div>
  `;
  return { subject, text, html };
}
