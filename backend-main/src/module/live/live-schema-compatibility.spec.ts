import { hasLiveV2Schema } from './live-schema-compatibility';

describe('Live schema capabilities (mocked catalog; no database)', () => {
  it.each([
    [false, false, false, false],
    [true, true, true, true],
  ])(
    'detects protocol=%s host=%s connections=%s',
    async (protocol, host, connections, expected) => {
      const db: any = {
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ protocol, host, connections }]),
      };
      await expect(hasLiveV2Schema(db)).resolves.toBe(expected);
      const sql = db.$queryRaw.mock.calls[0][0].join('');
      expect(sql).toContain('pg_attribute');
      expect(sql).not.toContain('SELECT "connectionProtocol"');
    },
  );
  it.each([
    [true, false, false],
    [false, true, false],
    [false, false, true],
    [true, true, false],
    [true, false, true],
    [false, true, true],
  ])('rejects partial schema %s/%s/%s', async (protocol, host, connections) => {
    await expect(
      hasLiveV2Schema({
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ protocol, host, connections }]),
      } as any),
    ).rejects.toThrow('Incomplete Live migration');
  });
  it('fails closed on missing metadata', async () => {
    await expect(
      hasLiveV2Schema({ $queryRaw: jest.fn().mockResolvedValue([]) } as any),
    ).rejects.toThrow('capabilities unavailable');
  });
  it('propagates catalog errors without a P2022 fallback', async () => {
    const error = Object.assign(new Error('missing column'), { code: 'P2022' });
    await expect(
      hasLiveV2Schema({ $queryRaw: jest.fn().mockRejectedValue(error) } as any),
    ).rejects.toBe(error);
  });
});
