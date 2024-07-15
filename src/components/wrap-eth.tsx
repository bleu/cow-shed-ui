import React, { useState } from "react";
import { parseEther } from "viem";
import { Button, Input } from "@bleu/ui";
import { WETH } from "./common";
import { useWriteContractWithWait } from "../hooks/useContractWithWait";
import { writeContract } from "viem/actions";

export function WrapETH() {
  const [amount, setAmount] = useState("");
  const { writeContract, isLoading, isSuccess, isError } =
    useWriteContractWithWait();

  const handleWrap = async () => {
    writeContract({
      address: WETH,
      abi: [
        {
          name: "deposit",
          type: "function",
          stateMutability: "payable",
          inputs: [],
          outputs: [],
        },
      ],
      functionName: "deposit",
      value: parseEther(amount),
    });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Wrap ETH</h3>
      <Input
        placeholder="ETH Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mb-2"
      />
      <Button onClick={handleWrap} disabled={isLoading}>
        {isLoading ? "Wrapping..." : "Wrap ETH"}
      </Button>
      {isSuccess && <p className="text-green-500">ETH wrapped successfully!</p>}
      {isError && <p className="text-red-500">Error wrapping ETH</p>}
    </div>
  );
}
