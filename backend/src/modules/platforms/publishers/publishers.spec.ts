import { InstagramReelsPublisher } from './instagram-reels.publisher';
import { NonRetryablePublishError } from './platform-publisher.interface';
import { TikTokVideoPublisher } from './tiktok-video.publisher';
import { YouTubeShortsPublisher } from './youtube-shorts.publisher';

const config: any = {
  mockPlatforms: false,
  metaGraphVersion: 'v20.0',
  instagramAppId: 'app',
  instagramAppSecret: 'secret',
  youtubeClientId: 'yt',
  uploadDir: '/no-existe',
  get: (key: string) => ({ TIKTOK_CLIENT_KEY: 'k', TIKTOK_CLIENT_SECRET: 's', YOUTUBE_CLIENT_SECRET: 'y' })[key],
};
const payload: any = {
  videoId: 'v',
  title: 'Título',
  description: 'Desc',
  hashtags: ['cafe'],
  publicVideoUrl: 'https://app.test/uploads/videos/a.mp4',
  privacyLevel: 'PUBLIC',
  shareToFeed: true,
  allowComments: true,
  allowDuetStitch: true,
  madeForKids: false,
  accessToken: 'token-real',
  externalAccountId: 'acc',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Adaptadores de publicación', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as any);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('renovación de tokens', () => {
    it('Instagram canjea el token real y no inventa uno', async () => {
      fetchMock.mockResolvedValueOnce(json({ access_token: 'nuevo-largo', expires_in: 100 }));
      const result = await new InstagramReelsPublisher(config).refreshAccessToken('largo');
      expect(result.accessToken).toBe('nuevo-largo');
      expect(String(fetchMock.mock.calls[0][0])).toContain('fb_exchange_token=largo');
    });

    it('TikTok usa su endpoint y conserva el refresh token devuelto', async () => {
      fetchMock.mockResolvedValueOnce(json({ access_token: 'a2', refresh_token: 'r2', expires_in: 60 }));
      const result = await new TikTokVideoPublisher(config).refreshAccessToken('r1');
      expect(result).toEqual({ accessToken: 'a2', refreshToken: 'r2', expiresInSeconds: 60 });
    });

    it.each([
      ['YouTube', () => new YouTubeShortsPublisher(config)],
      ['Instagram', () => new InstagramReelsPublisher(config)],
      ['TikTok', () => new TikTokVideoPublisher(config)],
    ])('%s falla de forma definitiva si el proveedor rechaza la renovación', async (_name, build) => {
      fetchMock.mockResolvedValueOnce(json({ error: 'invalid_grant' }, 400));
      await expect(build().refreshAccessToken('revocado')).rejects.toThrow(NonRetryablePublishError);
    });
  });

  describe('TikTok', () => {
    it('solo informa publicado cuando TikTok confirma PUBLISH_COMPLETE', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ data: { publish_id: 'pid' } }))
        .mockResolvedValueOnce(json({ data: { status: 'PROCESSING_DOWNLOAD' } }))
        .mockResolvedValueOnce(json({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [777] } }));
      const result = await new TikTokVideoPublisher(config).publishVideo(payload);
      expect(result.externalPostId).toBe('777');
      expect(result.externalPostUrl).toContain('/video/777');
    });

    it('propaga el fallo de procesamiento', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ data: { publish_id: 'pid' } }))
        .mockResolvedValueOnce(json({ data: { status: 'FAILED', fail_reason: 'url_not_verified' } }));
      await expect(new TikTokVideoPublisher(config).publishVideo(payload)).rejects.toThrow('url_not_verified');
    });
  });

  describe('Instagram', () => {
    it('devuelve el permalink real del Reel', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ id: 'container' }))
        .mockResolvedValueOnce(json({ status_code: 'FINISHED' }))
        .mockResolvedValueOnce(json({ id: 'media' }))
        .mockResolvedValueOnce(json({ permalink: 'https://www.instagram.com/reel/ABC/' }));
      const result = await new InstagramReelsPublisher(config).publishVideo(payload);
      expect(result.externalPostUrl).toBe('https://www.instagram.com/reel/ABC/');
    });

    it('no intenta publicar con una URL que Meta no puede descargar', async () => {
      await expect(
        new InstagramReelsPublisher(config).publishVideo({ ...payload, publicVideoUrl: 'http://localhost:3000/a.mp4' }),
      ).rejects.toThrow(NonRetryablePublishError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('YouTube conserva #Shorts aunque el título sea largo', () => {
    const title = (new YouTubeShortsPublisher(config) as any).shortsTitle('x'.repeat(150));
    expect(title).toHaveLength(100);
    expect(title.endsWith('#Shorts')).toBe(true);
  });
});
