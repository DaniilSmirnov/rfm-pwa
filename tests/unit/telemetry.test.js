// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, setupErrorTelemetry } from '../../src/app/telemetry.js';

afterEach(()=>vi.restoreAllMocks());

describe('client error telemetry',()=>{
  it('reports an error to the same-origin telemetry endpoint',()=>{
    Object.defineProperty(navigator,'sendBeacon',{configurable:true,value:vi.fn(()=>true)});
    expect(reportClientError(new Error('map failed'),'map')).toBe(true);
    expect(navigator.sendBeacon).toHaveBeenCalledOnce();
    expect(navigator.sendBeacon.mock.calls[0][0]).toBe('/api/telemetry/error');
  });

  it('installs global error and unhandled rejection listeners',()=>{
    const spy=vi.spyOn(window,'addEventListener');
    setupErrorTelemetry();
    expect(spy).toHaveBeenCalledWith('error',expect.any(Function));
    expect(spy).toHaveBeenCalledWith('unhandledrejection',expect.any(Function));
  });
});
