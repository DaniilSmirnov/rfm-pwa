import { describe, expect, it, vi } from 'vitest';
import { handleTelemetryApi, telemetrySampleRate, shouldSampleError, writeErrorTrace } from '../../src/worker/telemetry.js';

describe('worker error telemetry',()=>{
  it('defaults to 20 percent sampling',()=>expect(telemetrySampleRate({})).toBe(0.2));
  it('clamps configured sampling rate',()=>{
    expect(telemetrySampleRate({ERROR_TRACE_SAMPLE_RATE:'2'})).toBe(1);
    expect(telemetrySampleRate({ERROR_TRACE_SAMPLE_RATE:'-1'})).toBe(0);
  });
  it('uses head sampling before Analytics Engine write',()=>{
    expect(shouldSampleError({ERROR_TRACE_SAMPLE_RATE:'0.2'},()=>0.19)).toBe(true);
    expect(shouldSampleError({ERROR_TRACE_SAMPLE_RATE:'0.2'},()=>0.2)).toBe(false);
  });
  it('writes structured sampled traces without query strings',()=>{
    const writeDataPoint=vi.fn();
    const env={ERROR_TRACE_SAMPLE_RATE:'1',ERROR_TRACES:{writeDataPoint}};
    expect(writeErrorTrace(env,{source:'client',kind:'map',name:'Error',message:'boom',stack:'trace',path:'/race/7'},{random:()=>0})).toBe(true);
    expect(writeDataPoint).toHaveBeenCalledOnce();
    expect(writeDataPoint.mock.calls[0][0].blobs).toEqual(['client','map','Error','boom','trace','/race/7']);
  });
  it('accepts client error reports',async()=>{
    const writeDataPoint=vi.fn();
    const request=new Request('https://example.test/api/telemetry/error',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({kind:'window-error',name:'TypeError',message:'broken',stack:'x',path:'/map'})
    });
    const response=await handleTelemetryApi(request,{ERROR_TRACE_SAMPLE_RATE:'1',ERROR_TRACES:{writeDataPoint}});
    expect(response.status).toBe(202);
    expect(writeDataPoint).toHaveBeenCalledOnce();
  });
});
