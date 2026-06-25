import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="flex items-center justify-between gap-4">
      <a
        href="https://fusionspace.co"
        aria-label="Fusion Space home"
        className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/fusion-space-wordmark.svg"
          alt="Fusion Space"
          width={1598}
          height={281}
          className="h-6 w-auto md:h-7"
        />
      </a>
      <ThemeToggle />
    </header>
  );
}
