import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

const buttonStyles = cva(
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      intent: {
        primary: "bg-sienna text-on-sienna hover:bg-ink",
        quiet: "border border-line bg-sheet text-ink hover:border-ink",
        danger: "bg-ink text-on-sienna hover:bg-sienna",
      },
    },
    defaultVariants: { intent: "primary" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ intent, className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonStyles({ intent }), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
