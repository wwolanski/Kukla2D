// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

const m = vi.hoisted(() => {
  const DEFAULT_CANVAS = Object.freeze({
    width: 800, height: 600, x: 0, y: 0,
  });
  let currentShowExportArea = false;
  let currentExportAreaMoveMode = false;
  let currentPopoverRequest = 0;
  let currentCanvas = { ...DEFAULT_CANVAS };
  let currentProject = { canvas: currentCanvas, animations: [] };

  const setShowExportArea = vi.fn((v) => { currentShowExportArea = !!v; });
  const setExportAreaMoveMode = vi.fn((v) => {
    currentExportAreaMoveMode = !!v;
    if (v) currentShowExportArea = true;
  });
  const updateCanvasAction = (patch) => {
    currentCanvas = { ...currentCanvas, ...patch };
    currentProject = { ...currentProject, canvas: currentCanvas };
  };
  const updateCanvas = vi.fn(updateCanvasAction);
  const computeBounds = vi.fn();
  const toastMock = vi.fn();

  const useEditorStore = vi.fn((sel) => {
    const s = {
      showExportArea: currentShowExportArea,
      setShowExportArea,
      exportAreaMoveMode: currentExportAreaMoveMode,
      setExportAreaMoveMode,
      exportAreaPopoverRequest: currentPopoverRequest,
    };
    return sel ? sel(s) : s;
  });

  const useProjectStore = vi.fn((sel) => {
    const s = { project: currentProject, hasUnsavedChanges: false, updateCanvas };
    return sel ? sel(s) : s;
  });

  const PRESETS = [
    { id: 'square-256', label: '256 × 256', width: 256, height: 256, group: 'Square' },
    { id: 'square-512', label: '512 × 512', width: 512, height: 512, group: 'Square' },
    { id: 'square-1024', label: '1024 × 1024', width: 1024, height: 1024, group: 'Square' },
    { id: 'pixel-16-9', label: '640 × 360 (16:9)', width: 640, height: 360, group: 'Landscape' },
    { id: 'hd-720', label: '1280 × 720', width: 1280, height: 720, group: 'Landscape' },
    { id: 'full-hd', label: '1920 × 1080', width: 1920, height: 1080, group: 'Landscape' },
    { id: 'portrait-720', label: '720 × 1280', width: 720, height: 1280, group: 'Portrait' },
    { id: 'classic-4-3', label: '800 × 600 (4:3)', width: 800, height: 600, group: 'Classic' },
  ];

  function matchPreset(dims = {}) {
    const { width, height } = dims;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return 'custom';
    for (const p of PRESETS) { if (p.width === width && p.height === height) return p.id; }
    return 'custom';
  }

  function presetPatch(_id) {
    if (_id === 'custom') throw new TypeError();
    const preset = PRESETS.find(p => p.id === _id);
    if (!preset) throw new RangeError();
    return Object.freeze({ width: preset.width, height: preset.height });
  }

  function buildSpecs() { return Object.freeze([{ animationId: null, timeMs: 0 }]); }

  return {
    useEditorStore,
    useProjectStore,
    computeEvaluatedExportBounds: computeBounds,
    toast: toastMock,
    getCurrentCanvas: () => currentCanvas,
    getShowExportArea: () => currentShowExportArea,
    getExportAreaMoveMode: () => currentExportAreaMoveMode,
    requestPopover: () => { currentPopoverRequest += 1; },
    updateCanvasSpy: updateCanvas,
    setCanvas: (partial) => {
      currentCanvas = { ...DEFAULT_CANVAS, ...partial };
      currentProject = { ...currentProject, canvas: currentCanvas };
    },
    setAnimations: (animations) => {
      currentProject = { ...currentProject, animations };
    },
    reset: () => {
      currentShowExportArea = false;
      currentExportAreaMoveMode = false;
      currentPopoverRequest = 0;
      currentCanvas = { ...DEFAULT_CANVAS };
      currentProject = { canvas: currentCanvas, animations: [] };
      setShowExportArea.mockClear();
      setExportAreaMoveMode.mockClear();
      updateCanvas.mockClear();
      computeBounds.mockReset();
      toastMock.mockReset();
    },
    EXPORT_AREA_PRESETS: PRESETS,
    matchExportAreaPreset: matchPreset,
    createExportAreaPresetPatch: presetPatch,
    buildExportAreaFitFrameSpecs: buildSpecs,
  };
});

vi.mock('@/store/editorStore', () => ({ useEditorStore: m.useEditorStore }));
vi.mock('@/store/projectStore', () => ({ useProjectStore: m.useProjectStore }));
vi.mock('@/components/ui/use-toast', () => ({ toast: m.toast }));
vi.mock('@/features/export/domain/exportAreaPresets.js', () => ({
  EXPORT_AREA_PRESETS: m.EXPORT_AREA_PRESETS,
  CUSTOM_PRESET_ID: 'custom',
  getExportAreaPreset: (_id) => m.EXPORT_AREA_PRESETS.find(p => p.id === _id) ?? null,
  matchExportAreaPreset: m.matchExportAreaPreset,
  createExportAreaPresetPatch: m.createExportAreaPresetPatch,
}));
vi.mock('@/features/export/domain/exportAreaFitFrameSpecs.js', () => ({
  buildExportAreaFitFrameSpecs: m.buildExportAreaFitFrameSpecs,
}));
vi.mock('@/features/export/domain/computeEvaluatedExportBounds.js', () => ({
  computeEvaluatedExportBounds: m.computeEvaluatedExportBounds,
}));

import { ExportAreaPopover } from '@/features/export/components/ExportAreaPopover.jsx';
import { useAnimationStore } from '@/store/animationStore';

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(element); });
  return { container, root };
}

let currentMount;

function openPopover() {
  const btn = [...currentMount.container.querySelectorAll('button')]
    .find(b => b.title === 'Export Area');
  act(() => { btn.click(); });
}

function changeInput(input, value) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  valueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ExportAreaPopover', () => {
  beforeEach(() => {
    m.reset();
    useAnimationStore.setState({ activeAnimationId: null, isPlaying: false, _lastTimestamp: null });
    document.body.innerHTML = '';
    currentMount = mount(<ExportAreaPopover />);
  });

  afterEach(() => {
    act(() => { currentMount.root.unmount(); });
    document.body.innerHTML = '';
  });

  it('renders trigger button', () => {
    const btn = [...currentMount.container.querySelectorAll('button')]
      .find(b => b.title === 'Export Area');
    expect(btn).toBeTruthy();
  });

  it('switch defaults to off (A1, A2)', () => {
    openPopover();
    expect(document.querySelector('#export-area-visibility')
      .getAttribute('data-state')).toBe('unchecked');
  });

  it('toggle calls setShowExportArea (A3)', () => {
    openPopover();
    act(() => { document.querySelector('#export-area-visibility').click(); });
    expect(m.getShowExportArea()).toBe(true);
    expect(m.updateCanvasSpy).not.toHaveBeenCalled();
  });

  it('preset trigger shows matched preset label (A5)', () => {
    openPopover();
    const combo = document.querySelector('[role="combobox"]');
    expect(combo.textContent).toMatch(/800 × 600/);
  });

  it('shows Custom first, before visually separated preset groups', () => {
    openPopover();
    act(() => { document.querySelector('[role="combobox"]').click(); });
    const options = [...document.querySelectorAll('[role="option"]')];
    expect(options[0].textContent).toMatch(/^Custom/);
    expect(document.body.textContent).toContain('Square');
    expect(document.body.textContent).toContain('Landscape');
  });

  it('closes the popover and starts move mode', () => {
    openPopover();
    const move = [...document.querySelectorAll('button')]
      .find(node => node.textContent.trim() === 'Move');
    act(() => { move.click(); });
    expect(m.getExportAreaMoveMode()).toBe(true);
    expect(document.querySelector('#export-area-width')).toBeNull();
    act(() => { currentMount.root.render(<ExportAreaPopover />); });
    const trigger = [...currentMount.container.querySelectorAll('button')]
      .find(button => button.title === 'Export Area');
    expect(trigger.getAttribute('aria-pressed')).toBe('true');
    expect(trigger.className).toContain('bg-primary');
  });

  it('reopens the popover when Save emits a reopen request', () => {
    m.requestPopover();
    act(() => { currentMount.root.render(<ExportAreaPopover />); });
    expect(document.querySelector('#export-area-width')).toBeTruthy();
  });

  it('pauses playback before starting move mode', () => {
    useAnimationStore.setState({ isPlaying: true, _lastTimestamp: 123 });
    openPopover();
    const move = [...document.querySelectorAll('button')]
      .find(node => node.textContent.trim() === 'Move');
    act(() => { move.click(); });
    expect(useAnimationStore.getState()).toMatchObject({
      isPlaying: false,
      _lastTimestamp: null,
    });
    expect(m.getExportAreaMoveMode()).toBe(true);
  });

  it('applies a selected preset and persists its identity (A5)', () => {
    openPopover();
    const combo = document.querySelector('[role="combobox"]');
    act(() => { combo.click(); });
    const option = [...document.querySelectorAll('[role="option"]')]
      .find(node => node.textContent.includes('256 × 256'));
    expect(option).toBeTruthy();
    act(() => { option.click(); });
    expect(m.updateCanvasSpy).toHaveBeenCalledTimes(1);
    expect(m.updateCanvasSpy).toHaveBeenCalledWith({
      width: 256,
      height: 256,
      presetId: 'square-256',
      fitSource: null,
    });
  });

  it('shows Custom when dims non-matching (A6)', () => {
    m.setCanvas({ width: 123, height: 456 });
    act(() => { currentMount.root.unmount(); });
    currentMount = mount(<ExportAreaPopover />);
    openPopover();
    expect(document.querySelector('[role="combobox"]').textContent).toMatch(/Custom/i);
  });

  it('persists an explicit Custom selection (A6)', () => {
    openPopover();
    act(() => { document.querySelector('[role="combobox"]').click(); });
    const option = [...document.querySelectorAll('[role="option"]')]
      .find(node => node.textContent.trim() === 'Custom');
    expect(option).toBeTruthy();
    act(() => { option.click(); });
    expect(m.updateCanvasSpy).toHaveBeenCalledWith({ presetId: 'custom', fitSource: null });
  });

  it('shows width/height inputs with current canvas values (A7)', () => {
    openPopover();
    const inputs = document.querySelectorAll('input[type="number"]');
    expect(inputs[0].value).toBe('800');
    expect(inputs[1].value).toBe('600');
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[1].disabled).toBe(true);
  });

  it('invalid draft does not mutate canvas (A7)', () => {
    openPopover();
    const w = document.querySelector('#export-area-width');
    act(() => {
      changeInput(w, '-5');
      w.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(m.getCurrentCanvas().width).toBe(800);
    expect(m.getCurrentCanvas().height).toBe(600);
    expect(m.updateCanvasSpy).not.toHaveBeenCalled();
  });

  it('rejects fractional width instead of rounding it (R5)', () => {
    openPopover();
    const w = document.querySelector('#export-area-width');
    act(() => {
      changeInput(w, '640.5');
      w.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(m.getCurrentCanvas().width).toBe(800);
    expect(m.updateCanvasSpy).not.toHaveBeenCalled();
  });

  it('commits a valid integer width exactly once', () => {
    m.setCanvas({ width: 123, height: 456, presetId: 'custom' });
    act(() => { currentMount.root.unmount(); });
    currentMount = mount(<ExportAreaPopover />);
    openPopover();
    const w = document.querySelector('#export-area-width');
    act(() => {
      changeInput(w, '640');
      w.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(m.updateCanvasSpy).toHaveBeenCalledTimes(1);
    expect(m.updateCanvasSpy).toHaveBeenCalledWith({
      width: 640,
      presetId: 'custom',
      fitSource: null,
    });
  });

  it('synchronizes drafts after an external canvas change', () => {
    openPopover();
    m.setCanvas({ width: 1024, height: 512, x: -10, y: 25 });
    act(() => { currentMount.root.render(<ExportAreaPopover />); });
    expect(document.querySelector('#export-area-width').value).toBe('1024');
    expect(document.querySelector('#export-area-height').value).toBe('512');
    expect(document.querySelector('#export-area-x')).toBeNull();
    expect(document.querySelector('#export-area-y')).toBeNull();
  });

  it('fit calls computeEvaluatedExportBounds on click (A8)', () => {
    m.computeEvaluatedExportBounds.mockReturnValue({
      ok: true, area: { x: 10, y: 20, width: 300, height: 400 },
    });
    openPopover();
    const btn = [...document.querySelectorAll('button')].find(b =>
      b.textContent.includes('Fit'));
    act(() => { btn.click(); });
    expect(m.computeEvaluatedExportBounds).toHaveBeenCalled();
    expect(m.updateCanvasSpy).toHaveBeenCalledWith({
      x: 10,
      y: 20,
      width: 300,
      height: 400,
      presetId: 'custom',
      fitSource: { kind: 'staging' },
    });
  });

  it('fit no-content shows toast', () => {
    m.computeEvaluatedExportBounds.mockReturnValue({
      ok: false, reason: 'no-visible-content',
    });
    openPopover();
    const btn = [...document.querySelectorAll('button')].find(b =>
      b.textContent.includes('Fit'));
    act(() => { btn.click(); });
    expect(m.toast).toHaveBeenCalled();
    expect(m.updateCanvasSpy).not.toHaveBeenCalled();
  });

  it('fits the active animation and communicates its source in Custom', () => {
    m.setAnimations([
      { id: 'idle', name: 'Idle', duration: 1000, fps: 30 },
      { id: 'walk', name: 'Walk Cycle', duration: 500, fps: 24 },
    ]);
    useAnimationStore.setState({ activeAnimationId: 'walk' });
    m.computeEvaluatedExportBounds.mockReturnValue({
      ok: true,
      area: { x: 1, y: 2, width: 300, height: 200 },
    });
    act(() => { currentMount.root.unmount(); });
    currentMount = mount(<ExportAreaPopover />);
    openPopover();
    const btn = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Fit'));
    act(() => { btn.click(); });
    expect(m.updateCanvasSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      presetId: 'custom',
      fitSource: { kind: 'animation', animationId: 'walk', animationName: 'Walk Cycle' },
    }));

    act(() => { currentMount.root.render(<ExportAreaPopover />); });
    expect(document.body.textContent).toContain('Based on Walk Cycle');
  });

  it('label text is Show export area', () => {
    openPopover();
    const labels = [...document.querySelectorAll('label')];
    expect(labels.find(l => l.textContent.trim() === 'Show export area')).toBeTruthy();
  });

  it('does not expose raster background controls', () => {
    openPopover();
    expect(document.body.textContent).not.toContain('Background Color');
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('associates controls with accessible labels', () => {
    openPopover();
    for (const id of [
      'export-area-size-preset',
      'export-area-width',
      'export-area-height',
    ]) {
      const control = document.querySelector(`#${id}`);
      const label = document.querySelector(`label[for="${id}"]`);
      expect(control).toBeTruthy();
      expect(label).toBeTruthy();
    }
  });
});
