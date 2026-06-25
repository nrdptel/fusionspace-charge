const GITHUB_URL = "https://github.com/nrdptel/fusionspace-charge";

function Dot() {
  return (
    <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
      ·
    </span>
  );
}

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-28">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-4 w-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub
          </a>
          <Dot />
          <a
            href="https://fusionspace.co"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Fusion Space
          </a>
          <Dot />
          <a
            href="https://motor.fusionspace.co"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Motor Finder
          </a>
        </nav>
        <div className="flex items-center gap-1.5">
          <span>Built by</span>
          <a href="https://fusionspace.co" aria-label="Fusion Space">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/fusion-space-wordmark.svg"
              alt="Fusion Space"
              width={1598}
              height={281}
              className="h-4 w-auto"
            />
          </a>
        </div>
      </div>
      <p className="mt-5 max-w-3xl leading-relaxed text-zinc-500 dark:text-zinc-400">
        <strong className="font-medium text-zinc-600 dark:text-zinc-300">
          Every result is a theoretical starting estimate, not an authoritative figure —
          always ground-test a charge and adjust it before you fly it.
        </strong>{" "}
        Black powder is an explosive; sizing, handling, and flying ejection charges is
        your responsibility. Personal, non-commercial project — not affiliated with any
        rocketry vendor or manufacturer. Built for the hobby rocketry community.
      </p>
    </footer>
  );
}
