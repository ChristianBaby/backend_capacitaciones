const CRIMSON = '#9B1C31';
const GOLD = '#D4A72C';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <tr><td style="background:${CRIMSON};padding:20px 24px;border-bottom:4px solid ${GOLD};">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">${escapeHtml(title)}</h1>
    </td></tr>
    <tr><td style="padding:24px;color:#333333;font-size:15px;line-height:1.5;">${bodyHtml}</td></tr>
    <tr><td style="padding:16px 24px;background:#fafafa;color:#888888;font-size:12px;">
      Si no solicitaste este correo, puedes ignorarlo.
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code: string): string {
  return `<p style="text-align:center;margin:24px 0;"><span style="display:inline-block;background:#fff8e1;border:2px solid ${GOLD};color:${CRIMSON};font-size:32px;letter-spacing:8px;font-weight:bold;padding:12px 24px;border-radius:6px;">${escapeHtml(code)}</span></p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function enrollmentTemplate(name: string, title: string, venue: string, startsAt: Date): RenderedEmail {
  const date = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima',
  }).format(startsAt);
  return {
    subject: `Inscripción confirmada: ${title}`,
    text: `Hola ${name}, tu inscripción a ${title} está confirmada. Inicio: ${date} (hora de Perú). Sede: ${venue}. Revisa Mis cursos en tu cuenta.`,
    html: layout('Inscripción confirmada',
      `<p>Hola <strong>${escapeHtml(name)}</strong>,</p><p>Tu inscripción a <strong>${escapeHtml(title)}</strong> está confirmada.</p><p>Inicio: ${escapeHtml(date)} (hora de Perú).<br>Sede: ${escapeHtml(venue)}</p><p>Revisa Mis cursos en tu cuenta.</p>`),
  };
}

export function verifyEmailTemplate(name: string, code: string, minutes: number): RenderedEmail {
  return {
    subject: 'Verifica tu correo',
    text: `Hola ${name}, tu código de verificación es ${code}. Expira en ${minutes} minutos.`,
    html: layout(
      'Verifica tu correo',
      `<p>Hola <strong>${escapeHtml(name)}</strong>,</p><p>Usa este código para verificar tu cuenta:</p>${codeBlock(code)}<p>El código expira en ${minutes} minutos.</p>`,
    ),
  };
}

export function instructorInviteTemplate(name: string, code: string, hours: number): RenderedEmail {
  return {
    subject: 'Invitación como instructor',
    text: `Hola ${name}, fuiste invitado como instructor. Tu código de acceso es ${code}. Expira en ${hours} horas.`,
    html: layout(
      'Invitación como instructor',
      `<p>Hola <strong>${escapeHtml(name)}</strong>,</p><p>Fuiste invitado a la plataforma como instructor. Ingresa con tu correo y este código para definir tu contraseña:</p>${codeBlock(code)}<p>El código expira en ${hours} horas y es de un solo uso.</p>`,
    ),
  };
}

export function passwordResetTemplate(name: string, code: string, minutes: number): RenderedEmail {
  return {
    subject: 'Recuperación de contraseña',
    text: `Hola ${name}, tu código para restablecer la contraseña es ${code}. Expira en ${minutes} minutos.`,
    html: layout(
      'Recuperación de contraseña',
      `<p>Hola <strong>${escapeHtml(name)}</strong>,</p><p>Usa este código para restablecer tu contraseña:</p>${codeBlock(code)}<p>El código expira en ${minutes} minutos.</p>`,
    ),
  };
}
