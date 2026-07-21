import { Switch } from '@/components/ui/switch';

import { useNodeDetailsController } from '../../application/useNodeInspectorController.js';
import { SectionTitle, InspectorRow } from '../fields/InspectorRow.jsx';
import { SliderRow } from '../fields/SliderRow.jsx';

export function NodeDetails({ node }) {
  const {
    editorMode,
    setOpacity,
    previewOpacity,
    commitOpacity,
    setVisible,
  } = useNodeDetailsController(node);

  return (
    <div className="space-y-1">
      <SectionTitle>{node.type === 'group' ? 'Group' : 'Part'}</SectionTitle>
      <InspectorRow label="Name">
        <span className="text-xs font-mono truncate max-w-[100px] text-right" title={node.name}>
          {node.name || node.id}
        </span>
      </InspectorRow>
      <InspectorRow label="Visible">
        <Switch
          checked={node.visible !== false}
          onCheckedChange={setVisible}
          className="scale-75 origin-right"
        />
      </InspectorRow>
      <SliderRow
        label="Opacity"
        value={Math.round((node.opacity ?? 1) * 100)}
        min={0}
        max={100}
        onChange={(v) => setOpacity(v / 100)}
        onDragStart={editorMode === 'animation' ? previewOpacity : undefined}
        onDragEnd={editorMode === 'animation' ? commitOpacity : undefined}
      />
    </div>
  );
}
