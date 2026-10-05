import { useEffect, useMemo, useState } from "react";
import { StrKey, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { buildTree, parseCsv, type Claim, type DropTree } from "./tree";
import { addr, client, contractLink, deployContract, i128, str, txLink, u32, u64, XLM_SAC } from "./lib/stellar";
import { routeParams } from "./lib/router";
import { dateOf, fromUnits, short, timeLeft, toUnits } from "./lib/format";
import { useWallet } from "./lib/useWallet";
import { useAction } from "./lib/useAction";

const DEMO_DROP = import.meta.env.VITE_DROP_ID ?? "CC64VFG6SEL6QZ75M6CH52V7M4VYSXGXUGLIERPWC5IW6FX3CCD35TDK";
const WASM_HASH = import.meta.env.VITE_DROP_WASM_HASH ?? "f285c779874ada4e128931a52b72d9f1fc7d4ea1a83a395f37d3876d9f1ad900";
const ERRORS: Record<number, string> = {
  1: "This drop is already initialized.",
  2: "That contract isn't an initialized drop.",
  3: "Already claimed.",
  4: "The proof doesn't match this drop's list.",
  5: "The claim window has closed.",
  6: "The claim window is still open.",
  7: "Funding and amounts must be positive.",
  8: "The end date must be in the future.",
};
interface Drop {
  admin: string;
  token: string;
  root: Uint8Array;
  ends_at: bigint;
  claimed_total: bigint;
  /** Only on drops created from the constructor build. */
  list_uri?: string;
}
export type Wallet = ReturnType<typeof useWallet>;

export function Workspace({ wallet }: { wallet: Wallet }) {
  const [mode, setMode] = useState<"claim" | "create">("claim");
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="hidden rounded-2xl bg-white/70 p-1 sm:flex">
            {(["claim", "create"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`cta py-2 ${mode === m ? "cta-navy" : "text-mute"}`}>
                {m === "claim" ? "Claim" : "Create a drop"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 pb-16">{mode === "claim" ? <ClaimPortal wallet={wallet} /> : <CreateDrop wallet={wallet} />}</div>
    </div>
  );
}

function Note({ a }: { a: ReturnType<typeof useAction> }) {
  if (a.error) return <p className="rounded-2xl bg-bad/10 px-4 py-3 text-sm text-bad">{a.error}</p>;
  if (a.notice)
    return (
      <p className="rounded-2xl bg-good/10 px-4 py-3 text-sm text-good">
        {a.notice.text}{" "}
        {a.notice.hash && (
          <a className="underline" href={txLink(a.notice.hash)} target="_blank" rel="noreferrer">
            transaction
          </a>
        )}
      </p>
    );
  return null;
}

function ClaimPortal({ wallet }: { wallet: Wallet }) {
  // Claim links look like #/app?drop=C…&list=https://…
  const params = routeParams();
  const [dropId] = useState(params.get("drop") ?? DEMO_DROP);
  const [listParam] = useState(params.get("list") ?? (dropId === DEMO_DROP ? `${import.meta.env.BASE_URL}demo-drop.json` : ""));
  const [tree, setTree] = useState<DropTree | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [who, setWho] = useState("");
  const [claimed, setClaimed] = useState<Record<number, boolean>>({});
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const act = useAction();
  const c = useMemo(() => client(dropId, ERRORS), [dropId]);

  // Without a list in the link, fall back to the URI stored in the drop itself.
  const listUrl = listParam || drop?.list_uri || "";
  useEffect(() => {
    c.read<Drop>("get_drop").then(setDrop).catch((e) => setLoadErr(e.message));
  }, [c]);
  useEffect(() => {
    if (listUrl)
      fetch(listUrl)
        .then((r) => r.json())
        .then(setTree)
        .catch(() => setLoadErr("Couldn't load the allocation list."));
  }, [listUrl]);
  useEffect(() => {
    if (wallet.address) setWho(wallet.address);
  }, [wallet.address]);
  useEffect(() => {
    if (!tree) return;
    Promise.all(tree.claims.map((cl) => c.read<boolean>("is_claimed", [u32(cl.index)]).then((v) => [cl.index, v] as const))).then((pairs) =>
      setClaimed(Object.fromEntries(pairs)),
    );
  }, [tree, c]);

  const entry: Claim | undefined = tree?.claims.find((cl) => cl.account === who);
  const rootOk = !!(drop && tree && Buffer.from(drop.root).toString("hex") === tree.root);
  const pct = drop && tree ? Number((drop.claimed_total * 100n) / BigInt(tree.total || "1")) : 0;
  const unit = drop?.token === XLM_SAC ? "XLM" : "tokens";

  return (
    <div className="space-y-6">
      <section className="py-6 text-center">
        <h1 className="text-4xl font-extrabold leading-tight text-navy md:text-6xl">Your tokens are waiting ✨</h1>
        <p className="mx-auto mt-3 max-w-xl text-mute">Paste your address to check your allocation and claim it with a Merkle proof, straight from the drop contract.</p>
      </section>
      {loadErr && <p className="box p-5 text-bad">{loadErr}</p>}
      {drop && (
        <section className="box grid gap-4 p-6 sm:grid-cols-4">
          {[
            ["Drop", <a key="l" className="font-mono underline" href={contractLink(dropId)} target="_blank" rel="noreferrer">{short(dropId, 5)}</a>],
            ["Recipients", tree ? tree.claims.length : "…"],
            ["Claimed", `${fromUnits(drop.claimed_total)} / ${tree ? fromUnits(BigInt(tree.total)) : "…"} ${unit}`],
            ["Closes", `${dateOf(drop.ends_at)} (${timeLeft(drop.ends_at)})`],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <p className="text-xs uppercase tracking-widest text-mute">{k}</p>
              <p className="mt-1 font-semibold">{v}</p>
            </div>
          ))}
          <div className="sm:col-span-4">
            <div className="h-2.5 overflow-hidden rounded-full bg-sky">
              <div className="h-full rounded-full bg-gradient-to-r from-azure to-sun" style={{ width: `${pct}%` }} />
            </div>
            {tree && !rootOk && <p className="mt-2 text-sm text-bad">Warning: this list's root doesn't match the contract. Claims will fail.</p>}
          </div>
        </section>
      )}
      <section className="box p-6">
        <label className="text-sm font-semibold text-navy">Your address</label>
        <input className="ipt mt-2 font-mono text-xs" placeholder="G… or C…" value={who} onChange={(e) => setWho(e.target.value.trim())} />
        {who && tree && !entry && StrKey.isValidEd25519PublicKey(who) && <p className="mt-4 text-mute">This address isn't on the list for this drop.</p>}
        {entry && (
          <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-3xl bg-sky p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-mute">Allocation #{entry.index}</p>
              <p className="text-3xl font-extrabold text-navy">
                {fromUnits(BigInt(entry.amount))} <span className="text-base">{unit}</span>
              </p>
              <p className="text-xs text-mute">
                proof: {entry.proof.length} hash{entry.proof.length === 1 ? "" : "es"} ·{" "}
                <button
                  className="underline"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify({ drop: dropId, ...entry }, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `proof-${entry.index}.json`;
                    a.click();
                  }}
                >
                  download proof
                </button>
              </p>
            </div>
            {claimed[entry.index] ? (
              <span className="rounded-2xl bg-good/15 px-4 py-3 font-semibold text-good">✓ Claimed</span>
            ) : (
              <button
                className="cta cta-sun"
                disabled={!!act.busy}
                onClick={async () => {
                  const me = wallet.address ?? (await wallet.connect());
                  if (!me) return;
                  await act.run(
                    "claim",
                    async () => {
                      const proof = xdr.ScVal.scvVec(entry.proof.map((h) => xdr.ScVal.scvBytes(Buffer.from(h, "hex"))));
                      const r = await c.invoke(me, "claim", [u32(entry.index), addr(entry.account), i128(BigInt(entry.amount)), proof]);
                      setClaimed((cm) => ({ ...cm, [entry.index]: true }));
                      return r;
                    },
                    (r) => ({ text: `Sent ${fromUnits(BigInt(entry.amount))} ${unit} to ${short(entry.account)}.`, hash: r.hash }),
                  );
                }}
              >
                {act.busy ? "Confirm in wallet…" : wallet.address && wallet.address !== entry.account ? "Claim on their behalf" : "Claim now"}
              </button>
            )}
          </div>
        )}
        <div className="mt-4">
          <Note a={act} />
        </div>
        <p className="mt-4 text-xs text-mute">
          Classic (G…) accounts need a trustline to the token before claiming. Anyone can submit a claim; the tokens always go
          to the listed address.
        </p>
      </section>
      {tree && (
        <section className="box p-6">
          <h2 className="font-bold text-navy">Allocation list</h2>
          <div className="mt-3 divide-y divide-stroke">
            {tree.claims.map((cl) => (
              <button key={cl.index} onClick={() => setWho(cl.account)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-azure">
                <span className="font-mono">{short(cl.account, 8)}</span>
                <span>
                  {fromUnits(BigInt(cl.amount))} {claimed[cl.index] ? <b className="ml-2 text-good">claimed</b> : <span className="ml-2 text-mute">unclaimed</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CreateDrop({ wallet }: { wallet: Wallet }) {
  const [csv, setCsv] = useState("address,amount\n");
  const [days, setDays] = useState(30);
  const [listUri, setListUri] = useState("");
  const [token, setToken] = useState(XLM_SAC);
  const [tree, setTree] = useState<DropTree | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [deployed, setDeployed] = useState<string | null>(null);
  const act = useAction();

  const build = () => {
    setErr(null);
    try {
      setTree(buildTree(parseCsv(csv, toUnits)));
    } catch (e) {
      setTree(null);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(tree, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "drop.json";
    a.click();
  };

  return (
    <div className="grid gap-6 py-6 lg:grid-cols-2">
      <section className="box space-y-4 p-6">
        <h1 className="text-2xl font-extrabold text-navy">1 · Build the list</h1>
        <p className="text-sm text-mute">One <code>address,amount</code> per line, amounts in whole tokens (e.g. 12.5).</p>
        <textarea className="ipt h-56 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <div className="flex gap-2">
          <label className="cta cta-line cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => e.target.files?.[0] && setCsv(await e.target.files[0].text())} />
          </label>
          <button className="cta cta-navy" onClick={build}>
            Build tree
          </button>
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
      </section>
      <section className="box space-y-4 p-6">
        <h2 className="text-2xl font-extrabold text-navy">2 · Deploy &amp; fund</h2>
        {!tree ? (
          <p className="text-sm text-mute">Build the tree first. Everything happens in your browser.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-sky p-4 text-sm">
              <p>
                <b>{tree.claims.length}</b> recipients · total <b>{fromUnits(BigInt(tree.total))}</b>
              </p>
              <p className="mt-1 break-all font-mono text-xs text-mute">root {tree.root}</p>
            </div>
            <button className="cta cta-line" onClick={download}>
              Download drop.json
            </button>
            <label className="block text-sm">
              Token contract
              <input className="ipt mt-1 font-mono text-xs" value={token} onChange={(e) => setToken(e.target.value.trim())} />
            </label>
            <label className="block text-sm">
              Where you'll publish drop.json (optional, stored in the drop)
              <input className="ipt mt-1 font-mono text-xs" placeholder="https://…/drop.json" value={listUri} onChange={(e) => setListUri(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Claim window <input className="ipt w-20" type="number" min="1" value={days} onChange={(e) => setDays(Number(e.target.value))} /> days
            </label>
            <button
              className="cta cta-sun w-full"
              disabled={!!act.busy}
              onClick={async () => {
                const me = wallet.address ?? (await wallet.connect());
                if (!me) return;
                await act.run(
                  "deploy",
                  async () => {
                    // Setup and funding are constructor arguments: one confirmation, no
                    // half-configured contract if something goes wrong.
                    const ends = BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
                    const r = await deployContract(me, WASM_HASH, [
                      addr(me),
                      addr(token),
                      xdr.ScVal.scvBytes(Buffer.from(tree.root, "hex")),
                      i128(BigInt(tree.total)),
                      u64(ends),
                      str(listUri.trim()),
                    ]);
                    setDeployed(r.contractId);
                    return r;
                  },
                  (r) => ({ text: "Drop deployed and funded.", hash: r.hash }),
                );
              }}
            >
              {act.busy ? "Confirm in wallet…" : `Deploy & fund ${fromUnits(BigInt(tree.total))}`}
            </button>
            <Note a={act} />
            {deployed && (
              <p className="text-sm">
                Host <code>drop.json</code> {listUri.trim() ? <>at <code>{listUri.trim()}</code></> : "somewhere public"}, then share:{" "}
                <code className="break-all text-azure">{`${location.origin}${import.meta.env.BASE_URL}#/app?drop=${deployed}${listUri.trim() ? "" : "&list=<url of drop.json>"}`}</code>
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
