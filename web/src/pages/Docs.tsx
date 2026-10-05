import { contractLink } from "../lib/stellar";

const DEMO_DROP = "CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK";
import { useEffect } from "react";
import { Link, useSection, useTitle } from "../lib/router";

const SECTIONS = [
  ["start", "Getting started"],
  ["concepts", "Concepts"],
  ["reference", "Contract reference"],
  ["faq", "FAQ"],
] as const;

export function Docs() {
  useTitle("Docs · merkledrop");
  const section = useSection();
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth" });
  }, [section]);
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[210px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.2em] text-azure">On this page</p>
          {SECTIONS.map(([id, label]) => (
            <Link key={id} to={`/docs/${id}`} className="block rounded-lg px-3 py-2 text-mute hover:bg-white hover:text-navy">
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 space-y-16">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-azure">Documentation</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight text-ink">How merkledrop works</h1>
          <p className="mt-4 max-w-2xl text-lg text-mute">A Soroban contract that pays out an airdrop list committed as a Merkle root, plus a browser tool that builds the tree and proofs.</p>
        </header>

        <section id="start" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Getting started</h2>
          <ol className="space-y-3">
            {START.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-navy text-white">{i + 1}</span>
                <p className="pt-0.5 text-ink/85">{step}</p>
              </li>
            ))}
          </ol>
          <Link to="/app" className="cta cta-sun inline-block inline-block">Claim tokens →</Link>
        </section>

        <section id="concepts" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Concepts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONCEPTS.map(([term, body]) => (
              <div key={term} className="box p-5">
                <h3 className="text-lg font-extrabold tracking-tight text-ink">{term}</h3>
                <p className="mt-1.5 text-sm text-mute">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="reference" className="scroll-mt-24 space-y-5">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">Contract reference</h2>
          <p className="text-mute">
            Demo drop on testnet:{" "}
            <a className="break-all font-mono text-sm text-azure underline" href={contractLink(DEMO_DROP)} target="_blank" rel="noreferrer">{DEMO_DROP}</a>
          </p>
          <div className="box overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-stroke text-xs uppercase tracking-wider text-mute">
                <tr>
                  <th className="p-3.5">Function</th>
                  <th className="p-3.5">Signed by</th>
                  <th className="p-3.5">What it does</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.map(([fn, who, what]) => (
                  <tr key={fn} className="border-t border-stroke">
                    <td className="p-3.5 font-mono text-xs text-ink">{fn}</td>
                    <td className="p-3.5 text-mute">{who}</td>
                    <td className="p-3.5 text-mute">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 space-y-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">FAQ</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="box group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                {q}
                <span className="transition group-open:rotate-45 text-azure">+</span>
              </summary>
              <p className="mt-3 text-sm text-mute">{a}</p>
            </details>
          ))}
        </section>
      </article>
    </div>
  );
}

const START: string[] = [
  "Install the Freighter browser wallet, switch it to Testnet and fund the account with test XLM from Friendbot (lab.stellar.org/account/fund).",
  "To claim: open the app, connect your wallet, find your entry in the drop’s list and press Claim.",
  "To create: switch to “Create a drop”, paste a CSV of address,amount lines and check the total.",
  "Choose the token and end date, say where you'll publish drop.json, then deploy and fund in one confirmation and share the claim link."
];

const CONCEPTS: [string, string][] = [
  [
    "Leaf",
    "The hash of one entry: its index, address and amount."
  ],
  [
    "Root",
    "The single hash at the top of the tree, stored in the contract."
  ],
  [
    "Proof",
    "The sibling hashes from a leaf up to the root: a few hundred bytes even for very long lists."
  ],
  [
    "Sweep",
    "After the end date, the admin recovers whatever was not claimed."
  ]
];

const REFERENCE: [string, string, string][] = [
  [
    "constructor(admin, token, root, funding, ends_at, list_uri)",
    "admin",
    "Runs in the deploy transaction: stores the root and list URI and pulls the funding"
  ],
  [
    "claim(index, account, amount, proof)",
    "anyone",
    "Pays the account if the proof matches and it’s unclaimed"
  ],
  [
    "claim_many(claims)",
    "anyone",
    "Up to 20 claims at once, all-or-nothing"
  ],
  [
    "extend(ends_at)",
    "admin",
    "Pushes the end date back"
  ],
  [
    "verify(index, account, amount, proof)",
    "—",
    "Checks a proof without claiming"
  ],
  [
    "is_claimed(index)",
    "—",
    "Whether an entry has been claimed"
  ],
  [
    "sweep()",
    "admin",
    "Returns the remainder after the end date"
  ],
  [
    "get_drop()",
    "—",
    "Read state"
  ]
];

const FAQ: [string, string][] = [
  [
    "Can someone else claim my tokens?",
    "Anyone can submit a claim, but the tokens always go to the address in the list."
  ],
  [
    "Who pays the network fee for a claim?",
    "Whoever submits it, usually the recipient."
  ],
  [
    "What if the list has a mistake?",
    "The root is fixed once deployed. Sweep after the end date and deploy a new drop with a corrected list."
  ],
  [
    "Does the list have to be public?",
    "Recipients need their entry and proof, so the list has to reach them. Publishing it is the simplest way."
  ],
  [
    "Do the web tool and the contract hash the same way?",
    "Yes. Tests check that the Rust contract and the TypeScript tree builder produce identical roots and proofs."
  ],
  [
    "Is it audited?",
    "Not yet. It runs on Stellar testnet and is open source; treat it as a working prototype until it has been audited."
  ]
];
