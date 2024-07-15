import React, { useState } from "react";
import {
  parseEther,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  Hex,
  Address,
  stringToBytes,
  bytesToString,
  gweiUnits,
} from "viem";
import { Button, Input } from "@bleu/ui";
import {
  WETH,
  COW,
  VAULT_RELAYER,
  fnCalldata,
  SETTLEMENT_CONTRACT,
} from "./common";
import { useWriteContractWithWait } from "../hooks/useContractWithWait";
import { scaffoldOrder } from "../lib/scaffold-order";
import {
  useAccount,
  useWalletClient,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CowShedSdk, ICall } from "./cow-shed";
import { Order, OrderKind, OrderBalance } from "@cowprotocol/contracts";
import { settlementAbi } from "./abi";

export function CreateOrderWithHooks() {
  const [factoryAddress, setFactoryAddress] = useState<Address>("");
  const [implementationAddress, setImplementationAddress] =
    useState<Address>("");
  const [sellAmount, setSellAmount] = useState("1");
  const [buyAmount, setBuyAmount] = useState("1000");
  const [vestingContractAddress, setVestingContractAddress] =
    useState<Address>("");

  const { writeContract, data, error } = useWriteContract();
  const {
    data: txReceipt,
    isLoading,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash: data,
  });

  console.log({ error });

  const account = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const handleCreateOrderWithHooks = async () => {
    if (!account.address || !walletClient || !publicClient) return;

    // Approve WETH for VAULT_RELAYER
    // writeContract({
    //   address: WETH,
    //   abi: [
    //     {
    //       name: "approve",
    //       type: "function",
    //       inputs: [
    //         { name: "spender", type: "address" },
    //         { name: "amount", type: "uint256" },
    //       ],
    //       outputs: [{ name: "", type: "bool" }],
    //     },
    //   ],
    //   functionName: "approve",
    //   args: [VAULT_RELAYER, parseEther(sellAmount)],
    // });

    const shedSdk = new CowShedSdk({
      factoryAddress,
      implementationAddress,
      chainId: account.chainId!,
    });

    const validTo = Math.floor(Date.now() / 1000) + 7200;

    const order: Order = {
      sellToken: WETH,
      buyToken: COW,
      receiver: account.address,
      sellAmount: parseEther(sellAmount),
      buyAmount: parseEther(buyAmount),
      validTo: validTo,
      appData: "",
      feeAmount: 0n,
      kind: OrderKind.SELL,
      partiallyFillable: true,
      sellTokenBalance: OrderBalance.ERC20,
      buyTokenBalance: OrderBalance.ERC20,
    };

    // Pre-hooks for claiming from vesting contract
    const calls: ICall[] = [
      {
        target: vestingContractAddress,
        callData: fnCalldata(
          "claim(address)",
          encodeAbiParameters([{ type: "address" }], [account.address])
        ),
        value: 0n,
        isDelegateCall: false,
        allowFailure: false,
      },
    ];

    const nonce = bytesToString(
      stringToBytes("first", { size: 32 })
    ) as `0x${string}`;

    const hashToSign = shedSdk.hashToSignWithUser(
      calls,
      nonce,
      BigInt(validTo),
      account.address
    );
    const signature = await walletClient.signMessage({
      message: { raw: hashToSign as Hex },
    });

    const encodedSignature = CowShedSdk.encodeEOASignature(
      BigInt(signature.slice(0, 66)),
      BigInt(`0x${signature.slice(66, 130)}`),
      parseInt(signature.slice(130, 132), 16)
    );

    const hooksCalldata = CowShedSdk.encodeExecuteHooksForFactory(
      calls,
      nonce,
      BigInt(validTo),
      account.address,
      encodedSignature
    );

    const hooks = {
      pre: [
        {
          target: factoryAddress,
          callData: hooksCalldata,
          gasLimit: "100000",
        },
      ],
    };

    const orderId = await scaffoldOrder(order, hooks, account.address);

    writeContract({
      address: SETTLEMENT_CONTRACT,
      abi: settlementAbi,
      functionName: "setPreSignature",
      args: [orderId, true],
    });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Create Order with Hooks</h3>
      <Input
        placeholder="Factory Address"
        value={factoryAddress}
        onChange={(e) => setFactoryAddress(e.target.value as Address)}
        className="mb-2"
      />
      <Input
        placeholder="Implementation Address"
        value={implementationAddress}
        onChange={(e) => setImplementationAddress(e.target.value as Address)}
        className="mb-2"
      />
      <Input
        placeholder="Vesting Contract Address"
        value={vestingContractAddress}
        onChange={(e) => setVestingContractAddress(e.target.value as Address)}
        className="mb-2"
      />
      <Input
        placeholder="Sell Amount (ETH)"
        value={sellAmount}
        onChange={(e) => setSellAmount(e.target.value)}
        className="mb-2"
      />
      <Input
        placeholder="Buy Amount (COW)"
        value={buyAmount}
        onChange={(e) => setBuyAmount(e.target.value)}
        className="mb-2"
      />
      <Button onClick={handleCreateOrderWithHooks} className="mt-2">
        Create Order with Hooks
      </Button>
      {isLoading && <p className="text-blue-500">Creating order...</p>}
      {isSuccess && (
        <p className="text-green-500">Order created successfully!</p>
      )}
      {isError && <p className="text-red-500">Error creating order</p>}
    </div>
  );
}
