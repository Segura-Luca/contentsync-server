import { MailService } from './mail.service';

describe('MailService', () => {
  const mail = { to: 'cliente@example.test', subject: 'Asunto', text: 'Texto', html: '<p>Texto</p>', meta: { purpose: 'CLIENT_CONFIRMATION' } };
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  function serviceWith(values: Record<string, string>) {
    const get = (key: string) => values[key];
    return new MailService({ get, getRaw: get, isProduction: true, mailSenderAddress: 'envios@example.test' } as any);
  }

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as any;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('las invitaciones salen por n8n con el asunto y el contenido completos', async () => {
    const sent = await serviceWith({ N8N_WEBHOOK_URL: 'https://n8n.test/hook' }).send('general', mail);

    expect(sent).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://n8n.test/hook');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ to: mail.to, subject: 'Asunto', html: '<p>Texto</p>', purpose: 'CLIENT_CONFIRMATION' });
  });

  it('si n8n falla, prueba el relay', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const sent = await serviceWith({ N8N_WEBHOOK_URL: 'https://n8n.test/hook', GMAIL_HTTPS_WEBHOOK_URL: 'https://relay.test/send' }).send('general', mail);

    expect(sent).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['https://n8n.test/hook', 'https://relay.test/send']);
  });

  it('envía el secreto del webhook en una cabecera', async () => {
    await serviceWith({ N8N_WEBHOOK_URL: 'https://n8n.test/hook', N8N_WEBHOOK_SECRET: 'clave' }).send('otp', mail);

    expect(fetchMock.mock.calls[0][1].headers['X-Webhook-Secret']).toBe('clave');
  });

  it('respeta el orden configurado', async () => {
    await serviceWith({ MAIL_TRANSPORTS_GENERAL: 'https', N8N_WEBHOOK_URL: 'https://n8n.test/hook', GMAIL_HTTPS_WEBHOOK_URL: 'https://relay.test/send' }).send('general', mail);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://relay.test/send');
  });

  it('informa cuando ningún transporte pudo enviar el correo', async () => {
    await expect(serviceWith({}).send('general', mail)).resolves.toBe(false);
  });
});
