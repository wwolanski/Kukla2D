import { describe, it, expect } from 'vitest';
import {
  ACTION_IDS,
  REASON_CODES,
  editorModePolicy,
} from '../src/domain/editorModePolicy.js';
import {
  getFeedback,
  getAllReasonCodes,
} from '../src/domain/editorModeFeedback.js';

// ── Action ID catalog completeness ────────────────────────────────────────────

describe('ACTION_IDS', () => {
  it('exports stable string IDs', () => {
    expect(ACTION_IDS.NODE_MOVE).toBe('node.move');
    expect(ACTION_IDS.BONE_CREATE).toBe('bone.create');
    expect(ACTION_IDS.MODE_SWITCH).toBe('mode.switch');
    expect(ACTION_IDS.SELECTION).toBe('selection');
  });

  it('has at least 30 action IDs', () => {
    expect(Object.keys(ACTION_IDS).length).toBeGreaterThanOrEqual(30);
  });
});

describe('REASON_CODES', () => {
  it('exports all required codes', () => {
    expect(REASON_CODES.ACTIVE_CLIP_REQUIRED).toBe('ACTIVE_CLIP_REQUIRED');
    expect(REASON_CODES.ANIMATION_CHANNEL_UNSUPPORTED).toBe('ANIMATION_CHANNEL_UNSUPPORTED');
    expect(REASON_CODES.STAGING_ONLY_STRUCTURE).toBe('STAGING_ONLY_STRUCTURE');
    expect(REASON_CODES.STAGING_ONLY_BONE_LENGTH).toBe('STAGING_ONLY_BONE_LENGTH');
    expect(REASON_CODES.STAGING_ONLY_PIVOT).toBe('STAGING_ONLY_PIVOT');
    expect(REASON_CODES.DIRTY_DRAFT).toBe('DIRTY_DRAFT');
    expect(REASON_CODES.POSE_MUST_BE_RESOLVED).toBe('POSE_MUST_BE_RESOLVED');
  });
});

// ── Staging mode — all table entries allowed ──────────────────────────────────

describe('editorModePolicy — staging', () => {
  const stagingAllowed = [
    [ACTION_IDS.NODE_MOVE, 'node'],
    [ACTION_IDS.NODE_ROTATE, 'node'],
    [ACTION_IDS.NODE_SCALE, 'node'],
    [ACTION_IDS.NODE_OPACITY, 'node'],
    [ACTION_IDS.NODE_VISIBLE, 'node'],
    [ACTION_IDS.NODE_DRAW_ORDER, 'node'],
    [ACTION_IDS.NODE_MESH_DEFORM, 'node'],
    [ACTION_IDS.NODE_BLEND_SHAPE, 'node'],
    [ACTION_IDS.BONE_MOVE, 'bone'],
    [ACTION_IDS.BONE_ROTATE, 'bone'],
    [ACTION_IDS.BONE_SCALE, 'bone'],
    [ACTION_IDS.BONE_LENGTH, 'bone'],
    [ACTION_IDS.BONE_PIVOT, 'bone'],
    [ACTION_IDS.CONSTRAINT_EDIT, 'constraint'],
    [ACTION_IDS.BONE_CREATE, 'bone'],
    [ACTION_IDS.BONE_DELETE, 'bone'],
    [ACTION_IDS.BONE_REPARENT, 'bone'],
    [ACTION_IDS.BONE_RENAME, 'bone'],
    [ACTION_IDS.IK_CREATE, 'bone'],
    [ACTION_IDS.IK_ASSIGN, 'bone'],
    [ACTION_IDS.REMESH, 'node'],
    [ACTION_IDS.WEIGHTS_EDIT, 'bone'],
    [ACTION_IDS.LINK_TOGGLE, 'node'],
    [ACTION_IDS.BIND_TOGGLE, 'node'],
    [ACTION_IDS.SLOT_CREATE, 'slot'],
    [ACTION_IDS.SLOT_DELETE, 'slot'],
    [ACTION_IDS.HIERARCHY_REORDER, 'bone'],
    [ACTION_IDS.RENAME, 'node'],
    [ACTION_IDS.LIBRARY_ORGANIZE, 'node'],
    [ACTION_IDS.SELECTION, 'node'],
    [ACTION_IDS.ZOOM, 'node'],
    [ACTION_IDS.PAN, 'node'],
    [ACTION_IDS.PLAYBACK, 'node'],
  ];

  it.each(stagingAllowed)('allows %s in staging (targetKind=%s)', (actionId, targetKind) => {
    const decision = editorModePolicy({
      mode: 'staging',
      actionId,
      targetKind,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.mode).toBe('staging');
    expect(decision.actionId).toBe(actionId);
  });

  it('allows mode switch in staging', () => {
    const decision = editorModePolicy({
      mode: 'staging',
      actionId: ACTION_IDS.MODE_SWITCH,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.channel).toBe('setup-structure');
  });
});

// ── Animation mode — allowed actions ──────────────────────────────────────────

describe('editorModePolicy — animation allowed', () => {
  const animAllowed = [
    [ACTION_IDS.NODE_MOVE, 'node'],
    [ACTION_IDS.NODE_ROTATE, 'node'],
    [ACTION_IDS.NODE_SCALE, 'node'],
    [ACTION_IDS.NODE_OPACITY, 'node'],
    [ACTION_IDS.NODE_VISIBLE, 'node'],
    [ACTION_IDS.NODE_DRAW_ORDER, 'node'],
    [ACTION_IDS.NODE_MESH_DEFORM, 'node'],
    [ACTION_IDS.NODE_BLEND_SHAPE, 'node'],
    [ACTION_IDS.BONE_MOVE, 'bone'],
    [ACTION_IDS.BONE_ROTATE, 'bone'],
    [ACTION_IDS.BONE_SCALE, 'bone'],
    [ACTION_IDS.CONSTRAINT_EDIT, 'constraint'],
    [ACTION_IDS.BONE_RENAME, 'bone'],
    [ACTION_IDS.RENAME, 'node'],
    [ACTION_IDS.LIBRARY_ORGANIZE, 'node'],
  ];

  it.each(animAllowed)('allows %s in animation (targetKind=%s)', (actionId, targetKind) => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId,
      targetKind,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.mode).toBe('animation');
    expect(decision.channel).toBe('animation-channel');
  });
});

// ── Animation mode — navigation always allowed ────────────────────────────────

describe('editorModePolicy — animation navigation', () => {
  const navActions = [
    ACTION_IDS.SELECTION,
    ACTION_IDS.ZOOM,
    ACTION_IDS.PAN,
    ACTION_IDS.PLAYBACK,
  ];

  it.each(navActions)('allows %s as navigation in animation', (actionId) => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.channel).toBe('navigation');
  });
});

// ── Animation mode — blocked actions ──────────────────────────────────────────

describe('editorModePolicy — animation blocked', () => {
  const animBlocked = [
    [ACTION_IDS.BONE_LENGTH, REASON_CODES.STAGING_ONLY_BONE_LENGTH],
    [ACTION_IDS.BONE_PIVOT, REASON_CODES.STAGING_ONLY_PIVOT],
    [ACTION_IDS.BONE_CREATE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.BONE_DELETE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.BONE_REPARENT, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.IK_CREATE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.IK_ASSIGN, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.REMESH, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.WEIGHTS_EDIT, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.LINK_TOGGLE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.BIND_TOGGLE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.SLOT_CREATE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.SLOT_DELETE, REASON_CODES.STAGING_ONLY_STRUCTURE],
    [ACTION_IDS.HIERARCHY_REORDER, REASON_CODES.STAGING_ONLY_STRUCTURE],
  ];

  it.each(animBlocked)('blocks %s in animation with reason %s', (actionId, expectedReason) => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.channel).toBe('blocked');
    expect(decision.reasonCode).toBe(expectedReason);
  });
});

// ── Mode switch with dirty draft ──────────────────────────────────────────────

describe('editorModePolicy — dirty draft', () => {
  it('blocks mode switch when draft is dirty', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.MODE_SWITCH,
      draftDirty: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON_CODES.DIRTY_DRAFT);
  });

  it('allows mode switch when draft is clean', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.MODE_SWITCH,
      draftDirty: false,
    });
    expect(decision.allowed).toBe(true);
  });
});

// ── Property validation (K4 delegation) ───────────────────────────────────────

describe('editorModePolicy — property validation', () => {
  it('allows bone scaleX in animation', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.BONE_SCALE,
      targetKind: 'bone',
      property: 'scaleX',
    });
    expect(decision.allowed).toBe(true);
  });

  it('allows node opacity in animation', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.NODE_OPACITY,
      targetKind: 'node',
      property: 'opacity',
    });
    expect(decision.allowed).toBe(true);
  });

  it('blocks bone length via property check (action blocked by table first)', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.BONE_LENGTH,
      targetKind: 'bone',
      property: 'length',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON_CODES.STAGING_ONLY_BONE_LENGTH);
  });
});

// ── Unknown inputs ────────────────────────────────────────────────────────────

describe('editorModePolicy — unknown inputs', () => {
  it('rejects unknown mode', () => {
    const decision = editorModePolicy({
      mode: 'preview',
      actionId: ACTION_IDS.NODE_MOVE,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON_CODES.UNKNOWN_ACTION);
  });

  it('rejects unknown action', () => {
    const decision = editorModePolicy({
      mode: 'staging',
      actionId: 'foo.bar',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON_CODES.UNKNOWN_ACTION);
  });
});

// ── Decision DTO shape ────────────────────────────────────────────────────────

describe('editorModePolicy — DTO shape', () => {
  it('returns required fields for allowed decision', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.NODE_MOVE,
      targetKind: 'node',
    });
    expect(decision).toHaveProperty('allowed', true);
    expect(decision).toHaveProperty('mode', 'animation');
    expect(decision).toHaveProperty('actionId', ACTION_IDS.NODE_MOVE);
    expect(decision).toHaveProperty('channel', 'animation-channel');
  });

  it('returns required fields for blocked decision', () => {
    const decision = editorModePolicy({
      mode: 'animation',
      actionId: ACTION_IDS.BONE_CREATE,
    });
    expect(decision).toHaveProperty('allowed', false);
    expect(decision).toHaveProperty('mode', 'animation');
    expect(decision).toHaveProperty('actionId', ACTION_IDS.BONE_CREATE);
    expect(decision).toHaveProperty('channel', 'blocked');
    expect(decision).toHaveProperty('reasonCode');
    expect(typeof decision.reasonCode).toBe('string');
  });
});

// ── Feedback catalog ──────────────────────────────────────────────────────────

describe('editorModeFeedback', () => {
  it('returns feedback for every registered reason code', () => {
    const codes = getAllReasonCodes();
    expect(codes.length).toBeGreaterThanOrEqual(7);
    for (const code of codes) {
      const fb = getFeedback(code);
      expect(fb.message).toBeTruthy();
      expect(fb.tooltip).toBeTruthy();
      expect(fb.suggestedAction).toBeTruthy();
    }
  });

  it('returns fallback for unknown reason code', () => {
    const fb = getFeedback('NONEXISTENT_CODE');
    expect(fb.message).toBeTruthy();
    expect(fb.tooltip).toBeTruthy();
    expect(fb.suggestedAction).toBeTruthy();
  });

  it('has consistent coverage: every blocked reason code has feedback', () => {
    const blockedReasons = Object.values(REASON_CODES);
    for (const code of blockedReasons) {
      const fb = getFeedback(code);
      expect(fb.message).toBeTruthy();
      expect(fb.tooltip).toBeTruthy();
      expect(fb.suggestedAction).toBeTruthy();
    }
  });
});

// ── Cross-check: every decision blocked reason has feedback ───────────────────

describe('editorModePolicy + feedback cross-check', () => {
  it('every blocked decision reason code has a feedback entry', () => {
    const allActions = Object.values(ACTION_IDS);
    for (const actionId of allActions) {
      const decision = editorModePolicy({
        mode: 'animation',
        actionId,
      });
      if (!decision.allowed && decision.reasonCode) {
        const fb = getFeedback(decision.reasonCode);
        expect(fb.message).toBeTruthy();
        expect(fb.suggestedAction).toBeTruthy();
      }
    }
  });
});
