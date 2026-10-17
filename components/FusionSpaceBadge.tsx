/** Parent-brand eyebrow. Charge is one of several FusionSpace tools; this small
 * linked lockup sits above the product name to place it under the FusionSpace
 * brand and let people discover the other tools at fusionspace.co. Uses the
 * Rev C horizontal lockup at 24 px tall (the brand's minimum cluster height, and
 * fusionspace.co's header size). Below 32 px the gradient's thin details are too
 * faint on light, so light mode gets the one-color Void lockup and dark mode the
 * gradient one. Mirrors the HPR Motor Finder's badge. */
export default function FusionSpaceBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://fusionspace.co"
      target="_blank"
      rel="noopener noreferrer"
      title="FusionSpace — free, polished tools for high-power rocketry"
      className={`group inline-flex w-fit items-center gap-1 transition hover:opacity-80 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/fusion-space-horizontal-void.svg"
        alt="FusionSpace"
        width={680}
        height={115}
        className="h-6 w-auto dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/fusion-space-horizontal-color.svg"
        alt="FusionSpace"
        width={680}
        height={115}
        className="hidden h-6 w-auto dark:block"
      />
      <span
        aria-hidden
        className="text-xs text-zinc-400 opacity-0 transition group-hover:opacity-100 dark:text-zinc-500"
      >
        ↗
      </span>
    </a>
  );
}
