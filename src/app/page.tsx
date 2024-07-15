"use client";

import VestingClaimAndSwap from "@/components/vesting-claim-swap";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function App() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <>
      <VestingClaimAndSwap />
    </>
  );
}

export default App;
