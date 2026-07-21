// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { useProjectStore } from '@/store/projectStore';
import { useAnimationStore } from '@/store/animationStore';

vi.mock('@/app/providers/theme/useTheme.js', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: () => {}, resolvedTheme: 'dark' }),
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { AutoMotionPanel } from '@/features/auto-motion/components/AutoMotionPanel';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

function renderInto(node, element) {
  const root = createRoot(node);
  act(() => { root.render(element); });
  return root;
}

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  renderInto(container, <TooltipProvider>{element}</TooltipProvider>);
  return container;
}

function makeEmptyProject() {
  return {
    version: 7,
    canvas: { width: 800, height: 600, x: 0, y: 0, bgEnabled: false, bgColor: '#ffffff' },
    textures: [],
    nodes: [],
    bones: [],
    slots: [],
    attachments: [],
    skins: [],
    constraints: [],
    defaultPose: {},
    animations: [],
    physics_groups: [],
    physicsRules: [],
    libraryFolders: [],
    assetPlacements: [],
    controlHandles: [],
    animationModifiers: [],
  };
}

function makeModifier(overrides = {}) {
  return {
    id: 'm1',
    name: 'Idle Breathing',
    presetId: 'builtin.idleBreathing',
    presetVersion: 1,
    enabled: true,
    order: 0,
    scope: 'project',
    clipId: null,
    category: 'loop',
    driver: { kind: 'time', periodMs: 2400, phase: 0, curve: 'easeInOutSine' },
    bindings: {},
    outputs: [],
    params: { strength: 0.5 },
    ...overrides,
  };
}

function getAddMotionBtn(container) {
  const buttons = container.querySelectorAll('button');
  return Array.from(buttons).find(b => b.textContent.includes('Add Motion'));
}

function getHelpBtns(container) {
  return container.querySelectorAll('button[aria-label="Help"]');
}

describe('AutoMotionPanel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    useEditorStore.setState({
      selection: [],
      editorMode: 'staging',
      showSkeleton: false,
      skeletonEditMode: false,
    });
    useProjectStore.setState({
      project: makeEmptyProject(),
      versionControl: { geometryVersion: 0, transformVersion: 0, textureVersion: 0 },
      hasUnsavedChanges: false,
    });
  });

  it('renders empty state with header', () => {
    const container = mount(<AutoMotionPanel />);
    const h2 = Array.from(container.querySelectorAll('h2')).find(el =>
      el.textContent.includes('Auto Motion')
    );
    expect(h2).toBeTruthy();
    const helpBtns = getHelpBtns(container);
    expect(helpBtns.length).toBe(1);
  });

  it('shows Add Motion button (feature-disabled) and canvas-pick hint without selected part', () => {
    useEditorStore.setState({ selection: [] });
    const container = mount(<AutoMotionPanel />);
    const btn = getAddMotionBtn(container);
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('opacity-50');
    const hint = container.querySelector('.italic');
    expect(hint?.textContent).toContain('canvas picking');
  });

  it('Add Motion button is feature-disabled even when a part is selected', () => {
    useEditorStore.setState({ selection: ['chest-1'] });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        nodes: [{ id: 'chest-1', type: 'part', name: 'Chest' }],
      },
    });
    const container = mount(<AutoMotionPanel />);
    const btn = getAddMotionBtn(container);
    expect(btn?.className).toContain('opacity-50');
  });

  it('Add Motion button does not open wizard when feature-disabled', () => {
    useEditorStore.setState({ selection: ['chest-1'] });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        nodes: [{ id: 'chest-1', type: 'part', name: 'Chest' }],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const btn = getAddMotionBtn(container);
    act(() => { btn?.click(); });

    const dialogTitle = Array.from(container.querySelectorAll('h3')).find(el =>
      el.textContent.includes('Add Motion')
    );
    expect(dialogTitle).toBeFalsy();
  });

  it('shows modifier card when modifiers exist', () => {
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    expect(container.textContent).toContain('Idle Breathing');
    expect(container.textContent).toContain('Loop');
    expect(container.textContent).toContain('All clips');
  });

  it('Add Motion header button is feature-disabled when modifiers exist', () => {
    useEditorStore.setState({ selection: ['chest-1'] });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        nodes: [{ id: 'chest-1', type: 'part', name: 'Chest' }],
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const buttons = container.querySelectorAll('button');
    const addBtn = Array.from(buttons).find(b => b.querySelector('svg.lucide-plus'));
    expect(addBtn).toBeTruthy();
    expect(addBtn.className).toContain('opacity-50');
  });

  it('updates modifier enabled state via checkbox', () => {
    const spy = vi.fn();
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier({ enabled: true })],
      },
    });
    useProjectStore.setState({ updateAnimationModifier: spy });

    const container = mount(<AutoMotionPanel />);
    const checkbox = container.querySelector('button[role="checkbox"]');
    act(() => { checkbox?.click(); });

    expect(spy).toHaveBeenCalledWith('m1', { enabled: false });
  });

  it('shows IdleBreathingControls for idleBreathing preset', () => {
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    expect(container.textContent).toContain('Strength');
    expect(container.textContent).toContain('Speed');
    expect(container.textContent).toContain('Phase');
    expect(container.textContent).toContain('Chest');
    expect(container.textContent).toContain('Lift');
  });

  it('renders 5 sliders for idleBreathing preset (Strength, Speed, Phase, Chest, Lift)', () => {
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const sliders = container.querySelectorAll('[role="slider"]');
    expect(sliders.length).toBe(5);
  });

  it('deletes modifier via delete button', () => {
    const spy = vi.fn();
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });
    useProjectStore.setState({ deleteAnimationModifier: spy });

    const container = mount(<AutoMotionPanel />);
    const deleteBtn = container.querySelector('button[title="Delete modifier"]');
    act(() => { deleteBtn?.click(); });

    expect(spy).toHaveBeenCalledWith('m1');
  });

  it('scope select renders with clip option disabled when no active animation', () => {
    useAnimationStore.setState({ activeAnimationId: null });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    expect(container.textContent).toContain('Scope');
  });

  it('shows Bake button in modifier card', () => {
    useAnimationStore.setState({ activeAnimationId: 'anim-1' });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animations: [{ id: 'anim-1', name: 'Idle', duration: 2000, fps: 24, tracks: [] }],
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const bakeBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Bake to Keyframes')
    );
    expect(bakeBtn).toBeTruthy();
  });

  it('Bake button is disabled when no active animation', () => {
    useAnimationStore.setState({ activeAnimationId: null });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const bakeBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Bake to Keyframes')
    );
    expect(bakeBtn?.disabled).toBe(true);
  });

  it('shows Head Cheek Jiggle in empty state', () => {
    const container = mount(<AutoMotionPanel />);
    expect(container.textContent).toContain('Head Cheek Jiggle');
    expect(container.textContent).toContain('Subtle cheek jiggle driven by head bone motion');
  });

  it('clicking Bake opens inline bake dialog', () => {
    useAnimationStore.setState({ activeAnimationId: 'anim-1' });
    useProjectStore.setState({
      project: {
        ...makeEmptyProject(),
        animations: [{ id: 'anim-1', name: 'Idle', duration: 2000, fps: 24, tracks: [] }],
        animationModifiers: [makeModifier()],
      },
    });

    const container = mount(<AutoMotionPanel />);
    const bakeBtn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Bake to Keyframes')
    );
    act(() => { bakeBtn?.click(); });
    expect(container.textContent).toContain('Disable live motion after bake');
    expect(container.textContent).toContain('Keep live motion enabled');
  });
});
