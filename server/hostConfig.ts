/**
 * Centralized DGX Spark Host Configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for all host-related configuration.
 * All routers should import from this module instead of defining their own.
 * 
 * When running on Beta (192.168.50.110):
 *   - Beta is LOCAL (use local commands via child_process, no SSH)
 *   - Alpha is REMOTE (use SSH to 192.168.50.139)
 * 
 * When running on Alpha (192.168.50.139):
 *   - Alpha is LOCAL (use local commands via child_process, no SSH)
 *   - Beta is REMOTE (use SSH to 192.168.50.110)
 */

import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { Client } from 'ssh2';

const execAsync = promisify(execCallback);

// ============================================================================
// HOST CONFIGURATION - Single source of truth
// ============================================================================

export interface DGXHost {
  id: string;
  name: string;
  ip: string;
  localIp: string;  // Same as ip, for backwards compatibility
  host: string;     // SSH host (may be different from ip for ngrok tunnels)
  port: number;     // SSH port
  sshHost: string;  // Alias for host
  sshPort: number;  // Alias for port
  isLocal: boolean;
}

export type HostId = "alpha" | "beta";

/**
 * DGX Spark host configurations
 * 
 * LOCAL_HOST env var determines which host the app is running on:
 * - "beta" (default): Running on 192.168.50.110, Beta is local, Alpha is remote
 * - "alpha": Running on 192.168.50.139, Alpha is local, Beta is remote
 */
export const DGX_HOSTS: Record<HostId, DGXHost> = {
  alpha: {
    id: "alpha",
    name: "DGX Spark Alpha",
    ip: "192.168.50.139",
    localIp: "192.168.50.139",
    host: process.env.DGX_SSH_HOST || "192.168.50.139",
    port: parseInt(process.env.DGX_SSH_PORT || "22"),
    sshHost: process.env.DGX_SSH_HOST || "192.168.50.139",
    sshPort: parseInt(process.env.DGX_SSH_PORT || "22"),
    isLocal: process.env.LOCAL_HOST === 'alpha',
  },
  beta: {
    id: "beta",
    name: "DGX Spark Beta",
    ip: "192.168.50.110",
    localIp: "192.168.50.110",
    host: process.env.DGX_SSH_HOST_BETA || "192.168.50.110",
    port: parseInt(process.env.DGX_SSH_PORT_BETA || "22"),
    sshHost: process.env.DGX_SSH_HOST_BETA || "192.168.50.110",
    sshPort: parseInt(process.env.DGX_SSH_PORT_BETA || "22"),
    isLocal: process.env.LOCAL_HOST === 'beta' || process.env.LOCAL_HOST === undefined,
  },
};

/**
 * Get all hosts as an array
 */
export function getAllHosts(): DGXHost[] {
  return Object.values(DGX_HOSTS);
}

/**
 * Get a specific host by ID
 */
export function getHost(hostId: HostId): DGXHost {
  return DGX_HOSTS[hostId];
}

/**
 * Check if a host is configured for local execution
 */
export function isLocalHost(hostId: HostId): boolean {
  return DGX_HOSTS[hostId].isLocal;
}

// ============================================================================
// SSH CONFIGURATION
// ============================================================================

export interface SSHCredentials {
  username: string | undefined;
  password: string | undefined;
  privateKey: string | undefined;
}

/**
 * Get SSH credentials from environment
 * Prioritizes private key authentication over password for security
 */
export function getSSHCredentials(): SSHCredentials {
  const privateKey = process.env.DGX_SSH_PRIVATE_KEY;
  const password = process.env.DGX_SSH_PASSWORD;
  
  // Log authentication method being used (without exposing secrets)
  if (privateKey) {
    console.log('[SSH] Using private key authentication (recommended)');
  } else if (password) {
    console.warn('[SSH] Using password authentication - consider switching to SSH keys for better security');
  }
  
  return {
    username: process.env.DGX_SSH_USERNAME,
    password: password,
    privateKey: privateKey,
  };
}

/**
 * Check if SSH credentials are configured
 */
export function hasSSHCredentials(): boolean {
  const creds = getSSHCredentials();
  return !!(creds.username && (creds.password || creds.privateKey));
}

// ============================================================================
// COMMAND EXECUTION - Local and Remote
// ============================================================================

/**
 * Execute command locally via child_process
 * Used when the app is running on the same host as the target
 */
export async function executeLocalCommand(command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 60000, // 60 second timeout
    });
    return stdout || stderr || '';
  } catch (error: any) {
    return error.stderr || error.message || 'Command failed';
  }
}

/**
 * Execute command locally with full result (stdout, stderr, code)
 */
export async function executeLocalCommandFull(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    });
    return { stdout: stdout || '', stderr: stderr || '', code: 0 };
  } catch (error: any) {
    return { 
      stdout: error.stdout || '', 
      stderr: error.stderr || error.message || 'Command failed', 
      code: error.code || 1 
    };
  }
}

/**
 * Create SSH connection to a remote host
 */
export function createSSHConnection(hostId: HostId): Promise<Client> {
  return new Promise((resolve, reject) => {
    const host = DGX_HOSTS[hostId];
    const credentials = getSSHCredentials();
    
    if (!credentials.username) {
      reject(new Error("DGX_SSH_USERNAME not configured"));
      return;
    }
    
    const conn = new Client();

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error(`SSH connection timeout to ${host.name}`));
    }, 10000);

    conn.on("ready", () => {
      clearTimeout(timeout);
      resolve(conn);
    });

    conn.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`SSH connection failed to ${host.name}: ${err.message}`));
    });

    const config: any = {
      host: host.sshHost,
      port: host.sshPort,
      username: credentials.username,
      readyTimeout: 10000,
    };

    // Prioritize private key authentication over password for security
    if (credentials.privateKey) {
      // Handle multi-line private keys (may be base64 encoded or have \n literals)
      let privateKey = credentials.privateKey;
      if (!privateKey.includes('\n') && privateKey.includes('-----BEGIN')) {
        // Key has literal \n strings, convert to actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      config.privateKey = privateKey;
    } else if (credentials.password) {
      config.password = credentials.password;
    } else {
      reject(new Error('No SSH authentication method configured (need DGX_SSH_PRIVATE_KEY or DGX_SSH_PASSWORD)'));
      return;
    }

    conn.connect(config);
  });
}

/**
 * Execute SSH command on a connection
 */
export function executeSSHCommand(
  conn: Client,
  command: string
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    conn.exec(command, (err, stream) => {
      if (err) {
        resolve({ stdout: "", stderr: err.message, code: 1 });
        return;
      }

      stream.on("close", (code: number) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });
    });
  });
}

/**
 * Execute command on a host - automatically chooses local or SSH based on host config
 * This is the main function that should be used by all routers
 * 
 * @param hostId - The host to execute on ("alpha" or "beta")
 * @param command - The shell command to execute
 * @returns The command output (stdout)
 */
export async function executeOnHost(hostId: HostId, command: string): Promise<string> {
  const host = DGX_HOSTS[hostId];
  
  if (host.isLocal) {
    console.log(`[HOST] Executing locally on ${host.name}: ${command.substring(0, 80)}...`);
    return executeLocalCommand(command);
  } else {
    // Remote host - use SSH
    if (!hasSSHCredentials()) {
      throw new Error('SSH credentials not configured for remote host');
    }
    
    console.log(`[HOST] Executing via SSH on ${host.name}: ${command.substring(0, 80)}...`);
    const conn = await createSSHConnection(hostId);
    const result = await executeSSHCommand(conn, command);
    conn.end();
    
    if (result.code !== 0 && result.stderr) {
      return result.stderr;
    }
    return result.stdout;
  }
}

/**
 * Execute command on a host with full result (stdout, stderr, code)
 */
export async function executeOnHostFull(hostId: HostId, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const host = DGX_HOSTS[hostId];
  
  if (host.isLocal) {
    console.log(`[HOST] Executing locally on ${host.name}: ${command.substring(0, 80)}...`);
    return executeLocalCommandFull(command);
  } else {
    // Remote host - use SSH
    if (!hasSSHCredentials()) {
      return { stdout: '', stderr: 'SSH credentials not configured', code: 1 };
    }
    
    console.log(`[HOST] Executing via SSH on ${host.name}: ${command.substring(0, 80)}...`);
    const conn = await createSSHConnection(hostId);
    const result = await executeSSHCommand(conn, command);
    conn.end();
    return result;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get host info for API responses (safe to expose to frontend)
 */
export function getHostInfo(hostId: HostId) {
  const host = DGX_HOSTS[hostId];
  return {
    id: host.id,
    name: host.name,
    ip: host.ip,
    isLocal: host.isLocal,
  };
}

/**
 * Get all hosts info for API responses
 */
export function getAllHostsInfo() {
  return getAllHosts().map(host => ({
    id: host.id,
    name: host.name,
    ip: host.ip,
    isLocal: host.isLocal,
  }));
}
