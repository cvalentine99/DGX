import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSHConnectionPool, PoolConfig } from '../sshConnectionPool';

// Mock ssh2 Client
vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn((event, callback) => {
      if (event === 'ready') {
        // Simulate ready event after a short delay
        setTimeout(() => callback(), 10);
      }
      return this;
    }),
    connect: vi.fn(),
    exec: vi.fn((cmd, callback) => {
      const mockStream = {
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            cb(Buffer.from('mock output'));
          }
          if (event === 'close') {
            setTimeout(() => cb(0), 5);
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

describe('SSHConnectionPool', () => {
  let pool: SSHConnectionPool;

  beforeEach(() => {
    pool = new SSHConnectionPool({
      maxConnectionsPerHost: 3,
      minConnectionsPerHost: 1,
      connectionTimeoutMs: 5000,
      idleTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
      healthCheckIntervalMs: 30000,
      acquireTimeoutMs: 5000,
      maxRetries: 2,
      retryDelayMs: 500,
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('Pool Configuration', () => {
    it('should create pool with default configuration', () => {
      const defaultPool = new SSHConnectionPool();
      const status = defaultPool.getPoolStatus();
      
      expect(status.initialized).toBe(false);
      expect(status.hosts).toHaveLength(0);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<PoolConfig> = {
        maxConnectionsPerHost: 5,
        minConnectionsPerHost: 2,
      };
      
      const customPool = new SSHConnectionPool(customConfig);
      expect(customPool).toBeDefined();
    });
  });

  describe('Host Registration', () => {
    it('should register a host', () => {
      pool.registerHost({
        id: 'test-host',
        name: 'Test Host',
        host: 'localhost',
        port: 22,
        username: 'testuser',
        password: 'testpass',
      });

      const status = pool.getPoolStatus();
      expect(status.hosts).toHaveLength(1);
      expect(status.hosts[0].id).toBe('test-host');
      expect(status.hosts[0].name).toBe('Test Host');
    });

    it('should register multiple hosts', () => {
      pool.registerHost({
        id: 'host-1',
        name: 'Host 1',
        host: 'host1.local',
        port: 22,
        username: 'user1',
        password: 'pass1',
      });

      pool.registerHost({
        id: 'host-2',
        name: 'Host 2',
        host: 'host2.local',
        port: 22,
        username: 'user2',
        password: 'pass2',
      });

      const status = pool.getPoolStatus();
      expect(status.hosts).toHaveLength(2);
    });
  });

  describe('Pool Statistics', () => {
    it('should initialize stats for registered host', () => {
      pool.registerHost({
        id: 'stats-host',
        name: 'Stats Host',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      const stats = pool.getStats('stats-host');
      expect(stats).toBeDefined();
      expect(stats?.hostId).toBe('stats-host');
      expect(stats?.totalConnections).toBe(0);
      expect(stats?.activeConnections).toBe(0);
      expect(stats?.idleConnections).toBe(0);
      expect(stats?.totalBorrows).toBe(0);
      expect(stats?.savedReconnections).toBe(0);
    });

    it('should return undefined for unknown host', () => {
      const stats = pool.getStats('unknown-host');
      expect(stats).toBeUndefined();
    });

    it('should return all stats', () => {
      pool.registerHost({
        id: 'host-a',
        name: 'Host A',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      pool.registerHost({
        id: 'host-b',
        name: 'Host B',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      const allStats = pool.getAllStats();
      expect(allStats).toHaveLength(2);
    });
  });

  describe('Pool Status', () => {
    it('should report uninitialized status before init', () => {
      pool.registerHost({
        id: 'test',
        name: 'Test',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      const status = pool.getPoolStatus();
      expect(status.initialized).toBe(false);
    });

    it('should include host health status', () => {
      pool.registerHost({
        id: 'health-test',
        name: 'Health Test',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      const status = pool.getPoolStatus();
      expect(status.hosts[0]).toHaveProperty('healthy');
    });
  });

  describe('Pool Shutdown', () => {
    it('should shutdown gracefully', async () => {
      pool.registerHost({
        id: 'shutdown-test',
        name: 'Shutdown Test',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      await pool.shutdown();
      
      const status = pool.getPoolStatus();
      expect(status.initialized).toBe(false);
    });

    it('should handle multiple shutdown calls', async () => {
      await pool.shutdown();
      await pool.shutdown(); // Should not throw
    });
  });

  describe('Event Emission', () => {
    it('should emit events for pool operations', () => {
      const createdHandler = vi.fn();
      const destroyedHandler = vi.fn();

      pool.on('connection:created', createdHandler);
      pool.on('connection:destroyed', destroyedHandler);

      pool.registerHost({
        id: 'event-test',
        name: 'Event Test',
        host: 'localhost',
        port: 22,
        username: 'user',
        password: 'pass',
      });

      // Events would be emitted during actual connection operations
      expect(pool.listenerCount('connection:created')).toBe(1);
      expect(pool.listenerCount('connection:destroyed')).toBe(1);
    });
  });
});

describe('Pool Integration', () => {
  it('should track saved reconnections metric', () => {
    const pool = new SSHConnectionPool();
    
    pool.registerHost({
      id: 'reuse-test',
      name: 'Reuse Test',
      host: 'localhost',
      port: 22,
      username: 'user',
      password: 'pass',
    });

    const stats = pool.getStats('reuse-test');
    expect(stats?.savedReconnections).toBe(0);
  });

  it('should track total borrows and returns', () => {
    const pool = new SSHConnectionPool();
    
    pool.registerHost({
      id: 'borrow-test',
      name: 'Borrow Test',
      host: 'localhost',
      port: 22,
      username: 'user',
      password: 'pass',
    });

    const stats = pool.getStats('borrow-test');
    expect(stats?.totalBorrows).toBe(0);
    expect(stats?.totalReturns).toBe(0);
  });
});
