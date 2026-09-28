import {describe,expect,it} from 'vitest';
import {dangerExamples,safetyCountdowns,safetyRules,stageGuides} from '../../src/app/safety-memo-content.js';

describe('safety memo content',()=>{
  it('contains the complete illustrated safety sections',()=>{
    expect(safetyRules).toHaveLength(5);
    expect(safetyCountdowns).toHaveLength(6);
    expect(dangerExamples).toHaveLength(5);
    expect(stageGuides).toHaveLength(3);
    expect(dangerExamples.every(({title,image,description})=>title&&image.endsWith('.webp')&&description)).toBe(true);
    expect(stageGuides.every(({title,image,rules})=>title&&image.endsWith('.webp')&&rules.length>0)).toBe(true);
  });
});
