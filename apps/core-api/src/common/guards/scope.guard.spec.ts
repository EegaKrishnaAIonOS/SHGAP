import { ScopeGuard } from './scope.guard';

describe('ScopeGuard.computeScope', () => {
  it('grants global scope to ADMIN', () => {
    const scope = ScopeGuard.computeScope('u1', [{ role: 'ADMIN' }]);
    expect(scope).toEqual({ kind: 'global' });
  });

  it('grants global scope to STATE_OFFICIAL', () => {
    const scope = ScopeGuard.computeScope('u1', [{ role: 'STATE_OFFICIAL' }]);
    expect(scope).toEqual({ kind: 'global' });
  });

  it('scopes ULB_OFFICIAL to their ULB(s) and parent district(s)', () => {
    const scope = ScopeGuard.computeScope('u1', [
      { role: 'ULB_OFFICIAL', ulbId: 'ulb-1', districtId: 'dist-1' },
    ]);
    expect(scope).toEqual({
      kind: 'ulb',
      ulbIds: ['ulb-1'],
      districtIds: ['dist-1'],
    });
  });

  it('scopes DISTRICT_OFFICIAL to their district(s)', () => {
    const scope = ScopeGuard.computeScope('u1', [
      { role: 'DISTRICT_OFFICIAL', districtId: 'dist-1' },
    ]);
    expect(scope).toEqual({ kind: 'district', districtIds: ['dist-1'] });
  });

  it('falls back to self-only scope for an SHG member', () => {
    const scope = ScopeGuard.computeScope('u1', [{ role: 'SHG' }]);
    expect(scope).toEqual({ kind: 'self', userId: 'u1' });
  });

  it('falls back to self-only scope for a user with no role assignments', () => {
    const scope = ScopeGuard.computeScope('u1', []);
    expect(scope).toEqual({ kind: 'self', userId: 'u1' });
  });

  it('prefers ULB scope over district scope when a user somehow holds both', () => {
    const scope = ScopeGuard.computeScope('u1', [
      { role: 'DISTRICT_OFFICIAL', districtId: 'dist-1' },
      { role: 'ULB_OFFICIAL', ulbId: 'ulb-1', districtId: 'dist-1' },
    ]);
    expect(scope.kind).toBe('ulb');
  });
});
