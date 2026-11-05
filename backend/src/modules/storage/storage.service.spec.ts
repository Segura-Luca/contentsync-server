import { PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

const S3_CONFIG: Record<string, string> = {
  S3_ENDPOINT: 'https://example.test/s3',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  S3_BUCKET: 'videos',
};

function serviceWith(values: Record<string, string>) {
  return new StorageService({ get: (key: string) => values[key] } as any);
}

describe('StorageService.uploadObject', () => {
  const localPath = join(os.tmpdir(), `storage-spec-${process.pid}.mp4`);
  const params = { clientId: 'client-1', localPath, extension: '.mp4', mimeType: 'video/mp4', sizeBytes: 4 };

  beforeAll(() => fs.writeFileSync(localPath, 'data'));
  afterAll(() => fs.rmSync(localPath, { force: true }));

  function withSend(service: StorageService, send: jest.Mock) {
    (service as any).s3Client = { send };
    return service;
  }

  it('solo usa S3 con las tres credenciales', () => {
    expect(serviceWith(S3_CONFIG).usesS3).toBe(true);
    expect(serviceWith({ S3_ENDPOINT: 'https://example.test/s3' }).usesS3).toBe(false);
  });

  it('guarda el archivo en la carpeta del cliente con una clave válida', async () => {
    const send = jest.fn().mockResolvedValue({});
    const service = withSend(serviceWith(S3_CONFIG), send);

    const key = await service.uploadObject(params);

    expect(service.isValidStorageKey(key, 'client-1')).toBe(true);
    expect(service.isValidStorageKey(key, 'client-2')).toBe(false);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'videos', Key: key, ContentType: 'video/mp4', ContentLength: 4 });
  });

  it('informa cuando el archivo supera el límite del almacenamiento', async () => {
    const send = jest.fn().mockRejectedValue(Object.assign(new Error('too big'), { name: 'EntityTooLarge' }));
    await expect(withSend(serviceWith(S3_CONFIG), send).uploadObject(params)).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('reintenta un fallo pasajero con un flujo nuevo', async () => {
    const gateway = Object.assign(new Error('xml'), { $metadata: { httpStatusCode: 524 } });
    const send = jest.fn().mockRejectedValueOnce(gateway).mockResolvedValueOnce({});

    await expect(withSend(serviceWith(S3_CONFIG), send).uploadObject(params)).resolves.toContain('clients/client-1/');

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].input.Key).toBe(send.mock.calls[1][0].input.Key);
    expect(send.mock.calls[0][0].input.Body).not.toBe(send.mock.calls[1][0].input.Body);
  });

  it('no reintenta un rechazo definitivo', async () => {
    const denied = Object.assign(new Error('denied'), { $metadata: { httpStatusCode: 403 } });
    const send = jest.fn().mockRejectedValue(denied);

    await expect(withSend(serviceWith(S3_CONFIG), send).uploadObject(params)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras varios intentos sin exponer el error interno', async () => {
    const send = jest.fn().mockRejectedValue(new Error('detalle interno'));

    const failure = withSend(serviceWith(S3_CONFIG), send).uploadObject(params);

    await expect(failure).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(failure).rejects.not.toThrow(/detalle interno/);
    expect(send).toHaveBeenCalledTimes(3);
  });
});
