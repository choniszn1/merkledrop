import { useEffect, useState } from "react";
import { client } from "../lib/stellar";
import { fromUnits, timeLeft } from "../lib/format";

const DEMO_DROP = "CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK";
import { Link, useTitle } from "../lib/router";

export function Home() {
  const [failed, setFailed] = useState(false);
  useTitle("merkledrop · Merkle-proof airdrops on Stellar");
  const [drop, setDrop] = useState<{ claimed_total: bigint; ends_at: bigint } | null>(null);
  useEffect(() => {
    client(DEMO_DROP).read<{ claimed_total: bigint; ends_at: bigint }>("get_drop").then(setDrop).catch(() => setFailed(true));
  }, []);
  const STATS: [string, string][] = [
    ["Demo claimed", drop ? fromUnits(drop.claimed_total) : "…"],
    ["Demo closes", drop ? timeLeft(drop.ends_at) : "…"],
    ["On-chain list", "32 bytes"],
  ];
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 md:grid-cols-[1.2fr_1fr] md:pt-20">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-azure">Merkle-proof airdrops on Stellar</p>
          <h1 className="mt-4 text-5xl leading-[1.03] md:text-6xl font-extrabold tracking-tight text-ink">Airdrop to thousands. <span className="text-azure">Store 32 bytes.</span></h1>
          <p className="mt-6 max-w-xl text-lg text-mute">Upload a CSV of addresses and amounts, fund the drop and share the claim page. Recipients claim with a proof. The contract stores only a Merkle root, so a drop of any size costs the same to create.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app" className="cta cta-sun inline-block">Claim tokens →</Link>
            <Link to="/docs" className="cta cta-line inline-block">How it works</Link>
          </div>
          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6">
            {STATS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wider text-mute">{label}</dt>
                <dd className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {failed && (
            <p className="mt-6 text-sm opacity-80" role="status">
              Couldn’t reach Stellar testnet, so live numbers aren’t shown.{" "}
              <button className="font-semibold underline" onClick={() => window.location.reload()}>
                Retry
              </button>
            </p>
          )}
        </div>
        <div className="box p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-mute">One root, any number of recipients</p>
          <svg viewBox="0 0 320 175" className="mt-4 w-full" role="img" aria-label="Merkle tree">
            {[
              [160, 22, 90, 78],
              [160, 22, 230, 78],
              [90, 78, 50, 138],
              [90, 78, 130, 138],
              [230, 78, 190, 138],
              [230, 78, 270, 138],
            ].map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i === 0 || i === 3 ? "#ffc93c" : "#d6e6fb"} strokeWidth="3" />
            ))}
            <circle cx="160" cy="22" r="14" fill="#0b3d91" />
            {[90, 230].map((x) => (
              <circle key={x} cx={x} cy="78" r="11" fill="#2f80ed" />
            ))}
            {[50, 130, 190, 270].map((x) => (
              <circle key={x} cx={x} cy="138" r="9" fill={x === 130 ? "#ffc93c" : "#ffffff"} stroke="#2f80ed" strokeWidth="2" />
            ))}
            <text x="182" y="27" fontSize="11" fill="#5a6b86">root, stored on-chain</text>
            <text x="98" y="166" fontSize="11" fill="#5a6b86">your entry + proof</text>
          </svg>
          <p className="mt-3 text-sm text-mute">
            The contract keeps only the root. A claim carries a short proof that your address and amount are in the list.
          </p>
        </div>
      </section>

      <section className="border-y border-stroke bg-white/60">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-azure">How it works</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-ink">From CSV to claimed</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="box p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold bg-navy text-white">{i + 1}</span>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight text-ink">{title}</h3>
                <p className="mt-2 text-sm text-mute">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-azure">Use cases</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-ink">Distribute tokens without a giant transaction</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map(([icon, title, body]) => (
            <div key={title} className="box p-6">
              <span className="text-3xl">{icon}</span>
              <h3 className="mt-3 text-lg font-extrabold tracking-tight text-ink">{title}</h3>
              <p className="mt-2 text-sm text-mute">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-azure">Guarantees</p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-ink">Cheap for you, safe for recipients</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROMISES.map(([title, body]) => (
            <div key={title} className="rounded-2xl p-7 bg-navy text-white">
              <h3 className="text-xl font-extrabold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-white/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-20">
        <div className="box flex flex-col items-start justify-between gap-6 p-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">Check if you’re eligible.</h2>
            <p className="mt-2 text-mute">Open the demo drop, connect your wallet and see whether your address is on the list.</p>
          </div>
          <Link to="/app" className="cta cta-sun inline-block shrink-0">Claim tokens →</Link>
        </div>
      </section>
    </>
  );
}

const STEPS: [string, string][] = [
  [
    "Build the tree",
    "Paste a CSV of address,amount lines. The app builds the Merkle tree and shows the root and the total."
  ],
  [
    "Deploy and fund",
    "One contract per drop stores the root and an end date, and pulls the total from you."
  ],
  [
    "Recipients claim",
    "They open the claim page, find their entry and submit the proof. After the end date you sweep what’s left."
  ]
];

const USES: [string, string, string][] = [
  [
    "🪂",
    "Community airdrops",
    "Reward early users and contributors in one go."
  ],
  [
    "🏆",
    "Contest prizes",
    "Publish winners and amounts, and let them claim at their own pace."
  ],
  [
    "💰",
    "Retroactive grants",
    "Pay out a list computed off-chain and verifiable on-chain."
  ],
  [
    "🎁",
    "Loyalty rewards",
    "Periodic drops to customers, each with its own end date."
  ]
];

const PROMISES: [string, string][] = [
  [
    "Constant creation cost",
    "Only the 32-byte root goes on-chain, however long the list."
  ],
  [
    "One claim per entry",
    "Each entry can be claimed once, and a wrong amount or address fails the proof."
  ],
  [
    "Unclaimed comes back",
    "After the end date the admin sweeps the remainder. Before it, funds can only be claimed."
  ]
];
