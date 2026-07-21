// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioTrackRow } from '@/features/timeline/components/AudioTrackRow';
import { buildAudioTrackPatch } from '@/features/timeline/components/AudioTrackModal';
import { useAudioSync } from '@/features/timeline/application/useAudioSync.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    rerender(nextElement) {
      act(() => {
        root.render(nextElement);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('audio boundary', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('manifest audio components avoid store imports and generic commands prop usage', () => {
    const base = resolve(import.meta.dirname, '../../src/features/timeline/components');
    const listSrc = readFileSync(resolve(base, 'AudioTrackList.jsx'), 'utf8');
    const rowSrc = readFileSync(resolve(base, 'AudioTrackRow.jsx'), 'utf8');
    const modalSrc = readFileSync(resolve(base, 'AudioTrackModal.jsx'), 'utf8');

    expect(listSrc).not.toMatch(/@\/store\/(projectStore|animationStore|editorStore)/);
    expect(rowSrc).not.toMatch(/@\/store\/(projectStore|animationStore|editorStore)/);
    expect(modalSrc).not.toMatch(/@\/store\/(projectStore|animationStore|editorStore)/);
    expect(listSrc).not.toContain('commands');
    expect(rowSrc).not.toContain('commands.');
    expect(modalSrc).not.toContain('commands.');
  });

  it('buildAudioTrackPatch clamps invalid duration to minimum 100ms', () => {
    expect(buildAudioTrackPatch({
      name: '',
      startOffset: -25,
      audioStartMs: 500,
      duration: 20,
    })).toEqual({
      name: 'Untitled Audio',
      timelineStartMs: 0,
      audioStartMs: 500,
      audioEndMs: 600,
    });
  });

  it('delete and drag delegate to named audio intents', () => {
    const updateAudioTrack = vi.fn();
    const removeAudioTrack = vi.fn();
    const beginAudioTrackGesture = vi.fn();
    const endAudioTrackGesture = vi.fn();
    const track = {
      id: 'audio-1',
      name: 'VO',
      sourceUrl: 'blob:1',
      audioDurationMs: 5000,
      audioStartMs: 100,
      audioEndMs: 1100,
      timelineStartMs: 200,
    };

    const view = render(
      <AudioTrackRow
        track={track}
        animationId="anim-1"
        timelineDurationMs={4000}
        updateAudioTrack={updateAudioTrack}
        removeAudioTrack={removeAudioTrack}
        beginAudioTrackGesture={beginAudioTrackGesture}
        endAudioTrackGesture={endAudioTrackGesture}
        xToFrame={(x) => x}
        startFrame={0}
        totalFrames={4000}
        fps={1000}
      />,
    );

    const deleteButton = view.container.querySelector('button[title="Delete audio track"]');
    act(() => {
      deleteButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(removeAudioTrack).toHaveBeenCalledWith({
      animationId: 'anim-1',
      audioTrackId: 'audio-1',
    });

    const bar = view.container.querySelector('[title^="VO — drag to move"]');
    act(() => {
      bar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10 }));
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20 }));
      window.dispatchEvent(new MouseEvent('pointerup'));
    });

    expect(updateAudioTrack).toHaveBeenCalledWith({
      animationId: 'anim-1',
      audioTrackId: 'audio-1',
      patch: {
        timelineStartMs: 210,
      },
    });
    expect(beginAudioTrackGesture).toHaveBeenCalledWith('Move Audio Track');
    expect(endAudioTrackGesture).toHaveBeenCalledOnce();

    view.unmount();
  });

  it('useAudioSync contract depends on loopSignal for wrap restart', () => {
    const syncSrc = readFileSync(
      resolve(import.meta.dirname, '../../src/features/timeline/application/useAudioSync.ts'),
      'utf8',
    );

    expect(useAudioSync).toBeTypeOf('function');
    expect(syncSrc).toContain('session.loopSignal');
    expect(syncSrc).toMatch(/\[session\.playing,\s*session\.activeAnimationId,\s*session\.loopSignal,\s*stopAll\]/);
  });
});
