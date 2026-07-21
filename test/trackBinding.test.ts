import { describe, it, expect } from 'vitest';
import { createTrackBinding, validateKeyframeValue, isDiscreteType, deduplicateKeyframes, VALUE_TYPES } from '../src/schema/trackBinding';
import { checkEventCrossing } from '../src/schema/eventSchema';
import { evaluateDrawOrder } from '../src/runtime/drawOrder.js';

import type { BoneId, Slot, SlotId } from '@kukla2d/contracts';

type DrawOrderSlot = Pick<Slot, 'id' | 'drawOrder' | 'name' | 'boneId'>;

describe('trackBinding', () => {
  it('creates a track binding', () => {
    const binding = createTrackBinding('bone', 'b1', 'rotation', VALUE_TYPES.ANGLE);
    expect(binding.targetType).toBe('bone');
    expect(binding.targetId).toBe('b1');
    expect(binding.property).toBe('rotation');
    expect(binding.valueType).toBe('angle');
  });

  it('validates scalar values', () => {
    expect(validateKeyframeValue(5, VALUE_TYPES.SCALAR)).toBe(true);
    expect(validateKeyframeValue(NaN, VALUE_TYPES.SCALAR)).toBe(false);
  });

  it('validates boolean values', () => {
    expect(validateKeyframeValue(true, VALUE_TYPES.BOOLEAN)).toBe(true);
    expect(validateKeyframeValue('yes', VALUE_TYPES.BOOLEAN)).toBe(false);
  });

  it('validates vertex array values', () => {
    expect(validateKeyframeValue([{ x: 0, y: 0 }], VALUE_TYPES.VERTEX_ARRAY)).toBe(true);
    expect(validateKeyframeValue([1, 2], VALUE_TYPES.VERTEX_ARRAY)).toBe(false);
  });

  it('identifies discrete types', () => {
    expect(isDiscreteType(VALUE_TYPES.BOOLEAN)).toBe(true);
    expect(isDiscreteType(VALUE_TYPES.ATTACHMENT_REF)).toBe(true);
    expect(isDiscreteType(VALUE_TYPES.EVENT)).toBe(true);
    expect(isDiscreteType(VALUE_TYPES.SCALAR)).toBe(false);
  });

  it('deduplicates keyframes at same time', () => {
    const kfs = [
      { time: 100, value: 1 },
      { time: 100, value: 2 },
      { time: 200, value: 3 },
    ];
    const result = deduplicateKeyframes(kfs);
    expect(result).toHaveLength(2);
    expect(result[0]!.value).toBe(2);
  });

  it('sorts keyframes by time', () => {
    const kfs = [{ time: 300, value: 3 }, { time: 100, value: 1 }];
    const result = deduplicateKeyframes(kfs);
    expect(result[0]!.time).toBe(100);
    expect(result[1]!.time).toBe(300);
  });
});

describe('eventSchema', () => {
  it('detects forward event crossing', () => {
    const kfs = [{ time: 500, value: { eventId: 'e1' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(400, 600, kfs);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]!.eventId).toBe('e1');
  });

  it('does not cross event when time stays before', () => {
    const kfs = [{ time: 500, value: { eventId: 'e1' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(300, 400, kfs);
    expect(crossed).toHaveLength(0);
  });

  it('detects backward event crossing', () => {
    const kfs = [{ time: 500, value: { eventId: 'e1' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(600, 400, kfs);
    expect(crossed).toHaveLength(1);
  });

  it('handles loop boundary crossing', () => {
    const kfs = [{ time: 0, value: { eventId: 'loop' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(1900, 100, kfs);
    expect(crossed).toHaveLength(1);
  });

  it('detects event exactly at time 0', () => {
    const kfs = [{ time: 0, value: { eventId: 'start' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(-100, 0, kfs);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]!.eventId).toBe('start');
  });

  it('does not double-fire when prevTime equals event time', () => {
    const kfs = [{ time: 500, value: { eventId: 'e1' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(500, 600, kfs);
    expect(crossed).toHaveLength(0);
  });

  it('fires when currentTime reaches event time (forward crossing)', () => {
    const kfs = [{ time: 500, value: { eventId: 'e1' }, easing: 'step' as const }];
    const crossed = checkEventCrossing(400, 500, kfs);
    expect(crossed).toHaveLength(1);
    expect(crossed[0]!.eventId).toBe('e1');
  });
});

describe('drawOrder', () => {
  it('sorts slots by draw order', () => {
    const slots: DrawOrderSlot[] = [
      { id: 's1' as SlotId, name: 'Slot 1', boneId: 'b1' as BoneId, drawOrder: 2 },
      { id: 's2' as SlotId, name: 'Slot 2', boneId: 'b1' as BoneId, drawOrder: 0 },
      { id: 's3' as SlotId, name: 'Slot 3', boneId: 'b1' as BoneId, drawOrder: 1 },
    ];
    const result = evaluateDrawOrder(slots);
    expect(result).toEqual(['s2', 's3', 's1']);
  });

  it('applies overrides', () => {
    const slots: DrawOrderSlot[] = [
      { id: 's1' as SlotId, name: 'Slot 1', boneId: 'b1' as BoneId, drawOrder: 0 },
      { id: 's2' as SlotId, name: 'Slot 2', boneId: 'b1' as BoneId, drawOrder: 1 },
    ];
    const overrides = new Map([['s1', { drawOrder: 5 }]]);
    const result = evaluateDrawOrder(slots, overrides);
    expect(result[0]).toBe('s2');
    expect(result[1]).toBe('s1');
  });

  it('stable sort by id when draw orders are equal', () => {
    const slots: DrawOrderSlot[] = [
      { id: 's2' as SlotId, name: 'Slot 2', boneId: 'b1' as BoneId, drawOrder: 0 },
      { id: 's1' as SlotId, name: 'Slot 1', boneId: 'b1' as BoneId, drawOrder: 0 },
    ];
    const result = evaluateDrawOrder(slots);
    expect(result[0]).toBe('s1');
    expect(result[1]).toBe('s2');
  });
});
