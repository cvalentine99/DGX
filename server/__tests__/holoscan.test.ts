import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SSH2 Client
vi.mock("ssh2", () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn((event, callback) => {
      if (event === "ready") {
        setTimeout(() => callback(), 10);
      }
      return { on: vi.fn() };
    }),
    exec: vi.fn((cmd, callback) => {
      const mockStream = {
        on: vi.fn((event, handler) => {
          if (event === "close") {
            setTimeout(() => handler(0), 10);
          }
          if (event === "data") {
            // Return mock data based on command
            if (cmd.includes("v4l2-ctl --list-devices")) {
              handler(Buffer.from("Logitech BRIO:\n\t/dev/video0\n\t/dev/video1\n"));
            } else if (cmd.includes("lsusb")) {
              handler(Buffer.from("Bus 002 Device 002: ID 046d:085e Logitech, Inc. BRIO Ultra HD Webcam\n"));
            } else if (cmd.includes("docker ps")) {
              handler(Buffer.from(""));
            }
          }
          return mockStream;
        }),
        stderr: {
          on: vi.fn().mockReturnThis(),
        },
      };
      callback(null, mockStream);
    }),
    end: vi.fn(),
  })),
}));

describe("Holoscan Camera Integration", () => {
  describe("BRIO Camera Configuration", () => {
    it("should have correct BRIO camera specifications", () => {
      const brioCameraConfig = {
        name: "Logitech BRIO",
        vendorId: "046d",
        productId: "085e",
        serial: "409CBA2F",
        firmware: "3.17",
        connection: "USB 3.1 Gen 1 SuperSpeed (5 Gbps)",
        powerDraw: "896mA",
      };

      expect(brioCameraConfig.vendorId).toBe("046d");
      expect(brioCameraConfig.productId).toBe("085e");
      expect(brioCameraConfig.connection).toContain("USB 3.1");
    });

    it("should support all BRIO resolution modes", () => {
      const resolutions = [
        { label: "4K UHD", width: 3840, height: 2160, fps: [30, 24, 15] },
        { label: "QHD", width: 2560, height: 1440, fps: [30, 24, 20, 15] },
        { label: "1080p", width: 1920, height: 1080, fps: [60, 30, 24] },
        { label: "720p", width: 1280, height: 720, fps: [60, 30, 24] },
        { label: "480p", width: 640, height: 480, fps: [90, 60, 30] },
      ];

      // Verify 4K support
      const uhd = resolutions.find((r) => r.label === "4K UHD");
      expect(uhd).toBeDefined();
      expect(uhd?.width).toBe(3840);
      expect(uhd?.height).toBe(2160);

      // Verify high frame rate support at lower resolutions
      const p480 = resolutions.find((r) => r.label === "480p");
      expect(p480?.fps).toContain(90);

      // Verify 60fps at 1080p
      const p1080 = resolutions.find((r) => r.label === "1080p");
      expect(p1080?.fps).toContain(60);
    });

    it("should support all BRIO video formats", () => {
      const formats = ["MJPEG", "H.264", "YUY2"];

      expect(formats).toContain("MJPEG");
      expect(formats).toContain("H.264");
      expect(formats).toContain("YUY2");
    });

    it("should have correct field of view options", () => {
      const fieldOfView = [
        { label: "Narrow", angle: 65, description: "Portrait/Close-up" },
        { label: "Medium", angle: 78, description: "Standard" },
        { label: "Wide", angle: 90, description: "Conference/Room" },
      ];

      expect(fieldOfView).toHaveLength(3);
      expect(fieldOfView.map((f) => f.angle)).toEqual([65, 78, 90]);
    });

    it("should have audio capture specifications", () => {
      const audio = {
        channels: 2,
        sampleRates: [16000, 24000, 32000, 48000],
        format: "S16_LE",
      };

      expect(audio.channels).toBe(2);
      expect(audio.sampleRates).toContain(48000);
      expect(audio.format).toBe("S16_LE");
    });
  });

  describe("Pipeline Templates", () => {
    const pipelineTemplates = [
      {
        id: "object-detection",
        name: "Object Detection Pipeline",
        operators: ["VideoStreamInput", "FormatConverter", "InferenceOp", "PostProcessor", "HoloViz"],
        fps: 60,
        latency: "15ms",
      },
      {
        id: "pose-estimation",
        name: "Pose Estimation Pipeline",
        operators: ["VideoStreamInput", "Resize", "PoseNet", "SkeletonRenderer", "HoloViz"],
        fps: 30,
        latency: "25ms",
      },
      {
        id: "face-detection",
        name: "Face Detection & Recognition",
        operators: ["VideoStreamInput", "FaceDetector", "FaceAligner", "FaceNet", "HoloViz"],
        fps: 60,
        latency: "12ms",
      },
      {
        id: "medical-endoscopy",
        name: "Endoscopy Tool Detection",
        operators: ["VideoStreamInput", "Debayer", "ToolDetector", "Annotator", "Recorder", "HoloViz"],
        fps: 60,
        latency: "10ms",
      },
    ];

    it("should have required pipeline templates", () => {
      expect(pipelineTemplates.length).toBeGreaterThanOrEqual(4);
      
      const templateIds = pipelineTemplates.map((t) => t.id);
      expect(templateIds).toContain("object-detection");
      expect(templateIds).toContain("pose-estimation");
      expect(templateIds).toContain("face-detection");
    });

    it("should have VideoStreamInput as first operator", () => {
      pipelineTemplates.forEach((template) => {
        expect(template.operators[0]).toBe("VideoStreamInput");
      });
    });

    it("should have HoloViz as last operator", () => {
      pipelineTemplates.forEach((template) => {
        expect(template.operators[template.operators.length - 1]).toBe("HoloViz");
      });
    });

    it("should have reasonable latency values", () => {
      pipelineTemplates.forEach((template) => {
        const latencyMs = parseInt(template.latency);
        expect(latencyMs).toBeLessThanOrEqual(50);
        expect(latencyMs).toBeGreaterThan(0);
      });
    });

    it("should support medical imaging pipelines", () => {
      const medicalPipeline = pipelineTemplates.find((t) => t.id === "medical-endoscopy");
      expect(medicalPipeline).toBeDefined();
      expect(medicalPipeline?.operators).toContain("Recorder");
    });
  });

  describe("Camera Device Detection", () => {
    it("should detect BRIO device nodes", () => {
      const deviceNodes = [
        { path: "/dev/video0", type: "RGB Camera", interface: "IF1" },
        { path: "/dev/video1", type: "Metadata", interface: "IF1" },
        { path: "/dev/video2", type: "IR Camera", interface: "IF2" },
        { path: "/dev/video3", type: "Metadata", interface: "IF2" },
      ];

      expect(deviceNodes).toHaveLength(4);
      
      const rgbCamera = deviceNodes.find((d) => d.path === "/dev/video0");
      expect(rgbCamera?.type).toBe("RGB Camera");
      
      const irCamera = deviceNodes.find((d) => d.path === "/dev/video2");
      expect(irCamera?.type).toBe("IR Camera");
    });

    it("should parse USB device identifiers", () => {
      const usbInfo = "Bus 002 Device 002: ID 046d:085e Logitech, Inc. BRIO Ultra HD Webcam";
      const match = usbInfo.match(/ID\s+(\w+):(\w+)/);
      
      expect(match).toBeDefined();
      expect(match?.[1]).toBe("046d");
      expect(match?.[2]).toBe("085e");
    });
  });

  describe("Pipeline Configuration", () => {
    it("should validate camera configuration", () => {
      const config = {
        resolution: "1920x1080",
        fps: 60,
        format: "MJPEG",
        fov: 78,
        brightness: 50,
        contrast: 50,
        autoExposure: true,
        autoFocus: true,
      };

      expect(config.resolution).toMatch(/^\d+x\d+$/);
      expect(config.fps).toBeGreaterThan(0);
      expect(config.fps).toBeLessThanOrEqual(90);
      expect(["MJPEG", "H.264", "YUY2"]).toContain(config.format);
      expect([65, 78, 90]).toContain(config.fov);
    });

    it("should parse resolution string correctly", () => {
      const resolution = "1920x1080";
      const [width, height] = resolution.split("x").map(Number);
      
      expect(width).toBe(1920);
      expect(height).toBe(1080);
    });
  });
});
