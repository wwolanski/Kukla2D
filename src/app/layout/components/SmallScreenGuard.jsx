import { Monitor } from 'lucide-react';

export function SmallScreenGuard() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground px-6 xl:hidden"
      data-small-screen-guard="true"
      role="dialog"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Monitor className="h-7 w-7 text-primary" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            Desktop app only
          </h1>
          <p className="text-sm text-muted-foreground">
            Kukla2D is a desktop-first tool and is not supported on mobile or
            narrow screens. Please open it on a device with a screen at least
            1280&nbsp;px wide (landscape desktop).
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          Kukla2D {__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}