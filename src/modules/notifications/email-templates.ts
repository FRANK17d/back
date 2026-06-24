const BRAND_COLOR = '#C8102E'
const BG_COLOR = '#F3F0EE'

function baseLayout(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">TOKE+</h1>
</td></tr>
<tr><td style="padding:32px;">
  ${content}
</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
  <p style="margin:0;font-size:12px;color:#888;text-align:center;">
    TOKE+ — Conectamos clientes con técnicos de confianza en Trujillo.
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

export function requestApprovedEmail(title: string) {
  return {
    subject: '¡Tu pedido fue aprobado! — TOKE+',
    html: baseLayout('Pedido aprobado', `
      <h2 style="margin:0 0 12px;font-size:18px;color:#141413;">¡Pedido aprobado!</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Tu pedido <strong>"${title}"</strong> ya está visible para los técnicos de tu zona.
        Pronto recibirás postulaciones.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">
        Abre la app para ver el estado de tu pedido.
      </p>
    `),
  }
}

export function requestRejectedEmail(title: string) {
  return {
    subject: 'Tu pedido no fue aprobado — TOKE+',
    html: baseLayout('Pedido no aprobado', `
      <h2 style="margin:0 0 12px;font-size:18px;color:#141413;">Pedido no aprobado</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Tu pedido <strong>"${title}"</strong> no fue aprobado.
        Revisa los detalles y vuelve a intentarlo.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">
        Si tienes dudas, contáctanos desde la sección de soporte en la app.
      </p>
    `),
  }
}

export function applicationAcceptedEmail(requestTitle: string) {
  return {
    subject: '¡Te eligieron! — TOKE+',
    html: baseLayout('Te eligieron', `
      <h2 style="margin:0 0 12px;font-size:18px;color:#141413;">¡Felicidades!</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        El cliente aceptó tu postulación para <strong>"${requestTitle}"</strong>.
        Coordina con el cliente por el chat de la app.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">
        Abre la app para ver los detalles del servicio.
      </p>
    `),
  }
}

export function technicianVerifiedEmail() {
  return {
    subject: '¡Cuenta verificada! — TOKE+',
    html: baseLayout('Cuenta verificada', `
      <h2 style="margin:0 0 12px;font-size:18px;color:#141413;">¡Tu identidad fue verificada!</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Ya puedes postular a pedidos de clientes en tu zona.
        Recuerda que cada postulación cuesta 1 crédito.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">
        Abre la app y revisa los pedidos disponibles.
      </p>
    `),
  }
}

export function verificationRejectedEmail() {
  return {
    subject: 'Verificación rechazada — TOKE+',
    html: baseLayout('Verificación rechazada', `
      <h2 style="margin:0 0 12px;font-size:18px;color:#141413;">Verificación rechazada</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">
        Tu verificación de identidad fue rechazada.
        Por favor, sube documentos claros y válidos desde la app.
      </p>
      <p style="margin:0;font-size:13px;color:#888;">
        Si crees que es un error, contacta soporte.
      </p>
    `),
  }
}
