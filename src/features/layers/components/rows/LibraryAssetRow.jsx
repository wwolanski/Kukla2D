import { Check, FileImage } from 'lucide-react';
import { useRef } from 'react';

import { useInlineRename } from '../../application/useInlineRename.js';
import { formatFileSize } from '../shared/formatFileSize.js';
import { InlineRenameInput } from '../shared/InlineRenameInput.jsx';
import { AssetAvatar } from '../shared/LayerPanelPrimitives.jsx';

export function LibraryAssetRow({ asset, isSelected, dragSession, depth, onSelect, onRename, onDragStart, onDragOver, onDrop }) {
  const rowRef = useRef(null);
  const isDragOver = dragSession?.targetId === asset.id && dragSession?.sourceId !== asset.id;

  const { isEditing, draft, setDraft, startEdit, handleKeyDown, handleBlur } = useInlineRename({
    currentName: asset.name,
    onRename: (val) => onRename?.(asset.id, val),
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver?.('asset', asset.id, 'inside');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop?.('asset', asset.id);
  };

  return (
    <div
      ref={rowRef}
      draggable
      className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded cursor-pointer transition-colors select-none
        ${isSelected
          ? 'bg-primary/20 text-primary border border-primary/40'
          : isDragOver
            ? 'bg-accent border border-accent-foreground/30'
            : 'hover:bg-muted text-foreground border border-transparent'
        }
      `}
      style={{ paddingLeft: `${(depth ?? 0) * 16 + 8}px` }}
      onClick={() => onSelect?.(asset.id)}
      onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
      onDragStart={(e) => onDragStart?.(e, asset.id)}
      onDragOver={handleDragOver}
      onDragLeave={() => onDragOver?.(null, null)}
      onDrop={handleDrop}
    >
      <AssetAvatar
        src={asset.texture?.source}
        label={asset.name}
        fallback={<FileImage className="h-3.5 w-3.5" />}
      />

      <div className="min-w-0 flex-1 flex flex-col">
        {isEditing ? (
          <InlineRenameInput
            value={draft}
            onChange={setDraft}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <span className="truncate font-mono text-xs" title={asset.name}>
            {asset.name}
          </span>
        )}
        {asset.sourceFileName && asset.sourceFileName !== asset.name && (
          <span className="truncate text-[9px] text-muted-foreground/50" title={asset.sourceFileName}>
            {asset.sourceFileName}
          </span>
        )}
      </div>

      <span className="flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
        {asset.isInUse && <Check className="h-3.5 w-3.5 text-emerald-500" aria-label="Used on canvas" />}
        {formatFileSize(asset.size)}
      </span>
    </div>
  );
}
