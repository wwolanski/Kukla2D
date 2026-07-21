import { useCallback, useRef, useEffect } from 'react';

import type { CapturedFrame, PackageOptions } from '@kukla2d/adapter-phaser-atlas';
import type { Animation, ExportArtifact, ProjectDocument } from '@kukla2d/contracts';

import type { ProjectReadinessReport } from '@/domain/projectReadiness.js';

import { buildPhaserAtlasFrameIdentity } from '@/features/export/domain/phaserAtlasContract';
import { createPhaserAtlasExportPlan } from '@/features/export/domain/phaserAtlasExportPlan';
import { resolveProjectExportArea } from '@/features/export/domain/projectExportArea';
import { browserExportSink } from '@/features/export/infrastructure/browserExportSink';

import { errorMessage } from './exportApplicationTypes.js';
import { runPhaserAtlasExport } from './runPhaserAtlasExport.js';


import type { CaptureFrame, ExportProgress } from './exportApplicationTypes.js';
import type { Dispatch, RefObject, SetStateAction } from 'react';




interface PhaserAtlasExportJobOptions {
  captureRef: RefObject<CaptureFrame | null>;
  project: ProjectDocument;
  animations: Animation[];
  exportFps: number;
  outputScale: number;
  trim: boolean;
  padding: number;
  maxPageSize: number;
  loop: boolean;
  outputName: string;
  exportDest: 'zip' | 'folder';
  setProgress: Dispatch<SetStateAction<ExportProgress | null>>;
  setIsExporting: Dispatch<SetStateAction<boolean>>;
  setExportError: Dispatch<SetStateAction<string | null>>;
}

function usePhaserAtlasExportJobImpl({
  captureRef,
  project,
  animations,
  exportFps,
  outputScale,
  trim,
  padding,
  maxPageSize,
  loop,
  outputName,
  exportDest,
  setProgress,
  setIsExporting,
  setExportError,
}: PhaserAtlasExportJobOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (mountedRef.current) {
      setProgress(null);
      setIsExporting(false);
    }
  }, [setProgress, setIsExporting]);

  const run = useCallback(async (readinessReport?: ProjectReadinessReport | null): Promise<void> => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    if (!captureRef?.current) {
      setExportError('Capture reference not available');
      return;
    }

    setIsExporting(true);
    setProgress({ current: 0, total: 1, label: 'Preparing...' });

    try {
      const scale = outputScale / 100;
      const area = resolveProjectExportArea(project.canvas, { scale });

      const plan = createPhaserAtlasExportPlan({
        area,
        fps: exportFps,
        scale: outputScale,
        animations,
        trim,
        padding,
        maxPageSize,
        loop,
        outputName,
        destination: exportDest === 'folder' ? 'folder' : 'zip',
      });

      const adapterModule = await import('@kukla2d/adapter-phaser-atlas');
      const adapter = adapterModule.encodePhaserAtlasPackage;

      const wrappedAdapter = async (frames: readonly CapturedFrame[], options: PackageOptions) => {
        const adapterFrames = frames.map((f) => ({
          ...f,
          identity: f.identity ?? buildPhaserAtlasFrameIdentity(f.animName, f.animId, f.frameIndex),
        }));
        return adapter(adapterFrames, options);
      };

      const outputSink = (artifacts: readonly ExportArtifact[], opts?: { destination?: 'download' | 'folder' | 'zip'; projectName?: string }) => browserExportSink(artifacts, {
        destination: opts?.destination ?? plan.destination,
        projectName: opts?.projectName ?? plan.outputName,
      });

      const result = await runPhaserAtlasExport({
        plan,
        captureFrame: captureRef.current,
        adapter: wrappedAdapter,
        outputSink,
        readinessReport,
        onProgress: (p) => setProgress(p ? { ...p } : null),
        signal: controller.signal,
      });

      if (abortRef.current !== controller) return;

      if (!result.ok) {
        if ('cancelled' in result) {
          setProgress(null);
          setIsExporting(false);
          return;
        }
        setExportError(result.error?.message ?? 'Export failed');
        setProgress(null);
        setIsExporting(false);
        return;
      }

      setProgress(null);
      setIsExporting(false);
    } catch (err) {
      if (abortRef.current !== controller) return;
      setExportError(errorMessage(err, 'Export failed'));
      setProgress(null);
      setIsExporting(false);
    }
  }, [
    captureRef,
    project,
    animations,
    exportFps,
    outputScale,
    trim,
    padding,
    maxPageSize,
    loop,
    outputName,
    exportDest,
    setProgress,
    setIsExporting,
    setExportError,
  ]);

  return { run, cancel };
}

export const usePhaserAtlasExportJob = (...args: Parameters<typeof usePhaserAtlasExportJobImpl>): ReturnType<typeof usePhaserAtlasExportJobImpl> => usePhaserAtlasExportJobImpl(...args);
