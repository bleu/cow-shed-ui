"use client";

import React from "react";
import { useAccount, useConnect } from "wagmi";
import { Card, CardHeader, CardContent, CardFooter, Button } from "@bleu/ui";
import {
  AlertDialog as Alert,
  AlertDialogDescription as AlertDescription,
} from "@bleu/ui";
import { AccountInfo } from "./account-info";
import { WrapETH } from "./wrap-eth";
import { CreateVestingContract } from "./create-vesting";
import { CreateOrderWithHooks } from "./create-order";

export default function VestingClaimAndSwap() {
  const account = useAccount();
  const {
    connectors,
    connect,
    status: connectStatus,
    error: connectError,
  } = useConnect();

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <h2 className="text-2xl font-bold">Vesting Claim and Swap</h2>
      </CardHeader>
      <CardContent>
        <AccountInfo />

        {account.status !== "connected" ? (
          <div>
            <h3 className="text-lg font-semibold mb-2">Connect</h3>
            {connectors.map((connector) => (
              <Button
                key={connector.uid}
                onClick={() => connect({ connector })}
                className="mr-2 mb-2"
              >
                {connector.name}
              </Button>
            ))}
            {connectStatus === "pending" && <p>Connecting...</p>}
            {connectError && (
              <Alert>
                <AlertDescription>{connectError.message}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <>
            <WrapETH />
            <CreateVestingContract />
            <CreateOrderWithHooks />
          </>
        )}
      </CardContent>
    </Card>
  );
}
