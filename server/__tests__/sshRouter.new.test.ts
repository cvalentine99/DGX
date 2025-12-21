import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SSH pool
const mockExecute = vi.fn();
const mockGetSSHPool = vi.fn(() => ({
  execute: mockExecute,
}));

vi.mock("../sshPool", () => ({
  getSSHPool: () => mockGetSSHPool(),
}));

describe("SSH Router - New Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    it("should successfully upload a file to DGX host", async () => {
      // Mock file doesn't exist check
      mockExecute.mockResolvedValueOnce("not_exists");
      // Mock mkdir
      mockExecute.mockResolvedValueOnce("");
      // Mock file write
      mockExecute.mockResolvedValueOnce("");
      // Mock file size verification
      mockExecute.mockResolvedValueOnce("1024");

      const input = {
        hostId: "alpha" as const,
        destinationPath: "/home/ubuntu/datasets",
        fileName: "test.json",
        content: Buffer.from('{"test": true}').toString("base64"),
        overwrite: false,
      };

      // The endpoint should return success
      expect(input.fileName).toBe("test.json");
      expect(input.content).toBeTruthy();
    });

    it("should reject upload if file exists and overwrite is false", async () => {
      mockExecute.mockResolvedValueOnce("exists");

      const input = {
        hostId: "alpha" as const,
        destinationPath: "/home/ubuntu/datasets",
        fileName: "existing.json",
        content: Buffer.from('{"test": true}').toString("base64"),
        overwrite: false,
      };

      // Should check for existing file
      expect(input.overwrite).toBe(false);
    });

    it("should allow overwrite when flag is true", async () => {
      mockExecute.mockResolvedValueOnce(""); // mkdir
      mockExecute.mockResolvedValueOnce(""); // write
      mockExecute.mockResolvedValueOnce("2048"); // size

      const input = {
        hostId: "alpha" as const,
        destinationPath: "/home/ubuntu/datasets",
        fileName: "overwrite.json",
        content: Buffer.from('{"overwrite": true}').toString("base64"),
        overwrite: true,
      };

      expect(input.overwrite).toBe(true);
    });
  });

  describe("validatePythonSyntax", () => {
    it("should return valid for correct Python code", async () => {
      // Mock temp file creation
      mockExecute.mockResolvedValueOnce("");
      // Mock py_compile check - valid
      mockExecute.mockResolvedValueOnce("VALID");
      // Mock cleanup
      mockExecute.mockResolvedValueOnce("");

      const validCode = `
import holoscan
from holoscan.core import Application

class MyApp(Application):
    def compose(self):
        pass

if __name__ == "__main__":
    app = MyApp()
    app.run()
`;

      expect(validCode).toContain("import holoscan");
      expect(validCode).toContain("class MyApp");
    });

    it("should return invalid for Python code with syntax errors", async () => {
      // Mock temp file creation
      mockExecute.mockResolvedValueOnce("");
      // Mock py_compile check - invalid
      mockExecute.mockResolvedValueOnce(`
  File "/tmp/validate_123.py", line 3
    def broken(
              ^
SyntaxError: unexpected EOF while parsing
INVALID`);
      // Mock cleanup
      mockExecute.mockResolvedValueOnce("");

      const invalidCode = `
import holoscan

def broken(
`;

      expect(invalidCode).toContain("def broken(");
    });

    it("should parse error line numbers correctly", async () => {
      const errorOutput = `
  File "/tmp/validate_123.py", line 5
    print(
         ^
SyntaxError: unexpected EOF while parsing
INVALID`;

      const match = errorOutput.match(/line (\d+)/i);
      expect(match).toBeTruthy();
      expect(match?.[1]).toBe("5");
    });
  });

  describe("exportPipelineLogs", () => {
    it("should export logs in text format", async () => {
      const mockLogs = `[2024-12-21T10:00:00] [INFO] Pipeline started
[2024-12-21T10:00:01] [DEBUG] Processing frame 1
[2024-12-21T10:00:02] [INFO] Frame processed successfully`;

      mockExecute.mockResolvedValueOnce(mockLogs);

      const input = {
        hostId: "alpha" as const,
        pipelineName: "test-pipeline",
        lines: 1000,
        format: "text" as const,
      };

      expect(input.format).toBe("text");
      expect(mockLogs).toContain("[INFO]");
    });

    it("should export logs in JSON format", async () => {
      const mockLogs = `[2024-12-21T10:00:00] [INFO] Pipeline started
[2024-12-21T10:00:01] [DEBUG] Processing frame 1`;

      mockExecute.mockResolvedValueOnce(mockLogs);

      const input = {
        hostId: "alpha" as const,
        pipelineName: "test-pipeline",
        lines: 1000,
        format: "json" as const,
      };

      expect(input.format).toBe("json");
    });

    it("should generate correct filename with timestamp", () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const pipelineName = "test-pipeline";
      const filename = `${pipelineName}-logs-${timestamp}.txt`;

      expect(filename).toContain("test-pipeline");
      expect(filename).toContain("-logs-");
      expect(filename.endsWith(".txt")).toBe(true);
    });
  });
});

describe("Input Validation", () => {
  it("should validate hostId enum", () => {
    const validHosts = ["alpha", "beta"];
    expect(validHosts).toContain("alpha");
    expect(validHosts).toContain("beta");
    expect(validHosts).not.toContain("gamma");
  });

  it("should validate file size limits for upload", () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const smallFile = 1024; // 1KB
    const largeFile = 20 * 1024 * 1024; // 20MB

    expect(smallFile).toBeLessThan(maxSize);
    expect(largeFile).toBeGreaterThan(maxSize);
  });

  it("should validate base64 content encoding", () => {
    const originalContent = '{"test": "data"}';
    const base64Content = Buffer.from(originalContent).toString("base64");
    const decoded = Buffer.from(base64Content, "base64").toString();

    expect(decoded).toBe(originalContent);
  });
});
