import type { Animation, Keyframe, Node, ProjectDocument, Track } from '@kukla2d/contracts';

import { expandAnimationForExport } from '@/domain/animationExportBoomerang.js';

type SpineCurve = 'stepped' | [number, number, number, number];
interface SpineTimelineEntry { time: number; curve?: SpineCurve }
interface SpineTranslateEntry extends SpineTimelineEntry { x: number; y: number }
interface SpineRotateEntry extends SpineTimelineEntry { value: number }
interface SpineScaleEntry extends SpineTimelineEntry { x: number; y: number }
interface SpineRgbaEntry extends SpineTimelineEntry { color: string }
interface SpineBoneTimelines { translate?: SpineTranslateEntry[]; rotate?: SpineRotateEntry[]; scale?: SpineScaleEntry[] }
interface SpineSlotTimelines { rgba?: SpineRgbaEntry[] }
interface SpineAnimation { bones: Record<string, SpineBoneTimelines>; slots: Record<string, SpineSlotTimelines> }
interface SpineBone { name: string; parent?: string; x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number }
interface SpineAttachment {
  type: 'region' | 'mesh';
  name: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  vertices?: number[];
  uvs?: number[];
  triangles?: number[];
}

function numericKeyframeValue(keyframe: Keyframe): number | null {
  return typeof keyframe.value === 'number' && Number.isFinite(keyframe.value) ? keyframe.value : null;
}

/**
 * exportSpine.ts
 * 
 * Logic to export the Kukla2d project to Spine 4.0 JSON format.
 */

/**
 * Main entry point for Spine export.
 * Returns a ZIP blob containing the skeleton.json and images.
 */
export async function exportToSpine({ project, onProgress }: {
  project: ProjectDocument;
  onProgress?: (message: string) => void;
}): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  onProgress?.('Preparing skeleton data...');
  const skeletonData = buildSpineJson(project);
  zip.file('skeleton.json', JSON.stringify(skeletonData, null, 2));

  onProgress?.('Collecting textures...');
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) throw new Error('Failed to create images folder in Spine archive');
  
  for (const node of project.nodes) {
    if (node.type !== 'part') continue;
    
    const tex = project.textures.find((texture) => String(texture.id) === String(node.id))
      ?? project.textures.find((texture) => String(texture.id) === String(node.textureId));
    if (!tex || !tex.source) continue;

    try {
      const response = await fetch(tex.source);
      const blob = await response.blob();
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      const filename = `${sanitizeName(node.name)}.${ext}`;
      imagesFolder.file(filename, blob);
      onProgress?.(`Packing image: ${filename}`);
    } catch (err) {
      console.warn(`[Spine Export] Failed to fetch texture for ${node.name}:`, err);
    }
  }

  onProgress?.('Generating ZIP...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return zipBlob;
}

/**
 * Builds the Spine 4.0 JSON structure.
 *
 * Coordinate system:
 *   SS  — Y-down, origin top-left, transforms are stored in parent-local space
 *         (computeWorldMatrices gives true world canvas positions via mat[6/7])
 *   Spine — Y-up. Each bone's x/y is in the parent bone's local space (no rotation for setup pose).
 *
 * Conversion for a canvas of height H:
 *   spineWorldX = canvasWorldX
 *   spineWorldY = H - canvasWorldY
 *
 * Bone offset from parent:
 *   boneX = childSpineWorldX - parentSpineWorldX
 *   boneY = childSpineWorldY - parentSpineWorldY
 */
function buildSpineJson(project: ProjectDocument) {
  const { width: canvasW, height: canvasH } = project.canvas;
  const nodes = project.nodes;

  // ── World positions ───────────────────────────────────────────────────────
  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));

  // Spine expects bone setup coordinates (x,y) to be local to the parent bone.
  // In Kukla2d, a node's local transform places its pivot at (x + pivotX, y + pivotY)
  // within its parent's un-transformed internal coordinate space.
  // The distance from the parent's pivot to the child's pivot in this local space is simply:
  // dx = (child.x + child.pivotX) - parent.pivotX
  // dy = (child.y + child.pivotY) - parent.pivotY
  const getLocalSpineOffset = (node: Node): { x: number; y: number } => {
    const nx = (node.transform?.x ?? 0) + (node.transform?.pivotX ?? 0);
    const ny = (node.transform?.y ?? 0) + (node.transform?.pivotY ?? 0);

    // If node has no parent, it attaches to Spine's anchor 'root' at (0,0).
    // So its local offset is just its Spine world position.
    if (!node.parent) {
      return { x: nx, y: canvasH - ny };
    }

    const parentNode = nodeMap.get(node.parent);
    if (!parentNode) {
      return { x: nx, y: canvasH - ny };
    }

    const px = parentNode.transform?.pivotX ?? 0;
    const py = parentNode.transform?.pivotY ?? 0;

    return {
      x: nx - px,
      y: -(ny - py) // Flip Y for Spine's coordinate system
    };
  };


  // ── 1. Skeleton info ──────────────────────────────────────────────────────
  const skeleton = {
    spine: "4.0",
    hash: Math.random().toString(36).slice(2),
    name: "Exported Skeleton",
    width: canvasW,
    height: canvasH,
    fps: 24,
  };

  // ── 2. Bones ──────────────────────────────────────────────────────────────
  // Spine requires every file to have a bone named exactly "root" with no parent.
  const groups = nodes.filter(n => n.type === 'group');
  const bones: SpineBone[] = [{ name: 'root' }];
  const processedBones = new Set<string>(['root']);
  let remaining = [...groups];

  while (remaining.length > 0) {
    const startCount = remaining.length;
    remaining = remaining.filter(group => {
      const parentName = group.parent ? nodeNameById(nodes, group.parent) : 'root';
      if (!processedBones.has(parentName)) return true; // parent not yet processed

      const t = group.transform || {};
      const pos = getLocalSpineOffset(group);

      bones.push({
        name: sanitizeName(group.name),
        parent: parentName,
        x: pos.x,
        y: pos.y,
        rotation: -(t.rotation || 0),   // SS CW → Spine CCW
        scaleX: t.scaleX ?? 1,
        scaleY: t.scaleY ?? 1,
      });
      processedBones.add(sanitizeName(group.name));
      return false;
    });

    if (remaining.length === startCount) {
      // Cycle / missing parent — attach orphans directly to root
      remaining.forEach(g => {
        const pos = getLocalSpineOffset(g);
        bones.push({ name: sanitizeName(g.name), parent: 'root', x: pos.x, y: pos.y });
        processedBones.add(sanitizeName(g.name));
      });
      break;
    }
  }

  // ── 3. Slots ──────────────────────────────────────────────────────────────
  const parts = [...nodes]
    .filter(n => n.type === 'part')
    .sort((a, b) => (a.draw_order ?? 0) - (b.draw_order ?? 0));

  const slots = parts.map(part => ({
    name: sanitizeName(part.name),
    bone: part.parent ? nodeNameById(nodes, part.parent) : 'root',
    attachment: sanitizeName(part.name),
  }));

  // ── 4. Skins ──────────────────────────────────────────────────────────────
  // Region attachment x/y = center of the image in the parent bone's local space.
  // We get this by taking the part's world canvas position (which is the pivot
  // point — typically image center) and expressing it relative to the parent bone.
  const skinAttachments: Record<string, Record<string, SpineAttachment>> = {};

  for (const part of parts) {
    const t = part.transform || {};
    const pos = getLocalSpineOffset(part);  // pivot offset relative to parent bone's pivot

    const attachment: SpineAttachment = {
      type: "region",
      name: sanitizeName(part.name),
      x: pos.x,
      y: pos.y,
      rotation: -(t.rotation || 0),
      width: part.imageWidth ?? canvasW,
      height: part.imageHeight ?? canvasH,
    };

    if (part.mesh) {
      attachment.type = "mesh";
      attachment.vertices = part.mesh.vertices.flatMap((vertex) => [vertex.x, vertex.y]);
      attachment.uvs = Array.from(part.mesh.uvs);
      attachment.triangles = part.mesh.triangles.flatMap((triangle) => triangle);
    }

    const slotKey = sanitizeName(part.name);
    const slotAttachments = skinAttachments[slotKey] ?? (skinAttachments[slotKey] = {});
    slotAttachments[slotKey] = attachment;
  }

  const skins = [{ name: "default", attachments: skinAttachments }];

  // ── 5. Animations ─────────────────────────────────────────────────────────
  const animations: Record<string, SpineAnimation> = {};

  for (const rawAnim of project.animations) {
    const animation = expandAnimationForExport(rawAnim) as Animation;
    const animName = sanitizeName(animation.name);
    const spineAnim: SpineAnimation = { bones: {}, slots: {} };

    // Group tracks by node
    const tracksByNode: Record<string, Track[]> = {};
    for (const track of animation.tracks) {
      const nodeTracks = tracksByNode[track.targetId] ?? (tracksByNode[track.targetId] = []);
      nodeTracks.push(track);
    }

    for (const [nodeId, nodeTracks] of Object.entries(tracksByNode)) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      const targetName = sanitizeName(node.name);
      const isBone = node.type === 'group';

      if (isBone) {
        if (!spineAnim.bones[targetName]) spineAnim.bones[targetName] = {};
        const boneEntry = spineAnim.bones[targetName];

        for (const track of nodeTracks) {
          if (track.property === 'x' || track.property === 'y') {
            if (!boneEntry.translate) boneEntry.translate = [];
            for (const kf of track.keyframes) {
              const value = numericKeyframeValue(kf);
              if (value === null) continue;
              const time = kf.time / 1000;
              let entry = boneEntry.translate.find(e => Math.abs(e.time - time) < 0.001);
              if (!entry) { entry = { time, x: 0, y: 0 }; boneEntry.translate.push(entry); }
              const setup = node.transform[track.property] ?? 0;
              const delta = value - setup;
              if (track.property === 'x') entry.x = delta;
              else entry.y = -delta;
              applySpineCurve(entry, kf);
            }
          } else if (track.property === 'rotation') {
            if (!boneEntry.rotate) boneEntry.rotate = [];
            for (const kf of track.keyframes) {
              const value = numericKeyframeValue(kf);
              if (value === null) continue;
              const setup = node.transform.rotation ?? 0;
              const entry: SpineRotateEntry = { time: kf.time / 1000, value: -(value - setup) };
              applySpineCurve(entry, kf);
              boneEntry.rotate.push(entry);
            }
          } else if (track.property === 'scaleX' || track.property === 'scaleY') {
            if (!boneEntry.scale) boneEntry.scale = [];
            for (const kf of track.keyframes) {
              const value = numericKeyframeValue(kf);
              if (value === null) continue;
              const time = kf.time / 1000;
              let entry = boneEntry.scale.find(e => Math.abs(e.time - time) < 0.001);
              if (!entry) { entry = { time, x: 1, y: 1 }; boneEntry.scale.push(entry); }
              const setup = node.transform[track.property] ?? 1;
              if (track.property === 'scaleX') entry.x = value / setup;
              else entry.y = value / setup;
              applySpineCurve(entry, kf);
            }
          }
        }

        // Sort timelines
        boneEntry.translate?.sort((a, b) => a.time - b.time);
        boneEntry.rotate?.sort((a, b) => a.time - b.time);
        boneEntry.scale?.sort((a, b) => a.time - b.time);

      } else {
        // Slot animations (opacity → rgba)
        if (!spineAnim.slots[targetName]) spineAnim.slots[targetName] = {};
        const slotEntry = spineAnim.slots[targetName];

        for (const track of nodeTracks) {
          if (track.property === 'opacity') {
            if (!slotEntry.rgba) slotEntry.rgba = [];
            for (const kf of track.keyframes) {
              const value = numericKeyframeValue(kf);
              if (value === null) continue;
              const hexA = Math.round(value * 255).toString(16).padStart(2, '0');
              const entry: SpineRgbaEntry = { time: kf.time / 1000, color: `ffffff${hexA}` };
              applySpineCurve(entry, kf);
              slotEntry.rgba.push(entry);
            }
            slotEntry.rgba.sort((a, b) => a.time - b.time);
          }
        }
      }
    }

    animations[animName] = spineAnim;
  }

  return { skeleton, bones, slots, skins, animations };
}

function nodeNameById(nodes: readonly Node[], id: string): string {
  const n = nodes.find(x => x.id === id);
  return n ? sanitizeName(n.name) : 'root';
}

function sanitizeName(name: string | null | undefined): string {
  const s = (name ?? 'item')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s === 'root' ? 'rig_root' : s;
}

function applySpineCurve(entry: SpineTimelineEntry, kf: Keyframe): void {
  if (kf.easing === 'linear') return; 
  if (kf.easing === 'stepped') {
    entry.curve = 'stepped';
  } else if (Array.isArray(kf.easing) && kf.easing.length === 4) {
    entry.curve = kf.easing;
  } else if (kf.easing === 'ease-in') {
    entry.curve = [0.42, 0, 1, 1];
  } else if (kf.easing === 'ease-out') {
    entry.curve = [0, 0, 0.58, 1];
  } else {
    // Default or 'ease-both' / 'ease' -> Ease Both
    entry.curve = [0.42, 0, 0.58, 1];
  }
}
