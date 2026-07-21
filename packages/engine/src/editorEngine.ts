import type {
  Clock,
  EditorEngine as EditorEngineContract,
  EngineCommandResult,
  EngineLifecycleState,
  EvaluatedFrame,
  FrameScheduler,
  FrameSink,
  InvalidationKind,
  PlaybackInput,
  ProjectDocument,
} from '@kukla2d/contracts';

const DEFAULT_PLAYBACK: PlaybackInput = { playing: false, currentTime: 0, loop: true, speed: 1 };

export class EditorEngine implements EditorEngineContract {
  state: EngineLifecycleState = 'idle';
  private project: ProjectDocument | null = null;
  private revision = -1;
  private playback: PlaybackInput = DEFAULT_PLAYBACK;
  private frameRequestId: unknown = null;
  private sink: FrameSink | null = null;
  private clock: Clock | null = null;

  constructor(
    private readonly scheduler: FrameScheduler = timeoutScheduler,
    private readonly measurementClock: Clock = { now: () => Date.now() },
  ) {}

  setProject(project: ProjectDocument, revision: number): EngineCommandResult {
    if (this.state === 'disposed') return { ok: false, state: 'disposed' };
    if (!Number.isInteger(revision) || revision < this.revision) {
      return { ok: false, state: 'stale-revision', currentRevision: this.revision };
    }
    this.project = project;
    this.revision = revision;
    return { ok: true, state: this.activeState() };
  }

  setPlayback(input: PlaybackInput): EngineCommandResult {
    if (this.state === 'disposed') return { ok: false, state: 'disposed' };
    this.playback = { ...input };
    return { ok: true, state: this.activeState() };
  }

  evaluate(time: number): EvaluatedFrame {
    void time;
    if (!this.project || this.state === 'disposed') return emptyFrame();
    const start = this.measurementClock.now();
    const drawList = this.project.nodes.filter(node => node.visible).map(node => ({
      id: node.id,
      type: node.type === 'part' && node.mesh ? 'mesh' as const : 'quad' as const,
      vertices: new Float32Array(0),
      uvs: new Float32Array(0),
      indices: new Uint16Array(0),
      transform: affineTransform(node.transform),
      opacity: node.opacity,
      visible: node.visible,
      blendMode: 'normal',
      ...(node.type === 'part' && node.textureId ? { textureId: node.textureId } : {}),
    }));
    return {
      drawList,
      diagnostics: {
        evaluateMs: Math.max(0, this.measurementClock.now() - start),
        drawItemCount: drawList.length,
        visibleCount: drawList.length,
      },
    };
  }

  start(clock: Clock, sink: FrameSink): EngineCommandResult {
    if (this.state === 'disposed') return { ok: false, state: 'disposed' };
    this.stopFrameLoop();
    this.clock = clock;
    this.sink = sink;
    this.state = 'running';
    this.frameRequestId = this.scheduler.request(this.tick);
    return { ok: true, state: 'running' };
  }

  stop(): EngineCommandResult {
    if (this.state === 'disposed') return { ok: false, state: 'disposed' };
    this.stopFrameLoop();
    this.state = 'stopped';
    return { ok: true, state: 'stopped' };
  }

  invalidate(kind: InvalidationKind): EngineCommandResult {
    void kind;
    if (this.state === 'disposed') return { ok: false, state: 'disposed' };
    return { ok: true, state: this.activeState() };
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.stopFrameLoop();
    this.project = null;
    this.sink = null;
    this.clock = null;
    this.state = 'disposed';
  }

  private readonly tick = (): void => {
    if (this.state !== 'running' || !this.clock || !this.sink) return;
    if (this.playback.playing) this.sink.frame(this.evaluate(this.clock.now()));
    this.frameRequestId = this.scheduler.request(this.tick);
  };

  private stopFrameLoop(): void {
    if (this.frameRequestId !== null) this.scheduler.cancel(this.frameRequestId);
    this.frameRequestId = null;
  }

  private activeState(): 'idle' | 'running' | 'stopped' {
    return this.state === 'disposed' ? 'stopped' : this.state;
  }
}

const timeoutScheduler = createTimeoutScheduler();

function createTimeoutScheduler(): FrameScheduler {
  const handles = new Map<number, ReturnType<typeof globalThis.setTimeout>>();
  let nextId = 1;
  return {
    request(callback) {
      const id = nextId;
      nextId += 1;
      handles.set(id, globalThis.setTimeout(() => {
        handles.delete(id);
        callback();
      }, 16));
      return id;
    },
    cancel(requestId) {
      if (typeof requestId !== 'number') return;
      const handle = handles.get(requestId);
      if (handle === undefined) return;
      globalThis.clearTimeout(handle);
      handles.delete(requestId);
    },
  };
}

function affineTransform(transform: ProjectDocument['nodes'][number]['transform']): Float32Array {
  const radians = transform.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return new Float32Array([
    transform.scaleX * cosine, transform.scaleX * sine, 0,
    -transform.scaleY * sine, transform.scaleY * cosine, 0,
    transform.x, transform.y, 1,
  ]);
}

function emptyFrame(): EvaluatedFrame {
  return { drawList: [], diagnostics: { evaluateMs: 0, drawItemCount: 0, visibleCount: 0 } };
}
