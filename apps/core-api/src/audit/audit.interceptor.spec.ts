import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';

describe('AuditInterceptor', () => {
  let reflector: { get: jest.Mock };
  let auditService: { record: jest.Mock };
  let interceptor: AuditInterceptor;

  const VALID_UUID = '12d7f005-38b8-4933-a614-bb6ecf0f9270';

  function makeContext(overrides: Partial<any> = {}) {
    const request = {
      user: { sub: 'user-1' },
      ip: '127.0.0.1',
      method: 'POST',
      params: {},
      route: { path: '/shgs' },
      ...overrides,
    };
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  beforeEach(() => {
    reflector = { get: jest.fn() };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(reflector as any, auditService as any);
  });

  it('is a no-op (never calls AuditService) when the route has no @Audited metadata', (done) => {
    reflector.get.mockReturnValue(undefined);
    const context = makeContext();
    const next = { handle: () => of({ id: VALID_UUID }) };

    interceptor.intercept(context, next as any).subscribe(() => {
      expect(auditService.record).not.toHaveBeenCalled();
      done();
    });
  });

  it('records using the response body id for a create (no route param id)', (done) => {
    reflector.get.mockReturnValue('Shg');
    const context = makeContext();
    const next = {
      handle: () => of({ id: VALID_UUID, name: 'Sri Lakshmi Pickles SHG' }),
    };

    interceptor.intercept(context, next as any).subscribe(() => {
      setImmediate(() => {
        expect(auditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            actorUserId: 'user-1',
            entityType: 'Shg',
            entityId: VALID_UUID,
            afterState: { id: VALID_UUID, name: 'Sri Lakshmi Pickles SHG' },
          }),
        );
        done();
      });
    });
  });

  it('records using the route param id for a delete (empty response body)', (done) => {
    reflector.get.mockReturnValue('Shg');
    const context = makeContext({
      method: 'DELETE',
      params: { id: VALID_UUID },
    });
    const next = { handle: () => of(undefined) };

    interceptor.intercept(context, next as any).subscribe(() => {
      setImmediate(() => {
        expect(auditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            entityId: VALID_UUID,
            afterState: undefined,
          }),
        );
        done();
      });
    });
  });

  it('skips recording (does not throw) when no valid entity id can be found', (done) => {
    reflector.get.mockReturnValue('Shg');
    const context = makeContext();
    const next = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next as any).subscribe(() => {
      expect(auditService.record).not.toHaveBeenCalled();
      done();
    });
  });

  it('never lets an audit-recording failure surface as a request failure', (done) => {
    reflector.get.mockReturnValue('Shg');
    auditService.record.mockRejectedValue(new Error('db down'));
    const context = makeContext();
    const next = { handle: () => of({ id: VALID_UUID }) };

    expect(() => {
      interceptor.intercept(context, next as any).subscribe(() => done());
    }).not.toThrow();
  });
});
