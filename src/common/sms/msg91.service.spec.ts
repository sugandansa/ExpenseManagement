import { ConfigService } from '@nestjs/config';
import { Msg91Service, normalizeIndianMobile } from './msg91.service';

function config(overrides: Record<string, string> = {}) {
  const values = {
    MSG91_AUTH_KEY: 'test',
    MSG91_TEMPLATE_ID: 'flow-id',
    MSG91_SENDER_ID: 'WHTOCN',
    MSG91_OTP_VAR: 'num',
    ...overrides,
  };
  return { get: (key: string) => values[key as keyof typeof values] } as unknown as ConfigService;
}

describe('Msg91Service', () => {
  it('normalizes Indian mobiles', () => {
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
  });

  it('mocks send when AUTH_KEY is test', async () => {
    const service = new Msg91Service(config());
    await expect(service.sendSms('9876543210', '654321', 'Rajesh')).resolves.toEqual(
      expect.objectContaining({ mock: true }),
    );
  });

  it('returns false when the number is invalid', async () => {
    const service = new Msg91Service(config());
    await expect(service.sendOtp('12', '654321')).resolves.toBe(false);
  });

  it('posts to the MSG91 Flow API in live mode', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'success' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new Msg91Service(
      config({ MSG91_AUTH_KEY: 'live-key', MSG91_TEMPLATE_ID: '6a681b70da396b34ec0fe023' }),
    );
    await expect(service.sendOtp('9876543210', '654321', 'Rajesh')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://control.msg91.com/api/v5/flow',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authkey: 'live-key' }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.recipients[0]).toEqual(
      expect.objectContaining({ mobiles: '919876543210', num: '654321', OTP: '654321', NAME: 'Rajesh' }),
    );
  });
});
