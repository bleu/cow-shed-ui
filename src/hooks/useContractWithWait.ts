import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";

export function useWriteContractWithWait() {
  const { writeContract, data, error } = useWriteContract();
  const {
    data: txReceipt,
    isLoading,
    isSuccess,
    isError,
  } = useWaitForTransactionReceipt({
    hash: data,
  });

  return { writeContract, txReceipt, isLoading, isSuccess, isError };
}
