import { useProjectStore } from '@/store/projectStore';
import { beginBatch, endBatch } from '@/store/undoHistory';

import { HelpIcon } from '@/components/ui/help-icon';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export function SliderRow({ label, value, min, max, step = 1, onChange, help, onDragStart, onDragEnd, disabled = false }) {
  const useBatch = !onDragStart && !onDragEnd;
  const handlePointerDown = () => {
    if (disabled) return;
    if (useBatch) beginBatch(useProjectStore.getState().project);
    onDragStart?.();
  };
  const handlePointerUp = () => {
    if (disabled) return;
    if (useBatch) endBatch();
    onDragEnd?.();
  };

  return (
    <div className="space-y-1 py-0.5" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <div className="flex justify-between items-center gap-1">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {help && <HelpIcon tip={help} />}
        </div>
        <span className="text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}
