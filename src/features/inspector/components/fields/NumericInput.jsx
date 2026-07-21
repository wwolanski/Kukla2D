import { useEffect, useRef } from 'react';

/**
 * A numeric input that:
 * - Shows current value
 * - Updates on blur or Enter
 * - Syncs externally when not focused
 */
export function NumericInput({
  value,
  onChange,
  onBlur,
  step = 1,
  precision = 1,
  className = '',
  disabled = false,
  ...inputProps
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = Number(value).toFixed(precision);
    }
  });

  const commit = () => {
    const v = parseFloat(ref.current.value);
    if (!isNaN(v)) onChange(v);
    onBlur?.();
  };

  return (
    <input
      ref={ref}
      type="number"
      step={step}
      defaultValue={Number(value).toFixed(precision)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      disabled={disabled}
      {...inputProps}
      className={`w-16 text-xs bg-input text-foreground border border-border rounded px-1.5 py-0.5 text-right
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
        focus:outline-none focus:ring-1 focus:ring-primary/50 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    />
  );
}
