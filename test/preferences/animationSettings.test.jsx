// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/providers/theme/useTheme.js', () => ({
  useTheme: () => ({
    themeMode: 'dark',
    setThemeMode: vi.fn(),
    openThemeModal: vi.fn(),
    setLightTheme: vi.fn(),
    setDarkTheme: vi.fn(),
    fontFamily: 'inter',
    setFontFamily: vi.fn(),
    fontSize: 14,
    setFontSize: vi.fn(),
  }),
}));

vi.mock('@/platform/animationSettingsRepository.js', () => ({
  loadAnimationSettings: vi.fn(() => ({ frameCount: 60, fps: 30, speed: 1.5 })),
  saveAnimationSettings: vi.fn(() => ({ ok: true })),
  resetAnimationSettings: vi.fn(() => ({ ok: true })),
}));

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { PreferencesModal } from '@/features/preferences/components/PreferencesModal';

describe('PreferencesModal animation settings', () => {
  it('preferences modal source imports animation settings', async () => {
    const src = await import('@/features/preferences/components/PreferencesModal.jsx');
    expect(src.PreferencesModal).toBeTypeOf('function');
  });

  it('exports PreferencesModal component', () => {
    expect(typeof PreferencesModal).toBe('function');
  });

  it('component references Animation Settings text', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('Animation Settings');
  });

  it('component has animation tab value', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('"animation"');
  });

  it('component references platform repository', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('saveAnimationSettings');
    expect(fnStr).toContain('resetAnimationSettings');
  });

  it('component references ANIMATION_DEFAULTS', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('ANIMATION_DEFAULTS');
  });

  it('component contains frame/fps/speed inputs', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('anim-frames');
    expect(fnStr).toContain('anim-fps');
    expect(fnStr).toContain('anim-speed');
  });

  it('component has Save and Reset buttons', () => {
    const fnStr = PreferencesModal.toString();
    expect(fnStr).toContain('Save');
    expect(fnStr).toContain('Reset to defaults');
  });
});
