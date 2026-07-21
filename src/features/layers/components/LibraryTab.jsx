import { FolderPlus, Loader2, Sparkles, Upload } from 'lucide-react';
import { useState } from 'react';

import { loadExampleProjectFile } from '@/features/projects';

import { BorderBeam } from '@/components/ui/border-beam';
import { ScrollArea } from '@/components/ui/scroll-area';

import { LibraryAssetRow } from './rows/LibraryAssetRow.jsx';
import { LibraryFolderRow } from './rows/LibraryFolderRow.jsx';

export function LibraryTab({
  tree,
  expandedFolderIds,
  dragSession,
  selection,
  dragActive,
  onToggleFolderExpand,
  onCreateFolder,
  onRenameFolder,
  onRenameAsset,
  onDragStartAsset,
  onDragStartFolder,
  onDragOverRow,
  onDropRow,
  onDragEnter,
  onDragOverBackground,
  onDragLeave,
  onDropBackground,
  onSelect,
  onImportClick,
  onLoadExampleProject,
}) {
  const isEmpty = tree.length === 0;
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [exampleError, setExampleError] = useState('');

  const handleLoadExample = async () => {
    setIsLoadingExample(true);
    setExampleError('');
    try {
      const file = await loadExampleProjectFile();
      onLoadExampleProject?.(file);
    } catch (error) {
      setExampleError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingExample(false);
    }
  };

  function renderRows(rows, depth = 0) {
    return rows.map(row => {
      if (row.kind === 'folder') {
        const isExpanded = expandedFolderIds.has(row.id);
        return (
          <div key={row.id}>
            <LibraryFolderRow
              folder={row}
              isExpanded={isExpanded}
              dragSession={dragSession}
              depth={depth}
              onToggleExpand={onToggleFolderExpand}
              onRename={onRenameFolder}
              onDragStart={onDragStartFolder}
              onDragOver={onDragOverRow}
              onDrop={onDropRow}
              onSelect={onSelect}
            />
            {isExpanded && row.children && row.children.length > 0 && (
              <div>{renderRows(row.children, depth + 1)}</div>
            )}
          </div>
        );
      }
      return (
        <LibraryAssetRow
          key={row.id}
          asset={row}
          isSelected={selection.includes(row.id)}
          dragSession={dragSession}
          depth={depth}
          onSelect={onSelect}
          onRename={onRenameAsset}
          onDragStart={onDragStartAsset}
          onDragOver={onDragOverRow}
          onDrop={onDropRow}
        />
      );
    });
  }

  return (
    <>
      <div className="flex h-8 items-center gap-1 border-b px-2 shrink-0">
        <button
          type="button"
          onClick={onImportClick}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Import artwork"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
        <button
          type="button"
          onClick={onCreateFolder}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Add New Folder"
        >
          <FolderPlus className="h-3 w-3" />
          New Folder
        </button>
      </div>

      <ScrollArea
        className={`flex-1 transition-colors ${dragActive ? 'bg-primary/5' : ''}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOverBackground}
        onDragLeave={onDragLeave}
        onDrop={onDropBackground}
      >
        <div className="p-1 space-y-0.5">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-background text-muted-foreground">
                <Upload className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">Import artwork</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Drop PNG or PSD files here.
                </p>
              </div>
              <button
                type="button"
                onClick={onImportClick}
                className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-background px-2 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
              <button
                type="button"
                onClick={handleLoadExample}
                disabled={isLoadingExample}
                className="relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded border border-primary/30 bg-background px-3 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
              >
                <BorderBeam duration={3.5} />
                {isLoadingExample
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5 text-primary" />}
                Load example project
              </button>
              {exampleError && (
                <p role="alert" className="max-w-48 text-[10px] text-destructive">{exampleError}</p>
              )}
            </div>
          ) : (
            renderRows(tree)
          )}
        </div>
      </ScrollArea>
    </>
  );
}
