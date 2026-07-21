export interface BakeReportEntry {
  classification: 'baked' | 'dropped' | 'blocked' | 'warning';
  code: string;
  path: string;
  message: string;
}

export interface BakeReport {
  format: 'phaser-atlas-baked';
  version: '1';
  options: {
    fps: number;
    scale: number;
    trim: boolean;
    padding: number;
    maxPageSize: number;
    loop: boolean;
    repeat: number;
    destination: string;
  };
  summary: {
    pages: number;
    totalFrames: number;
    totalAnimations: number;
    totalMarkers: number;
  };
  issues: BakeReportEntry[];
}

export interface BakeReportInput {
  fps: number;
  scale: number;
  trim: boolean;
  padding: number;
  maxPageSize: number;
  loop: boolean;
  repeat: number;
  destination: string;
  pageCount: number;
  totalFrames: number;
  animationCount: number;
  markerCount: number;
  issues?: BakeReportEntry[];
}

export function buildExportReport(input: BakeReportInput): BakeReport {
  return {
    format: 'phaser-atlas-baked',
    version: '1',
    options: {
      fps: input.fps,
      scale: input.scale,
      trim: input.trim,
      padding: input.padding,
      maxPageSize: input.maxPageSize,
      loop: input.loop,
      repeat: input.repeat,
      destination: input.destination,
    },
    summary: {
      pages: input.pageCount,
      totalFrames: input.totalFrames,
      totalAnimations: input.animationCount,
      totalMarkers: input.markerCount,
    },
    issues: input.issues ?? [],
  };
}

export interface ExampleInput {
  textureKey: string;
  atlasFileNames: string[];
  atlasJsonFileName: string;
  animationsJsonFileName: string;
  animationKeys: string[];
  isMulti: boolean;
  rootFolder: string;
}

export function buildExampleTs(input: ExampleInput): string {
  const { textureKey, atlasFileNames, atlasJsonFileName, animationsJsonFileName, animationKeys, isMulti, rootFolder } = input;
  const loadFn = isMulti ? 'multiatlas' : 'atlas';
  const atlasArgs = isMulti
    ? `'${textureKey}', '${rootFolder}/${atlasJsonFileName}', '${rootFolder}'`
    : `'${textureKey}', '${rootFolder}/${atlasFileNames[0]}', '${rootFolder}/${atlasJsonFileName}'`;

  return `import Phaser from 'phaser';

class ExampleScene extends Phaser.Scene {
  preload() {
    this.load.${loadFn}(${atlasArgs});
    this.load.animation('${textureKey}-anims', '${rootFolder}/${animationsJsonFileName}');
  }

  create() {
${animationKeys.map((k) => `    this.add.sprite(this.scale.width / 2, this.scale.height / 2, '${textureKey}').play('${k}');`).join('\n')}
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: ExampleScene,
};

new Phaser.Game(config);
`;
}

export interface ReadmeInput {
  textureKey: string;
  animationKeys: string[];
  isMulti: boolean;
  pageCount: number;
  markerCount: number;
  pageFileNames: string[];
}

export function buildReadme(input: ReadmeInput): string {
  const loadMethod = input.isMulti ? 'load.multiatlas' : 'load.atlas';
  const lines = [
    `# ${input.textureKey} — Phaser 4.2.1 Texture Atlas`,
    '',
    '## Requirements',
    '',
    '- Phaser 4.2.1 or compatible',
    '- No plugins required',
    '',
    '## Loading',
    '',
    '```typescript',
    `this.load.${loadMethod}(/* see example.ts */);`,
    `this.load.animation('${input.textureKey}-anims', 'path/to/animations.json');`,
    '```',
    '',
    '## Animations',
    '',
    ...input.animationKeys.map((k) => `- \`${k}\``),
    '',
    '## Pages',
    '',
    ...input.pageFileNames.map((f) => `- \`${f}\``),
    '',
    '## Markers',
    '',
    input.markerCount > 0
      ? `This package includes a marker manifest (\`markers.json\`) with ${input.markerCount} marker(s). Markers are application-level metadata and not native Phaser Animation events.`
      : 'No markers in this export.',
    '',
    '## Notes',
    '',
    '- This is a **baked** atlas: runtime semantics (bones, meshes, IK, physics) are not preserved.',
    '- Frames are trimmed with source offsets for stable origin.',
    '- To change loop behavior, modify the `repeat` value in the Animation JSON or regenerate with different options.',
    '',
  ];
  return lines.join('\n');
}
