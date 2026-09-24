import { describe, expect, it } from 'vitest';
import { rallyPackProgressText } from '../../src/app/rally-pack-ui.js';

describe('rallyPackProgressText',()=>{
  it('formats map progress with downloaded bytes',()=>{
    expect(rallyPackProgressText({phase:'map',status:'progress',done:12,total:40,bytes:2048},n=>`${n}B`))
      .toBe('Карта 30% · 2048B');
  });

  it('shows foreground asset progress',()=>{
    expect(rallyPackProgressText({phase:'assets',status:'progress',done:3,total:8,background:false}))
      .toBe('Материалы 37%');
  });

  it('makes background asset completion explicit',()=>{
    expect(rallyPackProgressText({phase:'done',assetDownload:{background:true}}))
      .toBe('Rally Pack сохранён · файлы в фоне');
  });
});
