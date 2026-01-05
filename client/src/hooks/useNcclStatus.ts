import { trpc } from "../lib/trpc";

/**
 * Hook for NCCL status checks
 *
 * Usage:
 * ```tsx
 * const { alphaStatus, betaStatus, testConnectivity, isLoading, isTesting } = useNcclStatus();
 *
 * // Status is automatically fetched
 * if (alphaStatus?.healthy && betaStatus?.healthy) {
 *   // Both hosts have NCCL ready
 * }
 *
 * // Run connectivity test
 * const result = await testConnectivity();
 * if (result.success) {
 *   console.log(`Bandwidth: ${result.bandwidth} GB/s`);
 * }
 * ```
 */
export function useNcclStatus() {
  // Query NCCL status for both hosts
  const alphaQuery = trpc.ssh.nccl.getStatus.useQuery(
    { hostId: "alpha" },
    { refetchInterval: 30000 } // Refresh every 30s
  );

  const betaQuery = trpc.ssh.nccl.getStatus.useQuery(
    { hostId: "beta" },
    { refetchInterval: 30000 }
  );

  // Connectivity test mutation
  const connectivityMutation = trpc.ssh.nccl.testConnectivity.useMutation();

  // History query
  const historyQuery = trpc.ssh.nccl.getHistory.useQuery(
    { limit: 10 }
  );

  return {
    // Status data
    alphaStatus: alphaQuery.data,
    betaStatus: betaQuery.data,

    // Loading states
    isLoading: alphaQuery.isLoading || betaQuery.isLoading,
    isAlphaLoading: alphaQuery.isLoading,
    isBetaLoading: betaQuery.isLoading,

    // Error states
    alphaError: alphaQuery.error,
    betaError: betaQuery.error,

    // Refetch functions
    refetchAlpha: alphaQuery.refetch,
    refetchBeta: betaQuery.refetch,
    refetchAll: () => {
      alphaQuery.refetch();
      betaQuery.refetch();
    },

    // Connectivity test
    testConnectivity: connectivityMutation.mutateAsync,
    isTesting: connectivityMutation.isPending,
    testResult: connectivityMutation.data,
    testError: connectivityMutation.error,

    // History
    history: historyQuery.data?.history,
    fetchHistory: historyQuery.refetch,
    isLoadingHistory: historyQuery.isLoading,

    // Combined health check
    isBothHealthy: alphaQuery.data?.healthy && betaQuery.data?.healthy,
    isAnyError: !!alphaQuery.error || !!betaQuery.error,
  };
}

/**
 * Hook for just checking NCCL status on a single host
 */
export function useHostNcclStatus(hostId: "alpha" | "beta") {
  return trpc.ssh.nccl.getStatus.useQuery(
    { hostId },
    { refetchInterval: 30000 }
  );
}

/**
 * Hook for NCCL connectivity testing
 */
export function useNcclConnectivityTest() {
  const mutation = trpc.ssh.nccl.testConnectivity.useMutation();

  return {
    test: mutation.mutateAsync,
    isPending: mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * Hook for NCCL health history
 */
export function useNcclHistory(options?: { hostPair?: string; limit?: number }) {
  return trpc.ssh.nccl.getHistory.useQuery(options);
}
