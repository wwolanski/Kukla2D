// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

vi.mock('@/app/providers/theme/useTheme.js', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {}, resolvedTheme: 'dark' }),
}));

import { HelpIcon } from '@/components/ui/help-icon';
import { SectionTitle } from '@/features/inspector/components/fields/InspectorRow';

function renderInto(node, element) {
  const root = createRoot(node);
  act(() => { root.render(element); });
  return root;
}

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderInto(container, element);
  return container;
}

describe('HelpIcon', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders as a focusable button element', () => {
    const container = mount(<HelpIcon tip="Test tooltip" />);
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Help');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('renders nothing when tip is empty', () => {
    const container = mount(<HelpIcon tip="" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('contains an SVG with question mark', () => {
    const container = mount(<HelpIcon tip="Test" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('?');
  });
});

describe('SectionTitle', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('renders children text', () => {
    const container = mount(<SectionTitle>Transform</SectionTitle>);
    expect(container.textContent).toContain('Transform');
  });

  it('renders HelpIcon when help prop is provided', () => {
    const container = mount(<SectionTitle help="Some explanation">Mesh</SectionTitle>);
    expect(container.querySelector('button[aria-label="Help"]')).toBeTruthy();
  });

  it('does not render HelpIcon when help prop is absent', () => {
    const container = mount(<SectionTitle>Bone</SectionTitle>);
    expect(container.querySelector('button[aria-label="Help"]')).toBeNull();
  });
});
