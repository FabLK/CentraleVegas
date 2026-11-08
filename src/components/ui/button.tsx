import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-400 hover:to-blue-500 hover:shadow-xl hover:shadow-blue-500/30",
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:from-red-400 hover:to-red-500 hover:shadow-xl hover:shadow-red-500/30",
        outline:
          "border-2 border-slate-200/60 bg-gradient-to-b from-white to-slate-50/80 shadow-sm hover:from-slate-50 hover:to-slate-100/80 hover:border-slate-300/80 text-slate-700",
        secondary:
          "bg-gradient-to-b from-slate-100 to-slate-200 text-slate-700 shadow-sm hover:from-slate-200 hover:to-slate-300",
        ghost: "hover:bg-gradient-to-b hover:from-slate-100/50 hover:to-slate-200/50 text-slate-700",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-xl px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
