import { cn } from "@/lib/utils"

import { badgeVariants } from "./badge-variants.js"

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge }
