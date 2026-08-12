import { ROUTE_MANIFEST, bindableRoutes, heldRoutes } from '../../lib/api/route-manifest';

describe('Module 4 route manifest', () => {
  it('contains exactly 30 routes', () => {
    expect(ROUTE_MANIFEST.length).toBe(30);
  });

  it('holds nothing — the M16 and M18 holds lifted once BL deleted its own gateways', () => {
    expect(heldRoutes()).toEqual([]);
  });

  it('binds every route in the manifest', () => {
    const bindable = bindableRoutes();
    expect(bindable.length).toBe(30);
    expect(bindable.every((r) => !r.hold)).toBe(true);
  });

  it('every route has a non-empty path and routeId', () => {
    for (const r of ROUTE_MANIFEST) {
      expect(r.path.startsWith('/')).toBe(true);
      expect(r.routeId.length).toBeGreaterThan(0);
    }
  });

  it('only /approval/health is unauthenticated', () => {
    const publicRoutes = ROUTE_MANIFEST.filter((r) => r.auth === 'NONE' as any);
    expect(publicRoutes.length).toBe(1);
    expect(publicRoutes[0].path).toBe('/approval/health');
  });

  it('no two rows share a method + path (would collide on the gateway)', () => {
    const keys = ROUTE_MANIFEST.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('resolves to the 26 handler ARNs BL publishes', () => {
    const arns = new Set(ROUTE_MANIFEST.map((r) => `${r.moduleId}/${r.routeId}`));
    expect(arns.size).toBe(26);
  });

  // B-103 / B-059: M13 owns the APAR review chain; BL deleted these handlers,
  // so binding them would point the gateway at ARNs that do not exist.
  it('does not bind the deleted APAR review routes', () => {
    const reviewRoutes = ROUTE_MANIFEST.filter(
      (r) => r.routeId === 'hod-review' || r.routeId === 'director-review',
    );
    expect(reviewRoutes).toEqual([]);
  });

  it('exposes M14 scoring-config on all three methods and the ledger read', () => {
    const scoreRoutes = ROUTE_MANIFEST.filter((r) => r.moduleId === 'score');
    expect(scoreRoutes.map((r) => `${r.method} ${r.path}`).sort()).toEqual([
      'GET /score/{facultyId}',
      'GET /score/{facultyId}/contributions',
      'GET /scoring-config',
      'POST /scoring-config/preview',
      'PUT /scoring-config',
    ]);
  });
});
