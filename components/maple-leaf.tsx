// Small red maple leaf used to mark Canadian-sourced products and the
// Canadian Sourced category/page. Decorative by default; pass a label when
// the leaf is the only thing conveying the meaning.
export function MapleLeaf({ className = "h-4 w-4", label }: { className?: string; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static icon
    <img
      src="/icons/maple-leaf.png"
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 object-contain ${className}`}
      draggable={false}
    />
  )
}
