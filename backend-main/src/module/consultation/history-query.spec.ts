import { historyWhere } from './history-query';
import { ConsultationRepository } from './consultation.repository';
import { AdminRepository } from '../admin/admin.repository';

describe('Owner-bound history search and pagination', () => {
  it.each(['ADMIN', 'invalid', 'x'.repeat(101)])('rejects malformed filters: %s', value => {
    expect(() => historyWhere({ status: value }, 'customer')).toThrow();
  });
  it('rejects non-string query parameters', () => {
    expect(() => historyWhere({ search: ['private'] as never }, 'admin')).toThrow();
  });
  it('keeps customer ownership on both page and count queries', async () => {
    const callSession = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(41) };
    const result = await new ConsultationRepository({ callSession } as never)
      .findUserConsultationHistory('owner', { page: 2, limit: 20, search: 'Synthetic', status: 'COMPLETED' });
    const query = callSession.findMany.mock.calls[0][0];
    expect(query.where.userId).toBe('owner');
    expect(query.where.OR).toHaveLength(3);
    expect(query.skip).toBe(20);
    expect(callSession.count).toHaveBeenCalledWith({ where: query.where });
    expect(result.pagination.totalPages).toBe(3);
  });
  it('filters admin pages and totals using the same criteria', async () => {
    const callSession = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(21) };
    const result = await new AdminRepository({ callSession } as never)
      .findCallSessions({ page: 2, limit: 20, mode: 'VIDEO', search: 'Synthetic' });
    const query = callSession.findMany.mock.calls[0][0];
    expect(query.where.mode.equals).toBe('video');
    expect(query.where.OR).toHaveLength(12);
    expect(callSession.count).toHaveBeenCalledWith({ where: query.where });
    expect(result.pagination.totalPages).toBe(2);
  });
  it('preserves legacy Admin active and expired status groups and channel lookup', () => {
    expect(historyWhere({status:'ACTIVE'},'admin').status).toEqual({in:['ACTIVE','ONGOING'],mode:'insensitive'});
    expect(historyWhere({status:'EXPIRED'},'admin').status).toEqual({in:['EXPIRED','ENDED'],mode:'insensitive'});
    expect(JSON.stringify(historyWhere({search:'synthetic-channel'},'admin'))).toContain('channelName');
  });
  it('groups cancellation states without losing exact completed filtering', () => {
    expect(historyWhere({ status: 'cancelled' }, 'customer').status).toEqual({ in: ['CANCELLED', 'REJECTED', 'EXPIRED'], mode: 'insensitive' });
    expect(historyWhere({ status: 'COMPLETED' }, 'customer').status).toEqual({ in: ['COMPLETED'], mode: 'insensitive' });
  });
});
