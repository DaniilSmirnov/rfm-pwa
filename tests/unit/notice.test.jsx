// @vitest-environment happy-dom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Notice from '../../src/components/Notice.jsx';

afterEach(cleanup);

describe('Notice', () => {
  it('renders a neutral div by default without imposing landmark semantics', () => {
    render(<Notice data-testid="notice">Updates are ready</Notice>);
    const notice = screen.getByTestId('notice');
    expect(notice.tagName).toBe('DIV');
    expect(notice.className).toBe('notice notice--info');
    expect(notice.textContent).toBe('Updates are ready');
  });

  it('supports warning variant, semantic element, custom classes, and accessibility attributes', () => {
    render(
      <Notice as="div" variant="warning" className="storage-note" role="status" aria-live="polite">
        Free up space
      </Notice>,
    );
    const notice = screen.getByRole('status');
    expect(notice.tagName).toBe('DIV');
    expect(notice.className).toBe('notice notice--warning storage-note');
    expect(notice.getAttribute('aria-live')).toBe('polite');
  });

  it('supports the inverse variant used by the update toast', () => {
    render(<Notice variant="inverse">App updated</Notice>);
    expect(screen.getByText('App updated').className).toBe('notice notice--inverse');
  });
});
