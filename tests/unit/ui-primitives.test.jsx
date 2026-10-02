// @vitest-environment happy-dom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionGroup from '../../src/components/ActionGroup/ActionGroup.jsx';
import Badge from '../../src/components/Badge/Badge.jsx';
import Button from '../../src/components/Button/Button.jsx';
import CollapsibleSection from '../../src/components/CollapsibleSection/CollapsibleSection.jsx';
import EmptyState from '../../src/components/EmptyState/EmptyState.jsx';
import MountainTerrainIcon from '../../src/components/MountainTerrainIcon/MountainTerrainIcon.jsx';
import Panel from '../../src/components/Panel/Panel.jsx';
import SearchField from '../../src/components/SearchField/SearchField.jsx';
import SelectField from '../../src/components/SelectField/SelectField.jsx';
import SectionHeader from '../../src/components/SectionHeader/SectionHeader.jsx';

afterEach(cleanup);

describe('shared UI primitives', () => {
  it('gives buttons safe native defaults and supports disabled and busy states', () => {
    const { rerender } = render(<Button>Open</Button>);
    let button = screen.getByRole('button', { name: 'Open' });
    expect(button.type).toBe('button');
    expect(button.className).toBe('button');

    rerender(<Button loading>Saving</Button>);
    button = screen.getByRole('button', { name: 'Saving' });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    rerender(
      <Button type="submit" disabled className="button danger">
        Delete
      </Button>,
    );
    button = screen.getByRole('button', { name: 'Delete' });
    expect(button.type).toBe('submit');
    expect(button.disabled).toBe(true);
    expect(button.className).toBe('button danger');
  });

  it('preserves additional button props and invokes its handler', () => {
    const onClick = vi.fn();
    render(
      <Button data-action="apply" onClick={onClick}>
        Apply
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(button);
    expect(button.dataset.action).toBe('apply');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('forwards refs to the native button for Radix asChild triggers', () => {
    const ref = React.createRef();
    render(<Button ref={ref}>Tools</Button>);
    const button = screen.getByRole('button', { name: 'Tools' });
    expect(ref.current).toBe(button);
  });

  it('renders action groups, badges, and panels with chosen semantics', () => {
    render(
      <>
        <ActionGroup className="point-buttons" aria-label="Point actions">
          <span>Action</span>
        </ActionGroup>
        <Badge variant="offline" data-testid="status">
          Offline
        </Badge>
        <Panel as="article" className="compact" aria-label="Saved race">
          Pack
        </Panel>
      </>,
    );
    expect(screen.getByRole('group', { name: 'Point actions' }).className).toBe(
      'actions point-buttons',
    );
    expect(screen.getByTestId('status').className).toBe('badge offline');
    expect(screen.getByRole('article', { name: 'Saved race' }).className).toBe(
      'rfm-section compact',
    );
  });

  it('supports configurable empty states and section heading slots', () => {
    render(
      <>
        <EmptyState as="div" role="status" className="small">
          No races
        </EmptyState>
        <SectionHeader className="saved-head">
          <h2>Saved</h2>
          <Button>Refresh</Button>
        </SectionHeader>
      </>,
    );
    expect(screen.getByRole('status').className).toBe('empty-state muted small');
    expect(screen.getByRole('heading', { name: 'Saved' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
  });

  it('keeps search input attributes, value changes, and refs', () => {
    const ref = React.createRef();
    const onChange = vi.fn();
    render(
      <SearchField ref={ref} aria-label="Search rallies" value="Karelia" onChange={onChange} />,
    );
    const input = screen.getByRole('searchbox', { name: 'Search rallies' });
    expect(input.type).toBe('search');
    expect(input.value).toBe('Karelia');
    expect(ref.current).toBe(input);
    fireEvent.change(input, { target: { value: 'Pskov' } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('keeps select attributes, options, value changes, and refs', () => {
    const ref = React.createRef();
    const onChange = vi.fn();
    render(
      <SelectField
        ref={ref}
        aria-label="Stage"
        className="stage-filter"
        value="ss1"
        onChange={onChange}
      >
        <option value="ss1">SS1</option>
        <option value="ss2">SS2</option>
      </SelectField>,
    );
    const select = screen.getByRole('combobox', { name: 'Stage' });
    expect(select.className).toBe('select-field stage-filter');
    expect(select.value).toBe('ss1');
    expect(ref.current).toBe(select);
    fireEvent.click(select);
    const option = screen.getByRole('option', { name: 'SS2' });
    fireEvent.pointerDown(option, { button: 0 });
    fireEvent.pointerUp(option, { button: 0 });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('supports Radix keyboard selection, dismissal, and controlled updates', () => {
    const onChange = vi.fn();
    render(
      <SelectField aria-label="Stage" value="ss1" onChange={onChange}>
        <option value="ss1">SS1</option>
        <option value="ss2">SS2</option>
      </SelectField>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Stage' });
    expect(trigger.value).toBe('ss1');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: 'SS2' })).toBeTruthy();
    const option = screen.getByRole('option', { name: 'SS2' });
    fireEvent.pointerDown(option, { button: 0 });
    fireEvent.pointerUp(option, { button: 0 });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: 'ss2' } }));
    fireEvent.keyDown(document, { key: 'Escape' });

    cleanup();
    render(
      <SelectField aria-label="Stage" value="ss2" onChange={onChange}>
        <option value="ss1">SS1</option>
        <option value="ss2">SS2</option>
      </SelectField>,
    );
    expect(screen.getByRole('combobox', { name: 'Stage' }).value).toBe('ss2');
  });

  it('preserves details behavior and renders a React SVG icon', () => {
    render(
      <CollapsibleSection summary={<span>Details</span>} data-testid="details">
        <p>Content</p>
      </CollapsibleSection>,
    );
    const details = screen.getByTestId('details');
    details.open = true;
    expect(details.open).toBe(true);
    expect(screen.getByText('Content')).toBeTruthy();

    const { container } = render(<MountainTerrainIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });
});
