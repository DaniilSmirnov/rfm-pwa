// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pwaLaunchContext, isStandalonePwa, installInstructions } from '../../src/app/pwa.js';

const originalStandalone=Object.getOwnPropertyDescriptor(navigator,'standalone');

afterEach(()=>{
  vi.restoreAllMocks();
  if(originalStandalone) Object.defineProperty(navigator,'standalone',originalStandalone);
  else delete navigator.standalone;
});

describe('PWA launch helpers',()=>{
  it('detects normal browser launch',()=>{
    vi.spyOn(window,'matchMedia').mockImplementation(query=>({matches:false,media:query,addEventListener(){},removeEventListener(){}}));
    expect(pwaLaunchContext()).toMatchObject({installedLaunch:false,browserMode:true});
    expect(isStandalonePwa()).toBe(false);
  });

  it('detects standalone display mode',()=>{
    vi.spyOn(window,'matchMedia').mockImplementation(query=>({matches:query.includes('standalone'),media:query,addEventListener(){},removeEventListener(){}}));
    expect(pwaLaunchContext()).toMatchObject({installedLaunch:true,displayMode:'standalone',browserMode:false});
    expect(isStandalonePwa()).toBe(true);
  });

  it('provides generic browser install instructions',()=>{
    const instructions=installInstructions();
    expect(instructions.title).toContain('Rally Fans Map');
    expect(instructions.steps.length).toBeGreaterThan(0);
    expect(instructions.action).toBeTruthy();
  });
});
