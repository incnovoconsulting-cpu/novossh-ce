#!/bin/bash
# NovoSSH Network Client — Connects machine to NovoSSH network via Headscale
# Usage: novossh-network --authkey <key> [--server <url>]

set -e

# Default configuration
HEADSCALE_URL="${HEADSCALE_URL:-http://ssh.novossh.com:8080}"
AUTH_KEY=""
ACTION="login"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --authkey) AUTH_KEY="$2"; shift 2 ;;
    --server) HEADSCALE_URL="$2"; shift 2 ;;
    --status) ACTION="status"; shift ;;
    --logout) ACTION="logout"; shift ;;
    --down) ACTION="down"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Check if tailscale is installed
if ! command -v tailscale &> /dev/null; then
  echo "Error: tailscale not found. Run the installer first."
  exit 1
fi

case $ACTION in
  login)
    if [ -z "$AUTH_KEY" ]; then
      echo "Error: --authkey is required"
      echo "Usage: novossh-network --authkey <your-auth-key>"
      exit 1
    fi

    echo "Connecting to NovoSSH network..."
    echo "Server: $HEADSCALE_URL"

    # Connect with pre-auth key
    sudo tailscale up --login-server="$HEADSCALE_URL" --authkey="$AUTH_KEY"

    # Get the assigned IP
    IP=$(tailscale ip -4 2>/dev/null || echo "pending")
    echo ""
    echo "Connected to NovoSSH network!"
    echo "Your Tailscale IP: $IP"
    echo ""
    echo "Add this IP as a host in NovoSSH to connect via SSH."
    ;;

  status)
    tailscale status
    echo ""
    IP=$(tailscale ip -4 2>/dev/null || echo "not connected")
    echo "Tailscale IP: $IP"
    ;;

  logout)
    echo "Disconnecting from NovoSSH network..."
    sudo tailscale logout
    echo "Disconnected."
    ;;

  down)
    echo "Shutting down Tailscale..."
    sudo tailscale down
    echo "Tailscale is down."
    ;;
esac
