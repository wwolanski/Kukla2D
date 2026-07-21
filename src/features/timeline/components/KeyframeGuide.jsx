export function KeyguideLabels({ frames, seekFrame, frameToPercentage }) {
  if (!frames || frames.length === 0) return null;

  return (
    <>
      {frames.map(({ frame, label }, index) => {
        const isFirst = index === 0;
        const isLast = index === frames.length - 1;
        const isBoundary = isFirst || isLast;
        return (
          <button
            key={frame}
            className="absolute inset-y-0 w-6 cursor-pointer group"
            style={{ left: frameToPercentage(frame), transform: 'translateX(-50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              seekFrame(frame);
            }}
            aria-label={`Seek to frame ${frame}`}
            title={`Seek to frame ${frame}`}
          >
            <div
              className={[
                'absolute inset-y-0 left-1/2 -translate-x-1/2 border-l transition-colors',
                isBoundary
                  ? 'border-primary/55 group-hover:border-primary'
                  : 'border-dashed border-primary/30 group-hover:border-primary/80',
              ].join(' ')}
            />
            <span
              className={[
                'absolute top-3 left-1/2 rounded px-1.5 py-0.5 text-[9px] leading-none whitespace-nowrap transition-colors',
                isBoundary
                  ? 'bg-primary/15 text-primary/90 group-hover:bg-primary/30'
                  : 'bg-card/90 text-primary/65 group-hover:bg-primary/20 group-hover:text-primary',
              ].join(' ')}
              style={{ transform: isFirst ? 'translateX(0)' : isLast ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {label}
            </span>
          </button>
        );
      })}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 text-center pointer-events-none space-y-1.5">
        <span className="inline-block rounded bg-card/90 px-2 py-1 text-[10px] text-muted-foreground/80">
          Select an element, move the playhead, pose it, then press K. Smart K keys its existing animated channels.
        </span>
        <div>
          <span className="inline-block rounded bg-card/90 px-2 py-1 text-[10px] text-muted-foreground/60 italic">
            Guide only — clicking markers only moves the playhead.
          </span>
        </div>
      </div>
    </>
  );
}
