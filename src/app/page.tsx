import Prismo from "@/components/Prismo";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-6">
        {/* Copy */}
        <div className="order-2 md:order-1">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--skin)]/25 px-4 py-1.5 text-sm font-semibold text-[var(--foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--eye-iris)]" />
            AI-powered UI &amp; UX feedback
          </span>

          <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl">
            Meet&nbsp;Prismo.
            <br />
            Your screen&apos;s
            <br />
            second pair of eyes.
          </h1>

          <p className="mt-6 max-w-md text-lg text-[var(--foreground)]/80">
            Upload a UI screenshot and Prismo reviews visual hierarchy, spacing,
            typography, contrast, and CTA clarity — then scores it and tells you
            exactly what to fix next.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#"
              className="rounded-full bg-[var(--foreground)] px-7 py-3.5 text-base font-bold text-[var(--background)] transition-transform hover:-translate-y-0.5"
            >
              Analyze a screen
            </a>
            <a
              href="#"
              className="rounded-full border-2 border-[var(--foreground)]/20 px-7 py-3.5 text-base font-bold text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]/50"
            >
              See how it works
            </a>
          </div>

          <p className="mt-6 text-sm text-[var(--foreground)]/60">
            Built for junior designers, bootcamp students, and product teams.
          </p>
        </div>

        {/* Prismo */}
        <div className="order-1 flex justify-center md:order-2">
          <Prismo className="h-auto w-full max-w-xs sm:max-w-sm" />
        </div>
      </section>
    </main>
  );
}
