import { useProjectStore } from '@/store/projectStore';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { useEffectiveInspectorTarget } from '../application/useEffectiveInspectorTarget.js';
import { MeshPanel } from './node/MeshPanel.jsx';
import { NodeDetails } from './node/NodeDetails.jsx';
import { ShapeKeysPanel } from './node/ShapeKeysPanel.jsx';
import { TexturePanel } from './node/TexturePanel.jsx';
import { TransformPanel } from './node/TransformPanel.jsx';
import { BoneInspector } from './rig/BoneInspector.jsx';
import { IkConstraintInspector } from './rig/IkConstraintInspector.jsx';
import { IkInfluencePanel } from './rig/IkInfluencePanel.jsx';
import { WarpDeformerPanel } from './WarpDeformerPanel.jsx';

export function Inspector({ onRemesh, onDeleteMesh }) {
  const { mode, target } = useEffectiveInspectorTarget();
  const nodes = useProjectStore(s => s.project.nodes);
  const bones = useProjectStore(s => s.project.bones ?? []);
  const constraints = useProjectStore(s => s.project.constraints ?? []);

  if (mode === 'multiple') {
    return (
      <div className="flex h-full items-start justify-center p-3">
        <p className="mt-4 rounded border border-border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
          Multiple elements selected, inspector unavailable
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-3">
      {mode === 'bone' ? (
        <>
          <BoneInspector
            bone={target}
            bones={bones}
            selectedPart={null}
            selectedLinkedBone={null}
          />
          {(target || constraints.length > 0) && (
            <>
              <Separator />
              <IkInfluencePanel constraints={constraints} activeBone={target} />
            </>
          )}
        </>
      ) : mode === 'node' ? (
        <>
          <NodeDetails node={target} />
          <Separator />
          <TransformPanel node={target} allNodes={nodes} />
          {target.type === 'part' && (
            <>
              <Separator />
              <TexturePanel node={target} />
              <Separator />
              <MeshPanel node={target} onRemesh={onRemesh} onDeleteMesh={onDeleteMesh} />
              {target.mesh && (
                <>
                  <Separator />
                  <ShapeKeysPanel node={target} />
                </>
              )}
            </>
          )}
          {target.type === 'warpDeformer' && (
            <>
              <Separator />
              <WarpDeformerPanel node={target} />
            </>
          )}
        </>
      ) : mode === 'constraint' ? (
        <IkConstraintInspector constraint={target} bones={bones} />
      ) : (
        <p className="text-xs text-muted-foreground text-center mt-4">
          Select a layer or bone to inspect it.
        </p>
      )}
    </div>
    </ScrollArea>
  );
}
