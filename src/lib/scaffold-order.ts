import { Order, computeOrderUid } from "@cowprotocol/contracts";
import { v1_1_0, MetadataApi } from "@cowprotocol/app-data";

const SETTLEMENT_CONTRACT = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

export const scaffoldOrder = async (
  order: Order,

  hooks: v1_1_0.OrderInteractionHooks,
  owner: string
) => {
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

  const domain = {
    name: "Gnosis Protocol",
    version: "v2",
    chainId: 1,
    verifyingContract: SETTLEMENT_CONTRACT,
  };
  const orderId = computeOrderUid(domain, order, owner);
  return orderId as `0x${string}`;
};
