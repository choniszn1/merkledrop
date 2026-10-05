import { NotFound, Shell } from "./Shell";
import { Workspace, type Wallet } from "./Workspace";
import { Docs } from "./pages/Docs";
import { Home } from "./pages/Home";
import { useRoute, useTitle } from "./lib/router";
import { useWallet } from "./lib/useWallet";

function AppPage({ wallet }: { wallet: Wallet }) {
  useTitle("Claim · merkledrop");
  return <Workspace wallet={wallet} />;
}

// Claim links from before the multi-page site used ?drop=…&list=… on the root URL;
// send them to the claim page with the same parameters.
const legacy = new URLSearchParams(window.location.search);
if (legacy.get("drop") && !window.location.hash.startsWith("#/app")) {
  window.history.replaceState(null, "", `${window.location.pathname}#/app?${legacy.toString()}`);
}

export default function App() {
  const route = useRoute();
  const wallet = useWallet();
  return (
    <Shell route={route} wallet={wallet} >
      {route === "/" ? <Home /> : route === "/app" ? <AppPage wallet={wallet} /> : route === "/docs" ? <Docs /> : <NotFound />}
    </Shell>
  );
}
