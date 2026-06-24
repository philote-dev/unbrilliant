import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-[transform,box-shadow,background-color,color,filter] focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /* THE one tactile element. Pressable pill with a darker bottom edge */
        tactile:
          "rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge),0_12px_26px_-12px_rgba(40,50,80,0.5)] hover:brightness-[1.04] active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--primary-edge),0_6px_16px_-12px_rgba(40,50,80,0.5)]",
        /* pale lilac fill, dark text. Calm positive actions (Reattempt, etc.) */
        soft: "rounded-full bg-lilac font-medium text-lilac-foreground shadow-soft hover:brightness-[0.97] dark:hover:brightness-110",
        /* outline. Secondary actions like “Why?” */
        secondary:
          "rounded-full border border-lilac-strong/55 bg-transparent font-medium text-lilac-strong hover:bg-lilac-soft",
        /* plain surface button. Google sign-in, list rows */
        neutral:
          "rounded-full border border-border bg-card font-medium text-foreground shadow-soft hover:bg-muted",
        ghost: "rounded-full bg-transparent text-foreground hover:bg-muted",
        link: "font-medium text-lilac-strong underline-offset-4 hover:underline",
        destructive:
          "rounded-full bg-danger/15 font-medium text-danger hover:bg-danger/25",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-5 text-[15px]",
        lg: "h-14 px-7 text-base",
        xl: "h-16 px-8 text-lg",
        icon: "size-10 rounded-full",
        "icon-sm": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "tactile",
      size: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
