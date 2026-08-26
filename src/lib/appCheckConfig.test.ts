import { describe, expect, it } from 'vitest';
import { APP_CHECK_ENV_KEY, appCheckBuildError, appCheckOptional } from './appCheckConfig';

describe('appCheckBuildError', () => {
  it('lässt einen Build mit Site-Key durch', () => {
    expect(appCheckBuildError({ [APP_CHECK_ENV_KEY]: '6Lc-echter-key' })).toBeNull();
  });

  it('meldet den fehlenden Schlüssel', () => {
    expect(appCheckBuildError({})).toContain(APP_CHECK_ENV_KEY);
  });

  it('lässt einen leeren oder aus Leerzeichen bestehenden Wert nicht durchgehen', () => {
    // Genau der Fall, der bisher still zu einem Build ohne App Check führte.
    expect(appCheckBuildError({ [APP_CHECK_ENV_KEY]: '' })).not.toBeNull();
    expect(appCheckBuildError({ [APP_CHECK_ENV_KEY]: '   ' })).not.toBeNull();
  });
});

describe('appCheckOptional', () => {
  it('gilt nur bei ausdrücklichem APP_CHECK_OPTIONAL=1', () => {
    expect(appCheckOptional({ APP_CHECK_OPTIONAL: '1' })).toBe(true);
    expect(appCheckOptional({ APP_CHECK_OPTIONAL: 'true' })).toBe(false);
    expect(appCheckOptional({})).toBe(false);
  });
});
