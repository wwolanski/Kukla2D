export function PartIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  );
}

export function ChevronIcon({ open }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}
    >
      <path d="M3 2l4 3-4 3" />
    </svg>
  );
}

export function AssetAvatar({ src, label, fallback }) {
  return (
    <span className="group/avatar relative shrink-0">
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-border bg-background">
        {src ? (
          <img src={src} alt="" className="h-full w-full object-contain" draggable={false} />
        ) : fallback}
      </span>
      {src && (
        <span className="pointer-events-none invisible absolute left-8 top-1/2 z-50 -translate-y-1/2 rounded border border-border bg-popover p-1 opacity-0 shadow-lg transition-opacity delay-100 group-hover/avatar:visible group-hover/avatar:opacity-100">
          <span className="flex h-28 w-28 items-center justify-center rounded bg-[linear-gradient(45deg,#2a2a2a_25%,transparent_25%),linear-gradient(-45deg,#2a2a2a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#2a2a2a_75%),linear-gradient(-45deg,transparent_75%,#2a2a2a_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0]">
            <img src={src} alt={label ?? ''} className="max-h-full max-w-full object-contain" draggable={false} />
          </span>
        </span>
      )}
    </span>
  );
}
