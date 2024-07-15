import {
  getCreate2Address,
  concat,
  keccak256,
  encodeAbiParameters,
  encodePacked,
  parseAbiParameters,
  TypedDataDomain,
  Address,
  Hex,
  getContractAddress,
} from "viem";
import { FACTORY_ABI, PROXY_CREATION_CODE, SHED_ABI } from "./constants";

export interface ISdkOptions {
  factoryAddress: Address;
  proxyCreationCode?: Hex;
  implementationAddress: Address;
  chainId: number;
}

export interface ICall {
  target: Address;
  value: bigint;
  callData: Hex;
  allowFailure: boolean;
  isDelegateCall: boolean;
}

export interface IExecuteHooks {
  calls: ICall[];
  nonce: Hex;
  deadline: bigint;
}

const DOMAIN_TYPE = {
  EIP712Domain: [
    { type: "string", name: "name" },
    { type: "string", name: "version" },
    { type: "uint256", name: "chainId" },
    { type: "address", name: "verifyingContract" },
  ],
} as const;

const COW_SHED_712_TYPES = {
  ExecuteHooks: [
    { type: "Call[]", name: "calls" },
    { type: "bytes32", name: "nonce" },
    { type: "uint256", name: "deadline" },
  ],
  Call: [
    { type: "address", name: "target" },
    { type: "uint256", name: "value" },
    { type: "bytes", name: "callData" },
    { type: "bool", name: "allowFailure" },
    { type: "bool", name: "isDelegateCall" },
  ],
} as const;

export class CowShedSdk {
  constructor(private options: ISdkOptions) {}

  computeProxyAddress(user: Address): Address {
    const salt = encodeAbiParameters([{ type: "address" }], [user]);
    const initCodeHash = encodePacked(
      ["bytes", "bytes"],
      [
        this._proxyCreationCode(),
        encodeAbiParameters(
          [{ type: "address" }, { type: "address" }],
          [this.options.implementationAddress, user]
        ),
      ]
    );
    return getContractAddress({
      from: this.options.factoryAddress,
      salt,
      bytecode: initCodeHash,
      opcode: "CREATE2",
    });
  }

  computeDomainSeparator(proxy: Address): Hex {
    return keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "string name,string version,uint256 chainId,address verifyingContract"
        ),
        ["COWShed", "1.0.0", BigInt(this.options.chainId), proxy]
      )
    );
  }

  hashToSignWithProxy(
    calls: ICall[],
    nonce: Hex,
    deadline: bigint,
    proxy: Address
  ): Hex {
    return this._hashToSign(calls, nonce, deadline, proxy);
  }

  hashToSignWithUser(
    calls: ICall[],
    nonce: Hex,
    deadline: bigint,
    user: Address
  ): Hex {
    return this._hashToSign(
      calls,
      nonce,
      deadline,
      this.computeProxyAddress(user)
    );
  }

  static encodeExecuteHooksForFactory(
    calls: ICall[],
    nonce: Hex,
    deadline: bigint,
    user: Address,
    signature: Hex
  ): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "(address target, uint256 value, bytes callData, bool allowFailure, bool isDelegateCall)[] calls, bytes32 nonce, uint256 deadline, address user, bytes signature"
      ),
      [calls, nonce, deadline, user, signature]
    );
  }

  static encodeExecuteHooksForProxy(
    calls: ICall[],
    nonce: Hex,
    deadline: bigint,
    signature: Hex
  ): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "(address target, uint256 value, bytes callData, bool allowFailure, bool isDelegateCall)[] calls, bytes32 nonce, uint256 deadline, bytes signature"
      ),
      [calls, nonce, deadline, signature]
    );
  }

  static encodeEOASignature(r: bigint, s: bigint, v: number): Hex {
    return encodePacked(["uint256", "uint256", "uint8"], [r, s, v]);
  }

  private _hashToSign(
    calls: ICall[],
    nonce: Hex,
    deadline: bigint,
    proxy: Address
  ): Hex {
    const message: IExecuteHooks = {
      calls,
      nonce,
      deadline,
    };
    return keccak256(
      concat([
        "0x1901",
        this.computeDomainSeparator(proxy),
        keccak256(this._encodeExecuteHooksData(message)),
      ])
    );
  }

  private _getDomain(proxy: Address): TypedDataDomain {
    return {
      name: "COWShed",
      version: "1.0.0",
      chainId: BigInt(this.options.chainId),
      verifyingContract: proxy,
    };
  }

  private _proxyCreationCode(): Hex {
    return (this.options.proxyCreationCode ?? PROXY_CREATION_CODE) as Hex;
  }

  private _encodeExecuteHooksData(message: IExecuteHooks): Hex {
    return encodeAbiParameters(
      parseAbiParameters(
        "(address target, uint256 value, bytes callData, bool allowFailure, bool isDelegateCall)[] calls, bytes32 nonce, uint256 deadline"
      ),
      [message.calls, message.nonce, message.deadline]
    );
  }
}
