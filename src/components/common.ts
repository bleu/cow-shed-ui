import {
  PublicClient,
  WalletClient,
  Address,
  encodeFunctionData,
  getAddress,
  slice,
  encodePacked,
  toHex,
} from "viem";
import { Order as CoWOrder, SigningScheme } from "@cowprotocol/contracts";
import { v1_1_0, MetadataApi } from "@cowprotocol/app-data";
import {
  createPublicClient,
  http,
  createWalletClient,
  Hex,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  Chain,
} from "viem";
import { mainnet } from "viem/chains";
import {
  OrderBalance,
  OrderKind,
  computeOrderUid,
} from "@cowprotocol/contracts";
import { settlementAbi } from "./abi";
import { waitForTransactionReceipt } from "viem/actions";

interface Order extends CoWOrder {
  sellToken: Address;
  buyToken: Address;
  receiver?: Address;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: Date;
  appData: `0x${string}`;
  feeAmount: bigint;
}

export const VESTING_ESCROW_FACTORY =
  "0xcf61782465ff973638143d6492b51a85986ab347"; // llama pay
export const SETTLEMENT_CONTRACT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
export const SOLVER = "0x4339889FD9dFCa20a423fbA011e9dfF1C856CAEb";
export const ENS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
export const USDC_BALANCE_OF_SLOT = 0x09n;
export const VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";
export const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
export const VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B";
export const ETH_A_JOIN = "0x2F0b23f53734252Bda2277357e97e1517d6B042A";
export const DAI_JOIN = "0x9759A6Ac90977b93B58547b4A71c78317f391A28";
export const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
export const COW = "0xdef1ca1fb7fbcdc777520aa7f396b4e015f497ab";

const CHAIN = mainnet;

export const createViemPublicClient = (rpcUrl: string) => {
  return createPublicClient({
    chain: CHAIN,
    transport: http(rpcUrl),
  });
};

export const createViemWalletClient = (rpcUrl: string, privateKey: Hex) => {
  return createWalletClient({
    chain: mainnet,
    transport: http(rpcUrl),
    account: privateKey,
  });
};

export const createVest = async ({
  client,
  chain,
  address,
  token,
  receiver,
  amount,
  vesting_duration,
}: {
  client: WalletClient;
  chain: Chain;
  address: Address;
  token: string;
  receiver: string;
  amount: bigint;
  vesting_duration: bigint;
}) => {
  // await approveToken(provider, token, funder, VESTING_ESCROW_FACTORY, amount);
  console.log(`creating vesting contract`);
  // const signer = await getSigner(provider, funder);
  const tx = await client.sendTransaction({
    chain,
    account: address,
    to: VESTING_ESCROW_FACTORY,
    data: encodeFunctionData({
      functionName: "deploy_vesting_contract",
      abi: [
        {
          name: "deploy_vesting_contract",
          type: "function",
          inputs: [
            { name: "token", type: "address" },
            { name: "receiver", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "vesting_duration", type: "uint256" },
          ],
          outputs: [{ name: "", type: "address" }],
        },
      ],
      args: [token, receiver, amount, vesting_duration],
    }),
  });

  const receipt = await waitForTransactionReceipt(client, { hash: tx });

  if (!receipt?.logs[0].topics[2]) return;

  const vestingContractAddr = slice(receipt?.logs[0].topics[2], 12);
  console.log(`vesting contract created at ${vestingContractAddr}`);
  return vestingContractAddr as string;
};

export const wrapEther = async (
  client: WalletClient,
  address: Address,
  amount: bigint,
  chain: Chain
) => {
  console.log(`wrapping ${amount} ether for ${address}...`);
  const hash = await client.sendTransaction({
    chain,
    account: address,
    to: WETH,
    data: encodeFunctionData({
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
    }),
    value: amount,
  });
  return hash;
};

export const approveToken = async (
  client: WalletClient,
  token: Address,
  owner: Address,
  spender: Address,
  chain: Chain,
  amount: bigint
) => {
  console.log(
    `approving ${amount}(n) ${token}(token) tokens of ${owner}(owner) to ${spender}(spender)...`
  );
  const hash = await client.sendTransaction({
    account: owner,
    to: token,
    chain: chain,
    data: encodeFunctionData({
      abi: [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [spender, amount],
    }),
  });
  return hash;
};

export const createOrder = async (
  client: WalletClient,
  publicClient: PublicClient,
  order: Order,
  hooks: v1_1_0.OrderInteractionHooks,
  owner: Address,
  chain: Chain
) => {
  console.log(`Creating order for user: ${owner}`, order);
  const metadataApi = new MetadataApi();
  const appDataDoc = await metadataApi.generateAppDataDoc({
    appCode: "CoW Swap",
    environment: "production",
    metadata: {
      hooks,
    },
  });
  const { appDataHex } = await metadataApi.appDataToCid(appDataDoc);
  order.appData = appDataHex;

  const chainId = await publicClient.getChainId();

  const domain = {
    name: "Gnosis Protocol",
    version: "v2",
    chainId,
    verifyingContract: SETTLEMENT_CONTRACT,
  };
  const orderId = computeOrderUid(domain, order, owner);

  const hash = await client.sendTransaction({
    account: owner,
    to: SETTLEMENT_CONTRACT,
    chain: chain,
    data: encodeFunctionData({
      abi: [
        {
          name: "setPreSignature",
          type: "function",
          inputs: [
            { name: "orderUid", type: "bytes" },
            { name: "signed", type: "bool" },
          ],
          outputs: [],
        },
      ],
      functionName: "setPreSignature",
      args: [orderId, true],
    }),
  });
  return hash;
};

export const getTokenBalance = async (
  client: PublicClient,
  token: Address,
  owner: Address
): Promise<bigint> => {
  const balance = await client.readContract({
    address: token,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: [owner],
  });
  return balance as bigint;
};

export const fnSelector = (sig: string): Hex => {
  return keccak256(toHex(sig)).slice(0, 10) as Hex;
};

export const fnCalldata = (sig: string, encodedData: Hex): Hex => {
  return encodePacked(["bytes4", "bytes"], [fnSelector(sig), encodedData]);
};

export const getOrderFlags = (
  order: Order,
  signingScheme: SigningScheme
): bigint => {
  let flags = 0;
  flags = order.kind === OrderKind.BUY ? (flags |= 0x01) : flags;
  flags = order.partiallyFillable ? (flags |= 0x02) : flags;

  if (order.sellTokenBalance === OrderBalance.EXTERNAL) flags |= 0x08;
  if (order.sellTokenBalance === OrderBalance.INTERNAL) flags |= 0x0c;

  if (order.buyTokenBalance === OrderBalance.INTERNAL) flags |= 0x10;

  switch (signingScheme) {
    case SigningScheme.EIP712: {
      // do nothing
      break;
    }
    case SigningScheme.ETHSIGN: {
      flags |= 0x20;
      break;
    }
    case SigningScheme.EIP1271: {
      flags |= 0x40;
      break;
    }
    case SigningScheme.PRESIGN: {
      flags |= 0x60;
      break;
    }
  }

  return BigInt(flags);
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const balanceOfSlot = (mappingSlot: bigint, owner: Address): Hex => {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, uint256"), [
      owner,
      mappingSlot,
    ])
  );
};

export const estimateGasForExecuteHooks = async (
  client: PublicClient,
  to: Address,
  calldata: Hex,
  mockBalance: () => Promise<any>,
  resetBalance: () => Promise<any>
): Promise<bigint> => {
  await mockBalance();
  try {
    const gas = await client.estimateGas({ to, data: calldata });
    return gas;
  } catch (err) {
    throw new Error("couldn't estimate gas");
  } finally {
    await resetBalance();
  }
};

// Note: The following functions might not have direct viem equivalents and might need to be adapted based on your specific setup
// vatHope, joinEth, resolveName, getIlk

export const settleOrder = async (
  publicClient: PublicClient,
  walletClient: WalletClient,
  order: Order,
  hooks: v1_1_0.OrderInteractionHooks,
  owner: Address
) => {
  console.log(`Settling order for user: ${owner}`, order);

  const settlementBalance = await getTokenBalance(
    publicClient,
    order.buyToken,
    SETTLEMENT_CONTRACT
  );

  if (settlementBalance < order.buyAmount) {
    throw new Error(
      `Settlement contract cannot fund the swap. balance: ${settlementBalance}, required: ${order.buyAmount}`
    );
  }

  const sellAmount = BigInt(order.sellAmount.toString());
  // to simulate execution surplus, buyAmount is the minOut, we are going to simulate
  // that it receives 100 units more
  const buyAmountForExecution = BigInt(order.buyAmount.toString()) + 100n;
  const [sellTokenPrice, buyTokenPrice]: [bigint, bigint] =
    sellAmount > buyAmountForExecution
      ? [1n, sellAmount / buyAmountForExecution]
      : [buyAmountForExecution / sellAmount, 1n];
  const buyAmount = BigInt(order.buyAmount.toString());

  const settleData = encodeFunctionData({
    abi: settlementAbi,
    functionName: "settle",
    args: [
      [order.sellToken, order.buyToken],
      [sellTokenPrice, buyTokenPrice],
      [
        {
          sellTokenIndex: 0n,
          buyTokenIndex: 1n,
          receiver: order.receiver || owner,
          sellAmount,
          buyAmount,
          validTo: new Date(order.validTo).getTime() / 1000,
          appData: order.appData,
          feeAmount: order.feeAmount,
          flags: getOrderFlags(order, SigningScheme.PRESIGN),
          executedAmount: sellAmount,
          signature: owner, // viem will handle the solidityPacked encoding
        },
      ],
      [
        (hooks.pre || []).map((x) => ({
          target: x.target,
          value: 0n,
          callData: x.callData,
        })),
        [],
        (hooks.post || []).map((x) => ({
          target: x.target,
          value: 0n,
          callData: x.callData,
        })),
      ],
    ],
  });

  const hash = await walletClient.sendTransaction({
    chain: CHAIN,
    account: SOLVER,
    to: SETTLEMENT_CONTRACT,
    data: settleData,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "reverted") {
    throw new Error("Settle failed");
  }

  return receipt;
};
