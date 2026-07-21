import { Button } from '@/components/ui/button';

import { useTextureInspectorController } from '../../application/useNodeInspectorController.js';
import { SectionTitle } from '../fields/InspectorRow.jsx';

export function TexturePanel({ node }) {
  const {
    fileInputRef,
    exportTexture: handleExport,
    replaceTexture: onFileChange,
  } = useTextureInspectorController(node);
  if (!node || node.type !== 'part') return null;

  return (
    <div className="space-y-2">
      <SectionTitle help="Source image for this part. Replace updates the texture in-place; Remesh may be needed if dimensions change.">Texture</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={handleExport}
        >
          Export Texture
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          Replace Texture
        </Button>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={onFileChange}
      />
      {node.mesh && (
        <p className="text-[10px] text-muted-foreground leading-tight italic">
          Tip: You may need to click &apos;Remesh&apos; if the new image has different dimensions.
        </p>
      )}
    </div>
  );
}
