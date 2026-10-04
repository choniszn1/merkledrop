import { useState, type ReactNode } from "react";
import { short } from "./lib/format";
import type { Wallet } from "./Workspace";
import { contractLink } from "./lib/stellar";
import { Link, useTitle } from "./lib/router";

const NAV = [
  ["/", "Home"],
  ["/app", "Claim"],
  ["/docs", "Docs"],
] as const;

const REPO = "https://github.com/choniszn1/merkledrop";

function HeaderAction({ wallet }: { wallet: Wallet }) {
  if (wallet.address)
    return <span className="rounded-2xl bg-white/80 px-3 py-2 font-mono text-xs">● {short(wallet.address, 5)}</span>;
  return (
    <button className="cta cta-sun inline-block" onClick={wallet.connect} disabled={wallet.connecting}>
      {wallet.connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

export function Shell({ route, wallet, children }: { route: string; wallet: Wallet; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-stroke bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span className="text-xl font-extrabold text-navy">merkledrop</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={`rounded-2xl px-4 py-2 text-sm font-bold ${route === to ? "bg-navy text-white" : "text-mute hover:bg-white hover:text-navy"}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block">
            <HeaderAction wallet={wallet} />
          </div>
          <button className="cta cta-line px-3 py-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
            {open ? "✕" : "☰"}
          </button>
        </div>
        {open && (
          <div className="space-y-1 border-t border-stroke px-5 py-4 md:hidden" onClick={() => setOpen(false)}>
            {NAV.map(([to, label]) => (
              <Link key={to} to={to} className={`block rounded-2xl px-4 py-2 text-sm font-bold ${route === to ? "bg-navy text-white" : "text-mute hover:bg-white hover:text-navy"}`}>
                {label}
              </Link>
            ))}
            <div className="pt-2">
              <HeaderAction wallet={wallet} />
            </div>
          </div>
        )}
        {wallet.error && <p className="bg-bad/10 text-bad py-2 text-center text-sm">{wallet.error}</p>}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-20 border-t border-stroke bg-white/70">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-xl font-extrabold text-navy">merkledrop</p>
            <p className="mt-2 max-w-xs text-sm text-mute">Merkle-proof airdrops on Stellar. Any list size, 32 bytes on-chain.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-ink">Product</p>
            <ul className="mt-3 space-y-2 text-mute">
              <li><Link to="/app" className="hover:underline">Claim</Link></li>
              <li><Link to="/docs" className="hover:underline">Documentation</Link></li>
              <li><a href="#/docs" onClick={() => setTimeout(() => document.getElementById("faq")?.scrollIntoView(), 60)} className="hover:underline">FAQ</a></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-ink">Open source</p>
            <ul className="mt-3 space-y-2 text-mute">
              <li><a href={REPO} target="_blank" rel="noreferrer" className="hover:underline">GitHub</a></li>
              <li><a href={contractLink("CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK")} target="_blank" rel="noreferrer" className="hover:underline">Demo drop on testnet</a></li>
              <li><a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer" className="hover:underline">MIT license</a></li>
            </ul>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-mute opacity-80">Runs on Stellar testnet. Not audited; don’t use with real funds yet.</p>
      </footer>
    </div>
  );
}

export function NotFound() {
  useTitle("Not found · merkledrop");
  return (
    <section className="mx-auto max-w-xl px-5 py-28 text-center">
      <p className="text-8xl font-extrabold tracking-tight text-azure">404</p>
      <p className="mt-4 text-lg text-mute">There’s nothing at this address.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link to="/" className="cta cta-sun inline-block">Back home</Link>
        <Link to="/docs" className="cta cta-line inline-block">Read the docs</Link>
      </div>
    </section>
  );
}
