// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from '../../src/app/sanitize.js';

describe('rich HTML sanitizer',()=>{
  it('keeps allowed formatting',()=>expect(sanitizeRichHtml('<p><strong>Rally</strong> <em>fans</em></p>')).toBe('<p><strong>Rally</strong> <em>fans</em></p>'));
  it('drops script element but keeps text',()=>{
    const html=sanitizeRichHtml('<p>before</p><script>alert(1)</script><p>after</p>');
    expect(html).not.toContain('<script');
    expect(html).toContain('alert(1)');
  });
  it('drops inline event handlers',()=>expect(sanitizeRichHtml('<p onclick="alert(1)">text</p>')).toBe('<p>text</p>'));
  it('removes javascript links',()=>expect(sanitizeRichHtml('<a href="javascript:alert(1)">bad</a>')).toBe('<a>bad</a>'));
  it('allows https links and adds rel protection',()=>{
    const html=sanitizeRichHtml('<a href="https://example.com/x">ok</a>');
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('allows mailto links',()=>expect(sanitizeRichHtml('<a href="mailto:a@example.com">mail</a>')).toContain('mailto:a@example.com'));
  it('allows tel links',()=>expect(sanitizeRichHtml('<a href="tel:+381123">call</a>')).toContain('tel:+381123'));
  it('unwraps unknown tags',()=>expect(sanitizeRichHtml('<section><p>Hello</p></section>')).toBe('<p>Hello</p>'));
  it('removes img entirely',()=>expect(sanitizeRichHtml('<p>A<img src=x onerror=alert(1)>B</p>')).toBe('<p>AB</p>'));
  it('preserves lists',()=>expect(sanitizeRichHtml('<ul><li>A</li><li>B</li></ul>')).toBe('<ul><li>A</li><li>B</li></ul>'));
  it('handles null',()=>expect(sanitizeRichHtml(null)).toBe(''));
});
