import React, { useState } from "react";
import { erc20Abi, parseEther } from "viem";
import { Button, Input } from "@bleu/ui";
import { WETH, VESTING_ESCROW_FACTORY, createVest } from "./common";
import {
  useAccount,
  useClient,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { vestingFactoryAbi } from "./abi";

import {
  ContractFunctionExecutionError,
  ContractFunctionExecutionErrorType,
  ContractFunctionRevertedError,
  decodeErrorResult,
} from "viem";
import { useWriteContractWithWait } from "@/hooks/useContractWithWait";

export function CreateVestingContract() {
  const [vestingAmount, setVestingAmount] = useState("1");
  const [vestingDuration, setVestingDuration] = useState("500");

  const { writeContract, txReceipt, isLoading, isSuccess, isError } =
    useWriteContractWithWait();

  const account = useAccount();

  if (!account.address || !account.chain) return null;

  return (
    <>
      <div className="mb-6">
        {/* give allownce to vesting contract to use  */}
        <h3 className="text-lg font-semibold mb-2">Approve WETH</h3>
        <Input
          placeholder="Amount (ETH)"
          value={vestingAmount}
          onChange={(e) => setVestingAmount(e.target.value)}
          className="mb-2"
        />
        <Button
          onClick={() => {
            writeContract({
              address: WETH,
              abi: erc20Abi,
              functionName: "approve",
              args: [VESTING_ESCROW_FACTORY, parseEther(vestingAmount)],
            });
          }}
          disabled={isLoading}
          className="mt-2"
        >
          {isLoading ? "Approving..." : "Approve WETH"}
        </Button>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Create Vesting Contract</h3>
        <Input
          placeholder="Vesting Amount (ETH)"
          value={vestingAmount}
          onChange={(e) => setVestingAmount(e.target.value)}
          className="mb-2"
        />
        <Input
          placeholder="Vesting Duration"
          value={vestingDuration}
          onChange={(e) => setVestingDuration(e.target.value)}
          className="mb-2"
        />
        <Button
          onClick={() => {
            writeContract({
              address: VESTING_ESCROW_FACTORY,
              abi: vestingFactoryAbi,
              functionName: "deploy_vesting_contract",
              args: [
                WETH,
                "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                parseEther(vestingAmount),
                500n,
              ],
            });
          }}
          disabled={isLoading}
          className="mt-2"
        >
          {isLoading ? "Creating..." : "Create Vesting Contract"}
        </Button>
        {isSuccess && (
          <p className="mt-2 text-green-500">
            Vesting Contract created! Address: {txReceipt?.logs[0].address}
          </p>
        )}
        {isError && (
          <p className="text-red-500">Error creating vesting contract</p>
        )}
      </div>
    </>
  );
}
