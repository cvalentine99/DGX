# Ngrok Persistent Tunnel Setup for DGX Spark

This guide sets up ngrok as a systemd service so SSH and inference tunnels auto-restart on reboot.

## Prerequisites

1. ngrok installed and authenticated on your DGX Spark
2. ngrok authtoken configured: `ngrok config add-authtoken YOUR_TOKEN`

## Step 1: Create ngrok Configuration File

Create `/home/cvalentine/.ngrok/ngrok.yml`:

```yaml
version: "3"
agent:
  authtoken: YOUR_NGROK_AUTHTOKEN

tunnels:
  ssh:
    proto: tcp
    addr: 22
    
  inference:
    proto: http
    addr: 30000
    domain: unpopular-thad-unblamed.ngrok-free.dev
```

## Step 2: Create Systemd Service

Create `/etc/systemd/system/ngrok.service`:

```ini
[Unit]
Description=ngrok tunnels for DGX Spark
After=network.target

[Service]
Type=simple
User=cvalentine
ExecStart=/usr/local/bin/ngrok start --all --config /home/cvalentine/.ngrok/ngrok.yml
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## Step 3: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable ngrok

# Start the service now
sudo systemctl start ngrok

# Check status
sudo systemctl status ngrok

# View logs
journalctl -u ngrok -f
```

## Step 4: Get Tunnel URLs

After starting, get the current tunnel URLs:

```bash
curl -s http://localhost:4040/api/tunnels | jq '.tunnels[] | {name, public_url}'
```

## Step 5: Update NeMo Command Center

Once you have the new SSH tunnel URL (e.g., `X.tcp.ngrok.io:XXXXX`), update the environment variables in Settings → Secrets:

- `DGX_SSH_HOST`: The ngrok hostname (e.g., `0.tcp.ngrok.io`)
- `DGX_SSH_PORT`: The ngrok port (e.g., `17974`)

## Troubleshooting

**Service won't start:**
```bash
journalctl -u ngrok -n 50 --no-pager
```

**Tunnel address changed:**
The TCP tunnel address changes on restart. Check the new address and update the dashboard env vars.

**Use reserved domains (paid feature):**
For stable addresses, upgrade ngrok and use reserved TCP addresses or domains.
