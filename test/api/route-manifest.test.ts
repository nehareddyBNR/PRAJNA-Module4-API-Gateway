import { ROUTE_MANIFEST, bindableRoutes, heldRoutes } from '../../lib/api/route-manifest';

describe('Module 4 route manifest', () => {
  it('contains exactly 28 routes', () => {
    expect(ROUTE_MANIFEST.length).toBe(28);
  });

  it('holds exactly the 6 M16 + 8 M18 routes', () => {
    expect(heldRoutes().length).toBe(14);
  });

  it('bindable routes exclude all held routes', () => {
    const bindable = bindableRoutes();
    expect(bindable.length).toBe(28 - 14);
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
});