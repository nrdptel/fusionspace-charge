import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChargeApp from "@/components/ChargeApp";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Charge",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  url: "https://charge.fusionspace.co",
  description:
    "Black-powder ejection-charge calculator for high-power rocketry, with the full formula shown and a ground-test log.",
  isAccessibleForFree: true,
  publisher: { "@type": "Organization", name: "Fusion Space", url: "https://fusionspace.co" },
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Header />

      <section className="relative mt-12 overflow-hidden md:mt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-indigo-500/15 blur-3xl dark:bg-indigo-500/20"
        />
        <div className="flex flex-col items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/fusion-space-mark.svg"
            alt=""
            aria-hidden
            width={880}
            height={815}
            className="h-11 w-auto md:h-12"
          />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Charge
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            A black-powder ejection-charge calculator for high-power rocketry. Size a
            charge to separate your airframe and deploy recovery — from your tube, your
            pressurized section, and the force holding it together.
          </p>
        </div>
      </section>

      {/* Safety is the headline, not the fine print. */}
      <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
        <span aria-hidden className="mt-0.5 shrink-0 text-base">
          ⚠
        </span>
        <p>
          <strong className="font-semibold">
            This gives a starting estimate, never a number to fly unverified.
          </strong>{" "}
          The calculation is a conservative theoretical baseline — real charges differ
          with powder, wadding, leakage, and friction. Always ground-test a charge and
          confirm clean separation before flight, and follow your range&apos;s safety
          rules. Black powder is an explosive; handling and use are your responsibility.
        </p>
      </div>

      <ChargeApp />
      <Footer />
    </main>
  );
}
