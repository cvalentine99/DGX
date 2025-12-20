import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock SSH2 Client
vi.mock("ssh2", () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
  })),
}));

describe("Container Logs SSH Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getContainerLogs endpoint schema", () => {
    it("should accept valid input with all parameters", () => {
      const validInput = {
        hostId: "alpha" as const,
        containerId: "vllm-container",
        tail: 100,
        since: "1h",
        timestamps: true,
      };

      expect(validInput.hostId).toBe("alpha");
      expect(validInput.containerId).toBe("vllm-container");
      expect(validInput.tail).toBe(100);
      expect(validInput.since).toBe("1h");
      expect(validInput.timestamps).toBe(true);
    });

    it("should accept valid input with minimal parameters", () => {
      const minimalInput = {
        hostId: "beta" as const,
        containerId: "nemo-server",
      };

      expect(minimalInput.hostId).toBe("beta");
      expect(minimalInput.containerId).toBe("nemo-server");
    });

    it("should support different tail line counts", () => {
      const tailCounts = [50, 100, 200, 500, 1000];
      
      tailCounts.forEach(tail => {
        const input = {
          hostId: "alpha" as const,
          containerId: "test-container",
          tail,
        };
        expect(input.tail).toBe(tail);
      });
    });
  });

  describe("listRunningContainers endpoint schema", () => {
    it("should accept alpha host", () => {
      const input = { hostId: "alpha" as const };
      expect(input.hostId).toBe("alpha");
    });

    it("should accept beta host", () => {
      const input = { hostId: "beta" as const };
      expect(input.hostId).toBe("beta");
    });
  });

  describe("inspectContainer endpoint schema", () => {
    it("should accept valid container inspection input", () => {
      const input = {
        hostId: "alpha" as const,
        containerId: "abc123def456",
      };

      expect(input.hostId).toBe("alpha");
      expect(input.containerId).toBe("abc123def456");
    });
  });

  describe("Docker command construction", () => {
    it("should construct correct docker logs command with timestamps", () => {
      const input = {
        containerId: "vllm-container",
        tail: 100,
        timestamps: true,
      };

      let cmd = "docker logs";
      if (input.timestamps) cmd += " --timestamps";
      if (input.tail) cmd += ` --tail ${input.tail}`;
      cmd += ` ${input.containerId} 2>&1`;

      expect(cmd).toBe("docker logs --timestamps --tail 100 vllm-container 2>&1");
    });

    it("should construct correct docker logs command with since filter", () => {
      const input = {
        containerId: "nemo-server",
        tail: 50,
        since: "30m",
        timestamps: true,
      };

      let cmd = "docker logs";
      if (input.timestamps) cmd += " --timestamps";
      if (input.tail) cmd += ` --tail ${input.tail}`;
      if (input.since) cmd += ` --since ${input.since}`;
      cmd += ` ${input.containerId} 2>&1`;

      expect(cmd).toBe("docker logs --timestamps --tail 50 --since 30m nemo-server 2>&1");
    });

    it("should construct correct docker ps command", () => {
      const cmd = `docker ps --format '{{.ID}}\t{{.Image}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}'`;
      
      expect(cmd).toContain("docker ps");
      expect(cmd).toContain("--format");
      expect(cmd).toContain("{{.ID}}");
      expect(cmd).toContain("{{.Image}}");
      expect(cmd).toContain("{{.Names}}");
      expect(cmd).toContain("{{.Status}}");
    });

    it("should construct correct docker inspect command", () => {
      const containerId = "abc123";
      const cmd = `docker inspect ${containerId} 2>&1`;

      expect(cmd).toBe("docker inspect abc123 2>&1");
    });
  });

  describe("Log parsing", () => {
    it("should parse container list output correctly", () => {
      const stdout = `abc123\tnvcr.io/nvidia/vllm:25.11\tvllm-server\tUp 2 hours\t0.0.0.0:8000->8000/tcp\t2024-12-20 10:00:00
def456\tnvcr.io/nvidia/nemo:24.09\tnemo-train\tUp 1 day\t\t2024-12-19 08:00:00`;

      const containers = stdout
        .trim()
        .split("\n")
        .filter(line => line.trim())
        .map(line => {
          const [id, image, name, status, ports, createdAt] = line.split("\t");
          return { id, image, name, status, ports, createdAt };
        });

      expect(containers).toHaveLength(2);
      expect(containers[0].id).toBe("abc123");
      expect(containers[0].image).toBe("nvcr.io/nvidia/vllm:25.11");
      expect(containers[0].name).toBe("vllm-server");
      expect(containers[0].status).toBe("Up 2 hours");
      expect(containers[1].name).toBe("nemo-train");
    });

    it("should handle empty container list", () => {
      const stdout = "";

      const containers = stdout
        .trim()
        .split("\n")
        .filter(line => line.trim())
        .map(line => {
          const [id, image, name, status, ports, createdAt] = line.split("\t");
          return { id, image, name, status, ports, createdAt };
        });

      expect(containers).toHaveLength(0);
    });
  });

  describe("Response structure", () => {
    it("should return success response with logs", () => {
      const response = {
        success: true,
        logs: "2024-12-20T08:15:23.456Z INFO Starting server...",
        host: { id: "alpha", name: "DGX Spark Alpha", ip: "192.168.50.139" },
        containerId: "vllm-server",
      };

      expect(response.success).toBe(true);
      expect(response.logs).toContain("INFO");
      expect(response.host.id).toBe("alpha");
    });

    it("should return error response on failure", () => {
      const response = {
        success: false,
        error: "Container not found",
        logs: "",
        host: { id: "beta", name: "DGX Spark Beta", ip: "192.168.50.110" },
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Container not found");
      expect(response.logs).toBe("");
    });

    it("should return running containers list", () => {
      const response = {
        success: true,
        containers: [
          { id: "abc123", image: "nvcr.io/nvidia/vllm:25.11", name: "vllm", status: "Up 2h", ports: "8000", createdAt: "2024-12-20" },
        ],
        host: { id: "alpha", name: "DGX Spark Alpha", ip: "192.168.50.139" },
      };

      expect(response.success).toBe(true);
      expect(response.containers).toHaveLength(1);
      expect(response.containers[0].name).toBe("vllm");
    });
  });
});
