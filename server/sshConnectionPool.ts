/**
 * SSH Connection Pool Manager
 * 
 * Maintains persistent SSH connections to DGX Spark hosts with:
 * - Connection keep-alive with periodic heartbeat
 * - Automatic reconnection on failure
 * - Connection borrowing/returning for concurrent operations
 * - Health monitoring and statistics
 */

import { Client, ConnectConfig } from "ssh2";
import { EventEmitter } from "events";

// Pool configuration
export interface PoolConfig {
  maxConnectionsPerHost: number;
  minConnectionsPerHost: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  keepAliveIntervalMs: number;
  healthCheckIntervalMs: number;
  acquireTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
}

// Default pool configuration
const DEFAULT_CONFIG: PoolConfig = {
  maxConnectionsPerHost: 3,
  minConnectionsPerHost: 1,
  connectionTimeoutMs: 15000,
  idleTimeoutMs: 300000, // 5 minutes
  keepAliveIntervalMs: 30000, // 30 seconds
  healthCheckIntervalMs: 60000, // 1 minute
  acquireTimeoutMs: 10000,
  maxRetries: 3,
  retryDelayMs: 1000,
};

// Host configuration
export interface HostConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

// Pooled connection wrapper
interface PooledConnection {
  id: string;
  client: Client;
  hostId: string;
  createdAt: number;
  lastUsedAt: number;
  lastHealthCheck: number;
  inUse: boolean;
  healthy: boolean;
  keepAliveTimer?: NodeJS.Timeout;
}

// Pool statistics
export interface PoolStats {
  hostId: string;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  healthyConnections: number;
  failedConnections: number;
  totalBorrows: number;
  totalReturns: number;
  totalCreated: number;
  totalDestroyed: number;
  averageWaitTimeMs: number;
  savedReconnections: number;
}

// Connection pool events
export interface PoolEvents {
  'connection:created': (hostId: string, connectionId: string) => void;
  'connection:destroyed': (hostId: string, connectionId: string, reason: string) => void;
  'connection:borrowed': (hostId: string, connectionId: string) => void;
  'connection:returned': (hostId: string, connectionId: string) => void;
  'connection:error': (hostId: string, connectionId: string, error: Error) => void;
  'pool:healthy': (hostId: string) => void;
  'pool:unhealthy': (hostId: string, reason: string) => void;
}

// Generate unique connection ID
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * SSH Connection Pool
 * 
 * Manages a pool of SSH connections per host with automatic lifecycle management.
 */
export class SSHConnectionPool extends EventEmitter {
  private config: PoolConfig;
  private hosts: Map<string, HostConfig> = new Map();
  private pools: Map<string, PooledConnection[]> = new Map();
  private stats: Map<string, PoolStats> = new Map();
  private waitQueues: Map<string, Array<{
    resolve: (conn: PooledConnection) => void;
    reject: (err: Error) => void;
    timestamp: number;
  }>> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private initialized: boolean = false;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a host with the connection pool
   */
  registerHost(hostConfig: HostConfig): void {
    this.hosts.set(hostConfig.id, hostConfig);
    this.pools.set(hostConfig.id, []);
    this.waitQueues.set(hostConfig.id, []);
    this.stats.set(hostConfig.id, {
      hostId: hostConfig.id,
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      healthyConnections: 0,
      failedConnections: 0,
      totalBorrows: 0,
      totalReturns: 0,
      totalCreated: 0,
      totalDestroyed: 0,
      averageWaitTimeMs: 0,
      savedReconnections: 0,
    });

    console.log(`[SSH Pool] Registered host: ${hostConfig.name} (${hostConfig.id})`);
  }

  /**
   * Initialize the pool with minimum connections
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[SSH Pool] Initializing connection pool...');

    for (const [hostId, hostConfig] of Array.from(this.hosts.entries())) {
      // Pre-warm connections
      for (let i = 0; i < this.config.minConnectionsPerHost; i++) {
        try {
          await this.createConnection(hostId);
          console.log(`[SSH Pool] Pre-warmed connection ${i + 1}/${this.config.minConnectionsPerHost} for ${hostConfig.name}`);
        } catch (error) {
          console.warn(`[SSH Pool] Failed to pre-warm connection for ${hostConfig.name}:`, error);
        }
      }

      // Start health check timer
      this.startHealthCheck(hostId);
    }

    this.initialized = true;
    console.log('[SSH Pool] Connection pool initialized');
  }

  /**
   * Create a new connection for a host
   */
  private async createConnection(hostId: string): Promise<PooledConnection> {
    const hostConfig = this.hosts.get(hostId);
    if (!hostConfig) {
      throw new Error(`Unknown host: ${hostId}`);
    }

    const connectionId = generateConnectionId();
    const client = new Client();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        client.end();
        reject(new Error(`Connection timeout after ${this.config.connectionTimeoutMs}ms`));
      }, this.config.connectionTimeoutMs);

      client.on('ready', () => {
        clearTimeout(timeoutId);

        const pooledConn: PooledConnection = {
          id: connectionId,
          client,
          hostId,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          lastHealthCheck: Date.now(),
          inUse: false,
          healthy: true,
        };

        // Set up keep-alive
        this.setupKeepAlive(pooledConn);

        // Add to pool
        const pool = this.pools.get(hostId) || [];
        pool.push(pooledConn);
        this.pools.set(hostId, pool);

        // Update stats
        const stats = this.stats.get(hostId)!;
        stats.totalConnections++;
        stats.idleConnections++;
        stats.healthyConnections++;
        stats.totalCreated++;

        this.emit('connection:created', hostId, connectionId);
        console.log(`[SSH Pool] Created connection ${connectionId} for ${hostConfig.name}`);

        resolve(pooledConn);
      });

      client.on('error', (err) => {
        clearTimeout(timeoutId);
        this.emit('connection:error', hostId, connectionId, err);
        reject(err);
      });

      client.on('close', () => {
        this.handleConnectionClose(hostId, connectionId);
      });

      // Build connection config
      const connectConfig: ConnectConfig = {
        host: hostConfig.host,
        port: hostConfig.port,
        username: hostConfig.username,
        readyTimeout: this.config.connectionTimeoutMs,
        keepaliveInterval: this.config.keepAliveIntervalMs,
        keepaliveCountMax: 3,
      };

      if (hostConfig.privateKey) {
        connectConfig.privateKey = hostConfig.privateKey;
      } else if (hostConfig.password) {
        connectConfig.password = hostConfig.password;
      }

      client.connect(connectConfig);
    });
  }

  /**
   * Set up keep-alive for a connection
   */
  private setupKeepAlive(conn: PooledConnection): void {
    if (conn.keepAliveTimer) {
      clearInterval(conn.keepAliveTimer);
    }

    conn.keepAliveTimer = setInterval(() => {
      if (!conn.inUse && conn.healthy) {
        // Send a simple command to keep connection alive
        conn.client.exec('echo 1', (err) => {
          if (err) {
            console.warn(`[SSH Pool] Keep-alive failed for ${conn.id}:`, err.message);
            conn.healthy = false;
          }
        });
      }
    }, this.config.keepAliveIntervalMs);
  }

  /**
   * Handle connection close event
   */
  private handleConnectionClose(hostId: string, connectionId: string): void {
    const pool = this.pools.get(hostId);
    if (!pool) return;

    const index = pool.findIndex(c => c.id === connectionId);
    if (index !== -1) {
      const conn = pool[index];
      if (conn.keepAliveTimer) {
        clearInterval(conn.keepAliveTimer);
      }
      pool.splice(index, 1);

      const stats = this.stats.get(hostId)!;
      stats.totalConnections--;
      if (conn.inUse) {
        stats.activeConnections--;
      } else {
        stats.idleConnections--;
      }
      if (conn.healthy) {
        stats.healthyConnections--;
      }
      stats.totalDestroyed++;

      this.emit('connection:destroyed', hostId, connectionId, 'closed');
      console.log(`[SSH Pool] Connection ${connectionId} closed for ${hostId}`);
    }
  }

  /**
   * Start health check timer for a host
   */
  private startHealthCheck(hostId: string): void {
    const timer = setInterval(async () => {
      await this.performHealthCheck(hostId);
    }, this.config.healthCheckIntervalMs);

    this.healthCheckTimers.set(hostId, timer);
  }

  /**
   * Perform health check on all connections for a host
   */
  private async performHealthCheck(hostId: string): Promise<void> {
    const pool = this.pools.get(hostId);
    if (!pool) return;

    const hostConfig = this.hosts.get(hostId)!;
    let healthyCount = 0;
    const now = Date.now();

    for (const conn of pool) {
      if (conn.inUse) {
        // Skip connections in use
        healthyCount++;
        continue;
      }

      // Check idle timeout
      if (now - conn.lastUsedAt > this.config.idleTimeoutMs && pool.length > this.config.minConnectionsPerHost) {
        console.log(`[SSH Pool] Closing idle connection ${conn.id} for ${hostConfig.name}`);
        this.destroyConnection(conn);
        continue;
      }

      // Perform health check
      try {
        await this.checkConnectionHealth(conn);
        conn.healthy = true;
        conn.lastHealthCheck = now;
        healthyCount++;
      } catch (error) {
        console.warn(`[SSH Pool] Health check failed for ${conn.id}:`, error);
        conn.healthy = false;
        this.destroyConnection(conn);
      }
    }

    const stats = this.stats.get(hostId)!;
    stats.healthyConnections = healthyCount;

    // Ensure minimum connections
    const currentCount = pool.length;
    if (currentCount < this.config.minConnectionsPerHost) {
      const needed = this.config.minConnectionsPerHost - currentCount;
      for (let i = 0; i < needed; i++) {
        try {
          await this.createConnection(hostId);
        } catch (error) {
          console.warn(`[SSH Pool] Failed to restore minimum connections for ${hostConfig.name}`);
        }
      }
    }

    if (healthyCount === 0) {
      this.emit('pool:unhealthy', hostId, 'No healthy connections');
    } else {
      this.emit('pool:healthy', hostId);
    }
  }

  /**
   * Check if a single connection is healthy
   */
  private checkConnectionHealth(conn: PooledConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, 5000);

      conn.client.exec('echo health_check', (err, stream) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
          return;
        }

        stream.on('close', () => resolve());
        stream.on('error', reject);
      });
    });
  }

  /**
   * Destroy a connection
   */
  private destroyConnection(conn: PooledConnection): void {
    if (conn.keepAliveTimer) {
      clearInterval(conn.keepAliveTimer);
    }
    
    try {
      conn.client.end();
    } catch (error) {
      // Ignore errors during cleanup
    }

    const pool = this.pools.get(conn.hostId);
    if (pool) {
      const index = pool.findIndex(c => c.id === conn.id);
      if (index !== -1) {
        pool.splice(index, 1);
      }
    }

    const stats = this.stats.get(conn.hostId);
    if (stats) {
      stats.totalConnections--;
      if (conn.inUse) {
        stats.activeConnections--;
      } else {
        stats.idleConnections--;
      }
      stats.totalDestroyed++;
    }

    this.emit('connection:destroyed', conn.hostId, conn.id, 'destroyed');
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(hostId: string): Promise<{ connection: Client; release: () => void }> {
    const pool = this.pools.get(hostId);
    const stats = this.stats.get(hostId);
    const hostConfig = this.hosts.get(hostId);

    if (!pool || !stats || !hostConfig) {
      throw new Error(`Unknown host: ${hostId}`);
    }

    const startTime = Date.now();

    // Try to find an idle healthy connection
    const idleConn = pool.find(c => !c.inUse && c.healthy);
    if (idleConn) {
      idleConn.inUse = true;
      idleConn.lastUsedAt = Date.now();
      stats.activeConnections++;
      stats.idleConnections--;
      stats.totalBorrows++;
      stats.savedReconnections++;

      this.emit('connection:borrowed', hostId, idleConn.id);

      return {
        connection: idleConn.client,
        release: () => this.release(hostId, idleConn.id),
      };
    }

    // Try to create a new connection if pool not at max
    if (pool.length < this.config.maxConnectionsPerHost) {
      try {
        const newConn = await this.createConnection(hostId);
        newConn.inUse = true;
        stats.activeConnections++;
        stats.idleConnections--;
        stats.totalBorrows++;

        this.emit('connection:borrowed', hostId, newConn.id);

        return {
          connection: newConn.client,
          release: () => this.release(hostId, newConn.id),
        };
      } catch (error) {
        // Fall through to wait queue
      }
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const waitQueue = this.waitQueues.get(hostId)!;
      
      const timeoutId = setTimeout(() => {
        const index = waitQueue.findIndex(w => w.timestamp === startTime);
        if (index !== -1) {
          waitQueue.splice(index, 1);
        }
        reject(new Error(`Acquire timeout after ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      waitQueue.push({
        resolve: (conn) => {
          clearTimeout(timeoutId);
          conn.inUse = true;
          conn.lastUsedAt = Date.now();
          stats.activeConnections++;
          stats.idleConnections--;
          stats.totalBorrows++;
          stats.savedReconnections++;

          // Update average wait time
          const waitTime = Date.now() - startTime;
          stats.averageWaitTimeMs = (stats.averageWaitTimeMs + waitTime) / 2;

          this.emit('connection:borrowed', hostId, conn.id);

          resolve({
            connection: conn.client,
            release: () => this.release(hostId, conn.id),
          });
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        },
        timestamp: startTime,
      });
    });
  }

  /**
   * Release a connection back to the pool
   */
  release(hostId: string, connectionId: string): void {
    const pool = this.pools.get(hostId);
    const stats = this.stats.get(hostId);
    const waitQueue = this.waitQueues.get(hostId);

    if (!pool || !stats) return;

    const conn = pool.find(c => c.id === connectionId);
    if (!conn) return;

    conn.inUse = false;
    conn.lastUsedAt = Date.now();
    stats.activeConnections--;
    stats.idleConnections++;
    stats.totalReturns++;

    this.emit('connection:returned', hostId, connectionId);

    // Check if anyone is waiting for a connection
    if (waitQueue && waitQueue.length > 0) {
      const waiter = waitQueue.shift()!;
      waiter.resolve(conn);
    }
  }

  /**
   * Execute a command using a pooled connection
   */
  async execute(hostId: string, command: string): Promise<string> {
    const { connection, release } = await this.acquire(hostId);

    try {
      return await new Promise((resolve, reject) => {
        connection.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          stream.on('close', (code: number) => {
            if (code === 0 || stdout) {
              resolve(stdout);
            } else {
              reject(new Error(stderr || `Command failed with code ${code}`));
            }
          });

          stream.on('error', reject);
        });
      });
    } finally {
      release();
    }
  }

  /**
   * Get pool statistics for a host
   */
  getStats(hostId: string): PoolStats | undefined {
    return this.stats.get(hostId);
  }

  /**
   * Get all pool statistics
   */
  getAllStats(): PoolStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get pool status summary
   */
  getPoolStatus(): {
    initialized: boolean;
    hosts: Array<{
      id: string;
      name: string;
      stats: PoolStats;
      healthy: boolean;
    }>;
  } {
    const hosts = Array.from(this.hosts.entries()).map(([id, config]) => {
      const stats = this.stats.get(id)!;
      return {
        id,
        name: config.name,
        stats,
        healthy: stats.healthyConnections > 0,
      };
    });

    return {
      initialized: this.initialized,
      hosts,
    };
  }

  /**
   * Shutdown the pool gracefully
   */
  async shutdown(): Promise<void> {
    console.log('[SSH Pool] Shutting down connection pool...');

    // Stop health check timers
    for (const timer of Array.from(this.healthCheckTimers.values())) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    // Close all connections
    for (const [hostId, pool] of Array.from(this.pools.entries())) {
      for (const conn of pool) {
        this.destroyConnection(conn);
      }
      pool.length = 0;
    }

    // Reject all waiting requests
    for (const [hostId, queue] of Array.from(this.waitQueues.entries())) {
      for (const waiter of queue) {
        waiter.reject(new Error('Pool shutdown'));
      }
      queue.length = 0;
    }

    this.initialized = false;
    console.log('[SSH Pool] Connection pool shutdown complete');
  }
}

// Singleton instance
let poolInstance: SSHConnectionPool | null = null;

/**
 * Get or create the SSH connection pool singleton
 */
export function getSSHPool(): SSHConnectionPool {
  if (!poolInstance) {
    poolInstance = new SSHConnectionPool();
  }
  return poolInstance;
}

/**
 * Initialize the SSH pool with host configurations
 */
export async function initializeSSHPool(hosts: HostConfig[]): Promise<SSHConnectionPool> {
  const pool = getSSHPool();
  
  for (const host of hosts) {
    pool.registerHost(host);
  }

  await pool.initialize();
  return pool;
}
