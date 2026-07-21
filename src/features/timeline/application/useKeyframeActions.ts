import { useState, useCallback, useRef } from 'react';

import { toAnimationTargetId, type Animation, type AnimationId, type AnimationTargetId, type Track } from '@kukla2d/contracts';

import type { ProjectActions } from '@/store/project/projectStoreTypes';

import type {
  AnimationEasing,
  AnimationKeyframeInput,
} from '@/domain/animationCommandTypes';
import { computePoseOverrides } from '@/domain/animationEngine';

import {
  collectTrackKeyframeAddresses,
  keyframeAddressToString,
  parseKeyframeAddressSet,
} from './keyframeAddress.js';


import type { TimelineTargetState } from './useTimelineController.js';
import type { Dispatch, SetStateAction } from 'react';

interface KeyframeClipboard {
  properties: Record<string, unknown>;
  easing: AnimationEasing;
}

interface PoseClipboardEntry {
  id: AnimationTargetId;
  targetType: 'node' | 'bone';
  values: Record<string, number>;
}

interface PoseClipboard {
  entries: PoseClipboardEntry[];
}

interface KeyframeActionsOptions {
  animation: Animation | null;
  activeAnimationId: AnimationId | null;
  currentTimeMs: number;
  loopKeyframes: boolean;
  endFrame: number;
  upsertKeyframes: ProjectActions['upsertAnimationKeyframes'];
  addMarkerIntent: ProjectActions['addAnimationMarker'];
  deleteKeyframes: ProjectActions['deleteAnimationKeyframes'];
  setKeyframeEasing: ProjectActions['setAnimationKeyframeEasing'];
  selectedKeyframes: Set<string>;
  setSelectedKeyframes: Dispatch<SetStateAction<Set<string>>>;
  sel: readonly AnimationTargetId[];
  targetState: TimelineTargetState;
  currentFrame: number;
  fps: number;
}

function trackTargetId(track: Track): AnimationTargetId { return track.targetId; }

function getAddressesAtTime(
  animation: Animation | null,
  targetId: AnimationTargetId,
  properties: string | readonly string[] | null,
  timeMs: number,
): string[] {
  if (!animation) return [];
  const propertySet = properties
    ? new Set<string>(typeof properties === 'string' ? [properties] : properties)
    : null;
  return collectTrackKeyframeAddresses(
    animation.tracks.filter(
      (track) => trackTargetId(track) === targetId && (!propertySet || propertySet.has(track.property)),
    ),
    timeMs,
  ).map((address) => keyframeAddressToString(address));
}

function numericValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function useKeyframeActionsImpl({
  animation,
  activeAnimationId,
  currentTimeMs,
  loopKeyframes,
  endFrame,
  upsertKeyframes,
  addMarkerIntent,
  deleteKeyframes,
  setKeyframeEasing,
  selectedKeyframes,
  setSelectedKeyframes,
  sel,
  targetState,
  currentFrame,
  fps,
}: KeyframeActionsOptions) {
  const [clipboard, setClipboard] = useState<KeyframeClipboard | null>(null);
  const [poseClipboard, setPoseClipboard] = useState<PoseClipboard | null>(null);
  const playbackRef = useRef({ currentTimeMs, currentFrame });
  playbackRef.current.currentTimeMs = currentTimeMs;
  playbackRef.current.currentFrame = currentFrame;

  const copyKeyframe = useCallback((nodeId: AnimationTargetId, timeMs: number) => {
    if (!animation) return;
    const props: Record<string, unknown> = {};
    let easing: AnimationEasing = 'linear';

    for (const track of animation.tracks) {
      if (trackTargetId(track) !== nodeId) continue;
      const kf = track.keyframes.find(k => k.time === timeMs);
      if (kf) {
        props[track.property] = kf.value;
        easing = kf.easing ?? 'linear';
      }
    }

    if (Object.keys(props).length > 0) {
      setClipboard({ properties: props, easing });
    }
  }, [animation]);

  const pasteKeyframes = useCallback(() => {
    if (!clipboard || !animation || !activeAnimationId || sel.length === 0) return;

    const keyframes: AnimationKeyframeInput[] = sel.flatMap((targetId) => (
      Object.entries(clipboard.properties).map(([property, value]) => ({
        targetId,
        property,
        timeMs: playbackRef.current.currentTimeMs,
        value,
        easing: clipboard.easing,
      }))
    ));
    upsertKeyframes({
      animationId: activeAnimationId,
      keyframes,
    });
  }, [clipboard, animation, sel, activeAnimationId, upsertKeyframes]);

  const copyPose = useCallback(() => {
    if (!animation) return { changed: false };
    const endMs = (endFrame / fps) * 1000;
    const overrides = computePoseOverrides(animation, playbackRef.current.currentTimeMs, loopKeyframes, endMs);
    const ids = sel.length > 0 ? sel : Array.from(overrides.keys());
    const entries: PoseClipboardEntry[] = [];
    for (const id of ids) {
      const node = targetState.nodesById.get(id);
      const bone = targetState.bonesById.get(id);
      const ov = overrides.get(id) ?? {};
      if (node) {
        entries.push({
          id: toAnimationTargetId(id),
          targetType: 'node',
          values: {
            x: numericValue(ov.x, node.transform.x),
            y: numericValue(ov.y, node.transform.y),
            rotation: numericValue(ov.rotation, node.transform.rotation),
            scaleX: numericValue(ov.scaleX, node.transform.scaleX),
            scaleY: numericValue(ov.scaleY, node.transform.scaleY),
            opacity: numericValue(ov.opacity, node.opacity),
          },
        });
      } else if (bone) {
        entries.push({
          id: toAnimationTargetId(id),
          targetType: 'bone',
          values: {
            x: numericValue(ov.x, bone.setup.x),
            y: numericValue(ov.y, bone.setup.y),
            rotation: numericValue(ov.rotation, bone.setup.rotation),
            scaleX: numericValue(ov.scaleX, bone.setup.scaleX),
            scaleY: numericValue(ov.scaleY, bone.setup.scaleY),
          },
        });
      }
    }
    if (entries.length) {
      setPoseClipboard({ entries });
      return { changed: true, sourceFrame: playbackRef.current.currentFrame };
    }
    return { changed: false };
  }, [animation, loopKeyframes, endFrame, fps, sel, targetState]);

  const pastePose = useCallback((mirror = false) => {
    if (!poseClipboard || !animation || !activeAnimationId) return { changed: false };
    const targetIds = sel.length > 0 ? sel : poseClipboard.entries.map(e => e.id);
    const keyframes = targetIds.flatMap((targetId, index) => {
      const entry = poseClipboard.entries[index] ?? poseClipboard.entries[0];
      if (!entry) return [];
      return Object.entries(entry.values).map(([property, raw]) => ({
        targetId,
        property,
        timeMs: playbackRef.current.currentTimeMs,
        value: mirror && (property === 'x' || property === 'rotation') ? -raw : raw,
        easing: 'linear',
      }));
    });
    upsertKeyframes({
      animationId: activeAnimationId,
      keyframes,
    });
    const frame = playbackRef.current.currentFrame;
    return { changed: keyframes.length > 0, sourceFrame: frame, targetFrame: frame };
  }, [poseClipboard, animation, sel, upsertKeyframes, activeAnimationId]);

  const addMarker = useCallback((labelOrEvent: unknown) => {
    if (!animation) return;
    if (typeof labelOrEvent !== 'string') return;
    const label = labelOrEvent.trim();
    if (!label) return;
    addMarkerIntent({
      animationId: animation.id,
      timeMs: playbackRef.current.currentTimeMs,
      label,
    });
  }, [animation, addMarkerIntent]);

  const deleteSelectedKeyframes = useCallback(() => {
    if (selectedKeyframes.size === 0 || !activeAnimationId) return;

    deleteKeyframes({
      animationId: activeAnimationId,
      keyframes: parseKeyframeAddressSet(selectedKeyframes),
    });
    setSelectedKeyframes(new Set());
  }, [deleteKeyframes, activeAnimationId, selectedKeyframes, setSelectedKeyframes]);

  const setEasingAt = useCallback((
    targetId: AnimationTargetId,
    propertiesOrTime: string | readonly string[] | number,
    timeOrEasing: number | AnimationEasing,
    optionalEasing?: AnimationEasing,
  ) => {
    if (!activeAnimationId) return;
    let properties: string | readonly string[] | null;
    let timeMs: number;
    let easingType: AnimationEasing;
    if (optionalEasing === undefined) {
      if (typeof timeOrEasing === 'number') return;
      properties = null;
      timeMs = typeof propertiesOrTime === 'number' ? propertiesOrTime : 0;
      easingType = timeOrEasing;
    } else {
      properties = typeof propertiesOrTime === 'number' ? null : propertiesOrTime;
      timeMs = typeof timeOrEasing === 'number' ? timeOrEasing : 0;
      easingType = optionalEasing;
    }
    const addressesAtTime = getAddressesAtTime(animation, targetId, properties, timeMs);
    const useSelection = addressesAtTime.some((address) => selectedKeyframes.has(address));
    const applyTo = useSelection ? selectedKeyframes : new Set(addressesAtTime);
    setKeyframeEasing({
      animationId: activeAnimationId,
      keyframes: parseKeyframeAddressSet(applyTo),
      easing: easingType,
    });
  }, [animation, selectedKeyframes, activeAnimationId, setKeyframeEasing]);

  const removeKeyframeAt = useCallback((
    targetId: AnimationTargetId,
    propertiesOrTime: string | readonly string[] | number,
    optionalTimeMs?: number,
  ) => {
    if (!activeAnimationId) return;
    const properties = optionalTimeMs === undefined || typeof propertiesOrTime === 'number'
      ? null
      : propertiesOrTime;
    const timeMs = optionalTimeMs
      ?? (typeof propertiesOrTime === 'number' ? propertiesOrTime : 0);
    const addressesAtTime = getAddressesAtTime(animation, targetId, properties, timeMs);
    if (addressesAtTime.some((address) => selectedKeyframes.has(address))) {
      deleteSelectedKeyframes();
    } else {
      deleteKeyframes({
        animationId: activeAnimationId,
        keyframes: parseKeyframeAddressSet(new Set(addressesAtTime)),
      });
    }
  }, [animation, selectedKeyframes, deleteSelectedKeyframes, activeAnimationId, deleteKeyframes]);

  return {
    clipboard,
    poseClipboard,
    copyKeyframe,
    pasteKeyframes,
    copyPose,
    pastePose,
    addMarker,
    deleteSelectedKeyframes,
    setEasingAt,
    removeKeyframeAt,
  };
}

export const useKeyframeActions = (...args: Parameters<typeof useKeyframeActionsImpl>): ReturnType<typeof useKeyframeActionsImpl> => useKeyframeActionsImpl(...args);
