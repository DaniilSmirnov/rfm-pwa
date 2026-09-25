// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConnectivityMonitor } from '../../src/app/network-status.js';

function setNavigatorOnline(value){
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>value});
}

afterEach(()=>{
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('connectivity monitor',()=>{
  it('switches offline immediately on browser offline event',async()=>{
    setNavigatorOnline(true);
    const onChange=vi.fn();
    const monitor=createConnectivityMonitor({probe:async()=>true,onChange,intervalMs:60_000});
    await monitor.check();

    setNavigatorOnline(false);
    window.dispatchEvent(new Event('offline'));

    expect(monitor.online).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
    monitor.stop();
  });

  it('detects unreachable internet even while navigator reports online',async()=>{
    setNavigatorOnline(true);
    const onChange=vi.fn();
    const monitor=createConnectivityMonitor({probe:async()=>false,onChange,intervalMs:60_000});

    await monitor.check();

    expect(monitor.online).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
    monitor.stop();
  });

  it('returns online after connectivity is restored',async()=>{
    setNavigatorOnline(true);
    let reachable=false;
    const onChange=vi.fn();
    const monitor=createConnectivityMonitor({probe:async()=>reachable,onChange,intervalMs:60_000});
    await monitor.check();
    expect(monitor.online).toBe(false);

    reachable=true;
    window.dispatchEvent(new Event('online'));
    await new Promise(resolve=>queueMicrotask(resolve));

    expect(monitor.online).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    monitor.stop();
  });

  it('periodically rechecks connectivity while page is visible',async()=>{
    vi.useFakeTimers();
    setNavigatorOnline(true);
    let reachable=true;
    const probe=vi.fn(async()=>reachable);
    const monitor=createConnectivityMonitor({probe,intervalMs:1000});
    await monitor.check();

    reachable=false;
    await vi.advanceTimersByTimeAsync(1000);

    expect(probe).toHaveBeenCalled();
    expect(monitor.online).toBe(false);
    monitor.stop();
  });
});
