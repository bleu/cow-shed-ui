import React from "react";
import { useAccount, useBalance, useReadContract, useDisconnect } from "wagmi";
import { formatEther } from "viem";
import { Button } from "@bleu/ui";
import { WETH, COW } from "./common";

export function AccountInfo() {
  const account = useAccount();
  const { data: ethBalance } = useBalance({ address: account.address });
  const { disconnect } = useDisconnect();

  const { data: cowBalance } = useBalance({
    address: account.address,
    token: COW,
  });

  const { data: wethBalance } = useBalance({
    address: account.address,
    token: WETH,
  });

  return (
    <div className="mb-4">
      <h3 className="text-lg font-semibold">Account</h3>
      <p>Status: {account.status}</p>
      <p>Chain ID: {account.chainId}</p>
      <p>Address: {account.address}</p>
      <p>
        ETH Balance: {ethBalance ? formatEther(ethBalance.value) : "Loading..."}
      </p>
      <p>
        WETH Balance:{" "}
        {wethBalance ? formatEther(wethBalance.value) : "Loading..."}
      </p>
      <p>
        COW Balance: {cowBalance ? formatEther(cowBalance.value) : "Loading..."}
      </p>
      {account.status === "connected" && (
        <Button onClick={() => disconnect()} className="mt-2">
          Disconnect
        </Button>
      )}
    </div>
  );
}
