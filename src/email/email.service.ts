import { Injectable, Logger } from '@nestjs/common';
import { RenderedEmail } from './email.templates';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Envia un correo transaccional via Brevo. Sin BREVO_API_KEY (dev local) lo imprime
   * en consola; en produccion nunca se registra el contenido (contiene codigos).
   */
  async send(to: string, name: string, email: RenderedEmail): Promise<boolean> {
    const apiKey = process.env.BREVO_API_KEY;
    const isProd = process.env.NODE_ENV === 'production';

    if (!apiKey) {
      if (isProd) {
        this.logger.warn(`BREVO_API_KEY no configurada; correo "${email.subject}" no enviado.`);
      } else {
        this.logger.log(`[DEV EMAIL] to=${to} subject="${email.subject}"\n${email.text}`);
      }
      return false;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM_EMAIL, name: process.env.MAIL_FROM_NAME || 'Capacitaciones' },
        to: [{ email: to, name }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
    });

    if (!res.ok) {
      throw new Error(`Brevo respondio ${res.status}`);
    }
    return true;
  }
}
