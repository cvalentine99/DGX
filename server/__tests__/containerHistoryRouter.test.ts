import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database functions
vi.mock("../db", () => ({
  recordPullHistory: vi.fn().mockResolvedValue(1),
  updatePullHistoryStatus: vi.fn().mockResolvedValue(undefined),
  getPullHistory: vi.fn().mockResolvedValue([
    {
      id: 1,
      hostId: "alpha",
      hostName: "DGX Spark Alpha",
      hostIp: "192.168.50.139",
      imageTag: "nvcr.io/nvidia/vllm:25.11",
      action: "pull",
      status: "completed",
      userName: "Admin",
      userId: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
    },
  ]),
  getPullHistoryByHost: vi.fn().mockResolvedValue([
    {
      id: 1,
      hostId: "alpha",
      hostName: "DGX Spark Alpha",
      hostIp: "192.168.50.139",
      imageTag: "nvcr.io/nvidia/vllm:25.11",
      action: "pull",
      status: "completed",
      userName: "Admin",
      userId: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
    },
  ]),
}));

import { containerHistoryRouter } from "../containerHistoryRouter";
import { recordPullHistory, updatePullHistoryStatus, getPullHistory, getPullHistoryByHost } from "../db";

describe("containerHistoryRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recordAction", () => {
    it("should record a pull action with correct host info", async () => {
      const caller = containerHistoryRouter.createCaller({
        user: { id: 1, name: "TestUser" },
      } as any);

      const result = await caller.recordAction({
        hostId: "alpha",
        imageTag: "nvcr.io/nvidia/vllm:25.11",
        action: "pull",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
      expect(recordPullHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: "alpha",
          hostName: "DGX Spark Alpha",
          hostIp: "192.168.50.139",
          imageTag: "nvcr.io/nvidia/vllm:25.11",
          action: "pull",
          status: "started",
        })
      );
    });

    it("should record a remove action for beta host", async () => {
      const caller = containerHistoryRouter.createCaller({
        user: { id: 2, name: "Admin" },
      } as any);

      const result = await caller.recordAction({
        hostId: "beta",
        imageTag: "nvcr.io/nvidia/nemo:24.09",
        action: "remove",
      });

      expect(result.success).toBe(true);
      expect(recordPullHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: "beta",
          hostName: "DGX Spark Beta",
          hostIp: "192.168.50.110",
          action: "remove",
        })
      );
    });

    it("should use provided userName over context user", async () => {
      const caller = containerHistoryRouter.createCaller({
        user: { id: 1, name: "ContextUser" },
      } as any);

      await caller.recordAction({
        hostId: "alpha",
        imageTag: "nvcr.io/nvidia/pytorch:24.11",
        action: "update",
        userName: "CustomUser",
      });

      expect(recordPullHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          userName: "CustomUser",
        })
      );
    });
  });

  describe("updateStatus", () => {
    it("should update status to completed", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      const result = await caller.updateStatus({
        id: 1,
        status: "completed",
      });

      expect(result.success).toBe(true);
      expect(updatePullHistoryStatus).toHaveBeenCalledWith(1, "completed", undefined);
    });

    it("should update status to failed with error message", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      const result = await caller.updateStatus({
        id: 2,
        status: "failed",
        errorMessage: "Connection timeout",
      });

      expect(result.success).toBe(true);
      expect(updatePullHistoryStatus).toHaveBeenCalledWith(2, "failed", "Connection timeout");
    });
  });

  describe("getHistory", () => {
    it("should return pull history with default limit", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      const result = await caller.getHistory({});

      expect(result.history).toHaveLength(1);
      expect(result.history[0].hostId).toBe("alpha");
      expect(getPullHistory).toHaveBeenCalledWith(50);
    });

    it("should return pull history with custom limit", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      await caller.getHistory({ limit: 10 });

      expect(getPullHistory).toHaveBeenCalledWith(10);
    });
  });

  describe("getHistoryByHost", () => {
    it("should return history for specific host", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      const result = await caller.getHistoryByHost({
        hostId: "alpha",
      });

      expect(result.history).toHaveLength(1);
      expect(getPullHistoryByHost).toHaveBeenCalledWith("alpha", 20);
    });

    it("should return history for beta host with custom limit", async () => {
      const caller = containerHistoryRouter.createCaller({} as any);

      await caller.getHistoryByHost({
        hostId: "beta",
        limit: 5,
      });

      expect(getPullHistoryByHost).toHaveBeenCalledWith("beta", 5);
    });
  });
});
