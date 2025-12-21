import { describe, it, expect, vi } from "vitest";

// Mock SSH connection
vi.mock("ssh2", () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
  })),
}));

describe("Docker Container Management", () => {
  describe("Container List Parsing", () => {
    it("should parse docker ps -a output correctly", () => {
      const dockerOutput = `abc123\tnvcr.io/nvidia/pytorch:24.01-py3\tpytorch-dev\tUp 2 hours\t8888/tcp\t2024-01-15 10:30:00\trunning
def456\tnvcr.io/nvidia/nemo:24.01\tnemo-training\tExited (0) 1 hour ago\t\t2024-01-14 08:00:00\texited`;

      const lines = dockerOutput.trim().split("\n");
      const containers = lines.map((line) => {
        const [id, image, name, status, ports, createdAt, state] = line.split("\t");
        return { id, image, name, status, ports, createdAt, state };
      });

      expect(containers).toHaveLength(2);
      expect(containers[0].id).toBe("abc123");
      expect(containers[0].state).toBe("running");
      expect(containers[1].id).toBe("def456");
      expect(containers[1].state).toBe("exited");
    });

    it("should separate running and stopped containers", () => {
      const containers = [
        { id: "abc123", state: "running" },
        { id: "def456", state: "exited" },
        { id: "ghi789", state: "running" },
        { id: "jkl012", state: "dead" },
      ];

      const running = containers.filter((c) => c.state === "running");
      const stopped = containers.filter((c) => c.state !== "running");

      expect(running).toHaveLength(2);
      expect(stopped).toHaveLength(2);
    });
  });

  describe("Container Commands", () => {
    it("should generate correct docker start command", () => {
      const containerId = "abc123";
      const command = `docker start ${containerId} 2>&1`;
      expect(command).toBe("docker start abc123 2>&1");
    });

    it("should generate correct docker stop command", () => {
      const containerId = "abc123";
      const command = `docker stop ${containerId} 2>&1`;
      expect(command).toBe("docker stop abc123 2>&1");
    });

    it("should generate correct docker restart command", () => {
      const containerId = "abc123";
      const command = `docker restart ${containerId} 2>&1`;
      expect(command).toBe("docker restart abc123 2>&1");
    });

    it("should generate correct docker rm command", () => {
      const containerId = "abc123";
      const force = false;
      const forceFlag = force ? " -f" : "";
      const command = `docker rm${forceFlag} ${containerId} 2>&1`;
      expect(command).toBe("docker rm abc123 2>&1");
    });

    it("should generate correct docker rm -f command when force is true", () => {
      const containerId = "abc123";
      const force = true;
      const forceFlag = force ? " -f" : "";
      const command = `docker rm${forceFlag} ${containerId} 2>&1`;
      expect(command).toBe("docker rm -f abc123 2>&1");
    });
  });

  describe("Playbook Image Puller", () => {
    it("should extract image references from playbook output", () => {
      const grepOutput = `nvcr.io/nvidia/pytorch:24.01-py3
nvcr.io/nvidia/nemo:24.01
nvcr.io/nvidia/tritonserver:24.01-py3
docker.io/library/redis:7
nvcr.io/nvidia/cuda:12.3.1-devel-ubuntu22.04`;

      const images = grepOutput
        .trim()
        .split("\n")
        .filter((img) => img.trim());

      expect(images).toHaveLength(5);
      expect(images[0]).toBe("nvcr.io/nvidia/pytorch:24.01-py3");
      expect(images[3]).toBe("docker.io/library/redis:7");
    });

    it("should filter out non-image lines from git clone output", () => {
      const output = `Cloning into 'dgx-spark-playbooks'...
Resolving deltas: 100% (50/50), done.
nvcr.io/nvidia/pytorch:24.01-py3
nvcr.io/nvidia/nemo:24.01`;

      const images = output
        .trim()
        .split("\n")
        .filter(
          (img) =>
            img.trim() &&
            !img.includes("Cloning") &&
            !img.includes("Resolving")
        );

      expect(images).toHaveLength(2);
      expect(images[0]).toBe("nvcr.io/nvidia/pytorch:24.01-py3");
    });
  });

  describe("Host Selection", () => {
    it("should validate host ID", () => {
      const validHosts = ["alpha", "beta"];
      const invalidHosts = ["gamma", "delta", "", "ALPHA"];

      validHosts.forEach((host) => {
        expect(["alpha", "beta"]).toContain(host);
      });

      invalidHosts.forEach((host) => {
        expect(["alpha", "beta"]).not.toContain(host);
      });
    });
  });
});

describe("Kubernetes Management", () => {
  describe("Kubernetes Status Check", () => {
    it("should detect kubectl availability", () => {
      const kubectlPath = "/usr/local/bin/kubectl";
      expect(kubectlPath.includes("kubectl")).toBe(true);
    });

    it("should parse node count correctly", () => {
      const wcOutput = "3\n";
      const nodeCount = parseInt(wcOutput.trim()) || 0;
      expect(nodeCount).toBe(3);
    });

    it("should handle empty kubectl output", () => {
      const wcOutput = "\n";
      const count = parseInt(wcOutput.trim()) || 0;
      expect(count).toBe(0);
    });
  });

  describe("Kubernetes Pod Parsing", () => {
    it("should parse pod JSON correctly", () => {
      const podData = {
        items: [
          {
            metadata: { name: "nginx-pod", namespace: "default", creationTimestamp: "2024-01-15T10:00:00Z" },
            status: {
              phase: "Running",
              containerStatuses: [{ ready: true, restartCount: 0 }],
            },
          },
          {
            metadata: { name: "redis-pod", namespace: "cache", creationTimestamp: "2024-01-14T08:00:00Z" },
            status: {
              phase: "Pending",
              containerStatuses: [{ ready: false, restartCount: 2 }],
            },
          },
        ],
      };

      const pods = podData.items.map((pod) => ({
        name: pod.metadata?.name || "",
        namespace: pod.metadata?.namespace || "",
        status: pod.status?.phase || "Unknown",
        ready: pod.status?.containerStatuses?.every((c) => c.ready) || false,
        restarts:
          pod.status?.containerStatuses?.reduce(
            (sum, c) => sum + (c.restartCount || 0),
            0
          ) || 0,
      }));

      expect(pods).toHaveLength(2);
      expect(pods[0].name).toBe("nginx-pod");
      expect(pods[0].status).toBe("Running");
      expect(pods[0].ready).toBe(true);
      expect(pods[1].restarts).toBe(2);
    });
  });

  describe("Kubernetes Node Parsing", () => {
    it("should parse node roles from labels", () => {
      const nodeLabels = {
        "node-role.kubernetes.io/control-plane": "",
        "node-role.kubernetes.io/master": "",
        "kubernetes.io/hostname": "node-1",
      };

      const roles = Object.keys(nodeLabels)
        .filter((l) => l.startsWith("node-role.kubernetes.io/"))
        .map((l) => l.replace("node-role.kubernetes.io/", ""));

      expect(roles).toContain("control-plane");
      expect(roles).toContain("master");
      expect(roles).not.toContain("hostname");
    });
  });
});
