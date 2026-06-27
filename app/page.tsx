import Footer from "@/components/Footer";
import ChargeApp from "@/components/ChargeApp";
import DataBackup from "@/components/DataBackup";
import FeatureGuide from "@/components/FeatureGuide";
import InstallHint from "@/components/InstallHint";
import FusionSpaceBadge from "@/components/FusionSpaceBadge";
import ThemeToggle from "@/components/ThemeToggle";
import KofiButton from "@/components/KofiButton";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Charge",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  url: "https://charge.fusionspace.co",
  description:
    "Black-powder ejection-charge calculator for high-power rocketry: size by target pressure or separation force for single or dual deploy, with redundant-altimeter backup charges, a ground-test log that calibrates to your results, altimeter vent-port sizing, and exportable bench cards and recovery reports. The full ideal-gas formula is shown.",
  featureList: [
    "Size by target pressure or separation force",
    "Single and dual deploy",
    "Redundant-altimeter backup charges",
    "Ground-test log with calibration and validation",
    "Altimeter vent-port sizing",
    "Printable bench card and recovery report (HTML / PDF)",
    "Bench mode for the pad",
    "Works offline; installable",
  ],
  isAccessibleForFree: true,
  publisher: { "@type": "Organization", name: "Fusion Space", url: "https://fusionspace.co" },
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
      {/* Keyboard shortcut past the header, theme/tip controls, and the overview straight
          to the tool. Hidden until focused (first tab stop), then shown. */}
      <a
        href="#calculator"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
      >
        Skip to the calculator
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <header className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <div>
          <FusionSpaceBadge className="mb-1.5" />
          <h1 className="text-2xl font-semibold tracking-tight">Charge</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
            Black-powder ejection-charge calculator for high-power rocketry. Size a charge by
            target pressure or separation force, ground-test it until it separates clean, and
            take a bench card or cert report to the field.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ThemeToggle />
          <KofiButton />
        </div>
      </header>

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

      <FeatureGuide />

      <ChargeApp />
      <DataBackup />
      <InstallHint />
      <Footer />
    </main>
  );
}
