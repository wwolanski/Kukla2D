// @vitest-environment jsdom
/* eslint-disable react/prop-types */

import { useEffect } from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkflowActor } from '@/features/canvas/application/useWorkflowActor.js';
import { EditorWorkflowContext } from '@/features/canvas/application/EditorWorkflowContext.js';
import { useEditorStore } from '@/store/editorStore';

describe('useWorkflowActor', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    try {
      act(() => {
        root.unmount();
      });
    } catch {
      // root may already be unmounted by the test
    }
    container.remove();
  });

  it('shares one workflow actor across hook callers within one Provider', () => {
    const refs = [];

    function Probe({ onReady }) {
      const workflow = useWorkflowActor();
      useEffect(() => {
        onReady(workflow);
      }, [onReady, workflow]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(workflow) => refs.push(workflow)} />
          <Probe onReady={(workflow) => refs.push(workflow)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    expect(refs).toHaveLength(2);
    expect(refs[0].actorRef).toBe(refs[1].actorRef);

    refs[0].send({ type: 'START_GIZMO_MOVE', payload: { nodeId: 'n1' } });
    expect(refs[1].selectSession()?.kind).toBe('gizmoMove');

    refs[1].send({ type: 'COMMIT_GESTURE' });
    expect(refs[0].getState()).toBe('idle');
  });

  it('two Provider instances are isolated', () => {
    const refsA = [];
    const refsB = [];

    function Probe({ onReady }) {
      const workflow = useWorkflowActor();
      useEffect(() => {
        onReady(workflow);
      }, [onReady, workflow]);
      return null;
    }

    act(() => {
      root.render(
        <>
          <EditorWorkflowContext.Provider>
            <Probe onReady={(workflow) => refsA.push(workflow)} />
          </EditorWorkflowContext.Provider>
          <EditorWorkflowContext.Provider>
            <Probe onReady={(workflow) => refsB.push(workflow)} />
          </EditorWorkflowContext.Provider>
        </>,
      );
    });

    expect(refsA).toHaveLength(1);
    expect(refsB).toHaveLength(1);
    expect(refsA[0].actorRef).not.toBe(refsB[0].actorRef);

    refsA[0].send({ type: 'SET_TOOL', tool: 'transform' });
    expect(refsA[0].actorRef.getSnapshot().context.activeTool).toBe('transform');
    expect(refsB[0].actorRef.getSnapshot().context.activeTool).toBe('select');
  });

  it('direct actorRef.send executes configured command effect exactly once', () => {
    let actorRef;
    function Probe() {
      actorRef = EditorWorkflowContext.useActorRef();
      return null;
    }

    useEditorStore.setState({ showSkeleton: false });
    let writes = 0;
    const unsubscribe = useEditorStore.subscribe(() => { writes += 1; });
    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe />
        </EditorWorkflowContext.Provider>,
      );
    });

    act(() => actorRef.send({ type: 'SET_TOOL', tool: 'drawBone' }));
    unsubscribe();
    expect(useEditorStore.getState().showSkeleton).toBe(true);
    expect(writes).toBe(1);
  });

  it('transform→pose→transform restores lastNonRigSelectionTarget (A7)', () => {
    const refs = [];

    function Probe({ onReady }) {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { onReady(actorRef); }, [onReady, actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(actorRef) => refs.push(actorRef)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    const actor = refs[0];

    // Start: select tool, target 'all'
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBe('all');

    // switch to transform → stays 'all' (not coming from rig)
    act(() => actor.send({ type: 'SET_TOOL', tool: 'transform' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');

    // switch to pose → rig, snapshot 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'pose' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBe('all');

    // switch back to transform → restores 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'transform' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');

    // switch to pose → rig again, snapshot still 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'pose' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');

    // switch to select → restores 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'select' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
  });

  it('select→pose→select restores lastNonRigSelectionTarget', () => {
    const refs = [];

    function Probe({ onReady }) {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { onReady(actorRef); }, [onReady, actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(actorRef) => refs.push(actorRef)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    const actor = refs[0];

    // select with target 'element' → switch to pose → back to select
    act(() => actor.send({ type: 'SET_SELECTION_TARGET', target: 'element' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('element');

    act(() => actor.send({ type: 'SET_TOOL', tool: 'pose' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBe('element');

    act(() => actor.send({ type: 'SET_TOOL', tool: 'select' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('element');
  });

  it('consecutive rig-forcing tools do not overwrite lastNonRigSelectionTarget', () => {
    const refs = [];

    function Probe({ onReady }) {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { onReady(actorRef); }, [onReady, actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(actorRef) => refs.push(actorRef)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    const actor = refs[0];

    // Start: 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'pose' }));
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBe('all');

    // drawBone while still in rig → lastNonRigSelectionTarget should NOT be overwritten
    act(() => actor.send({ type: 'SET_TOOL', tool: 'drawBone' }));
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBe('all');

    // back to transform → restores 'all'
    act(() => actor.send({ type: 'SET_TOOL', tool: 'transform' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
  });

  it('SET_SELECTION_TARGET explicit rig does not revert on tool switch', () => {
    const refs = [];

    function Probe({ onReady }) {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { onReady(actorRef); }, [onReady, actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(actorRef) => refs.push(actorRef)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    const actor = refs[0];

    act(() => actor.send({ type: 'SET_SELECTION_TARGET', target: 'rig' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');

    act(() => actor.send({ type: 'SET_TOOL', tool: 'transform' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');
    expect(actor.getSnapshot().context.lastNonRigSelectionTarget).toBeNull();
  });

  it('cycleSelectionTarget still cycles all→element→rig→all for select tool', () => {
    const refs = [];

    function Probe({ onReady }) {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { onReady(actorRef); }, [onReady, actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe onReady={(actorRef) => refs.push(actorRef)} />
        </EditorWorkflowContext.Provider>,
      );
    });

    const actor = refs[0];

    act(() => actor.send({ type: 'SET_TOOL', tool: 'select' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');

    act(() => actor.send({ type: 'CYCLE_SELECTION_TARGET' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('element');

    act(() => actor.send({ type: 'CYCLE_SELECTION_TARGET' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('rig');

    act(() => actor.send({ type: 'CYCLE_SELECTION_TARGET' }));
    expect(actor.getSnapshot().context.selectionTarget).toBe('all');
  });

  it('Provider unmount creates a fresh actor on re-mount', () => {
    const refs = [];

    function Probe() {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { refs.push(actorRef); }, [actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe />
        </EditorWorkflowContext.Provider>,
      );
    });

    const firstRef = refs[0];
    expect(firstRef).toBeDefined();

    act(() => { root.unmount(); });
    useEditorStore.setState({ showSkeleton: false });
    firstRef.send({ type: 'SET_TOOL', tool: 'drawBone' });
    expect(useEditorStore.getState().showSkeleton).toBe(false);
    container.remove();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const refs2 = [];
    function Probe2() {
      const { actorRef } = useWorkflowActor();
      useEffect(() => { refs2.push(actorRef); }, [actorRef]);
      return null;
    }

    act(() => {
      root.render(
        <EditorWorkflowContext.Provider>
          <Probe2 />
        </EditorWorkflowContext.Provider>,
      );
    });

    expect(refs2[0]).toBeDefined();
    expect(refs2[0]).not.toBe(firstRef);
    expect(refs2[0].getSnapshot().value).toBe('idle');
  });
});
