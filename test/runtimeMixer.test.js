import { describe, it, expect } from 'vitest';
import { evaluateLayers } from '../src/runtime/animationMixer.js';
import { evaluateTransitions, validateStateMachine } from '../src/runtime/stateMachine.js';
import { Kukla2dRuntime } from '../src/runtime/runtimeApi.js';

describe('animationMixer', () => {
  it('returns empty overrides for no layers', () => {
    const result = evaluateLayers([], [], 0.016);
    expect(result.overrides.size).toBe(0);
  });

  it('evaluates a single override layer', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 1000, value: 10, easing: 'linear' }] }],
    }];
    const result = evaluateLayers(layers, clips, 0.5);
    expect(result.overrides.has('n1')).toBe(true);
    expect(result.overrides.get('n1').x).toBeCloseTo(5, 1);
  });

  it('applies weight to override layer', () => {
    const layers = [{
      order: 0, weight: 0.5, mode: 'override', clipId: 'c1', time: 0, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [{ targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }, { time: 1000, value: 10, easing: 'linear' }] }],
    }];
    const result = evaluateLayers(layers, clips, 1);
    expect(result.overrides.get('n1').x).toBeCloseTo(5, 1);
  });

  it('collects events', () => {
    const layers = [{
      order: 0, weight: 1, mode: 'override', clipId: 'c1', time: 0.4, timeScale: 1, loop: false,
    }];
    const clips = [{
      id: 'c1', duration: 1000, fps: 24,
      tracks: [
        { targetId: 'n1', property: 'x', keyframes: [{ time: 0, value: 0, easing: 'linear' }] },
        { targetId: 'n1', property: 'event', keyframes: [{ time: 500, value: { eventId: 'hit' }, easing: 'step' }] },
      ],
    }];
    const result = evaluateLayers(layers, clips, 0.2);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventId).toBe('hit');
  });
});

describe('stateMachine', () => {
  it('transitions on exit time', () => {
    const states = [{ id: 'idle', name: 'Idle', clipId: 'c1', loop: true }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'run', duration: 0.3,
      condition: 'exitTime', exitTime: 0.8,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', {}, 0.9, 1.0);
    expect(result.newStateId).toBe('run');
    expect(result.crossfadeDuration).toBe(0.3);
  });

  it('transitions on parameter greater', () => {
    const states = [{ id: 'idle', name: 'Idle', clipId: 'c1', loop: true }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'run', duration: 0,
      condition: 'parameter', paramName: 'speed', comparison: 'greater', threshold: 0.5,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', { speed: 0.8 }, 0.1, 1.0);
    expect(result.newStateId).toBe('run');
  });

  it('does not transition when condition not met', () => {
    const states = [{ id: 'idle', name: 'Idle', clipId: 'c1', loop: true }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'run', duration: 0,
      condition: 'parameter', paramName: 'speed', comparison: 'greater', threshold: 0.5,
    }];
    const result = evaluateTransitions(states, transitions, 'idle', { speed: 0.3 }, 0.1, 1.0);
    expect(result.newStateId).toBeNull();
  });

  it('validates state machine', () => {
    const states = [{ id: 'idle' }, { id: 'run' }];
    const transitions = [{
      id: 't1', fromStateId: 'idle', toStateId: 'run',
    }, {
      id: 't2', fromStateId: 'run', toStateId: 'missing',
    }];
    const { valid, errors } = validateStateMachine(states, transitions);
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('runtimeApi', () => {
  it('creates and disposes instances', () => {
    const runtime = new Kukla2dRuntime({ animations: [], bones: [], nodes: [] });
    runtime.createInstance('i1');
    expect(runtime.instances.has('i1')).toBe(true);
    runtime.disposeInstance('i1');
    expect(runtime.instances.has('i1')).toBe(false);
  });

  it('updates instance and returns pose', () => {
    const runtime = new Kukla2dRuntime({
      animations: [], bones: [{ id: 'b1', parentId: null, setup: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, length: 0 } }],
      nodes: [],
    });
    runtime.createInstance('i1');
    const result = runtime.update('i1', 0.016);
    expect(result).not.toBeNull();
    expect(result.pose.boneMatrices.has('b1')).toBe(true);
  });

  it('delivers evaluated events to subscribers and removes only unsubscribed subscriber', () => {
    const runtime = new Kukla2dRuntime({
      animations: [{
        id: 'c1', duration: 1000, fps: 24,
        tracks: [{ targetId: 'n1', property: 'event', keyframes: [{ time: 500, value: { eventId: 'hit' }, easing: 'step' }] }],
      }],
      bones: [],
      nodes: [],
    });
    runtime.createInstance('i1');
    runtime.play('i1', 'c1', { loop: false });
    const first = [];
    const second = [];
    const unsubscribeFirst = runtime.subscribeEvent(event => first.push(event));
    runtime.subscribeEvent(event => second.push(event));

    runtime.update('i1', 0.6);
    unsubscribeFirst();
    runtime.play('i1', 'c1', { loop: false });
    runtime.update('i1', 0.6);

    expect(first.map(event => event.eventId)).toEqual(['hit']);
    expect(second.map(event => event.eventId)).toEqual(['hit', 'hit']);
  });
});
