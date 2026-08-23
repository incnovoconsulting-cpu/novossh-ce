#!/bin/bash
# NovoSSH Network Client — Universal Installer
# Detects OS/arch, installs Tailscale, connects to NovoSSH network
#
# Usage:
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --email user@novossh.com --password <pass>
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --authkey <key>

set -e

NOVOSSH_URL="${NOVOSSH_URL:-https://ssh.novossh.com:8787}"
NOVOSSH_WEB="${NOVOSSH_WEB:-https://novossh.com}"
HEADSCALE_URL="http://ssh.novossh.com:8080"
AUTH_KEY=""
EMAIL=""
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --authkey=*) AUTH_KEY="${1#*=}"; shift ;;
    --authkey) shift; AUTH_KEY="$1"; shift ;;
    --email=*) EMAIL="${1#*=}"; shift ;;
    --email) shift; EMAIL="$1"; shift ;;
    --password=*) PASSWORD="${1#*=}"; shift ;;
    --password) shift; PASSWORD="$1"; shift ;;
    *) shift ;;
  esac
done

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (sudo)"
  exit 1
fi

# Detect OS and arch
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Linux) OS_NAME="linux" ;;
  Darwin) OS_NAME="macos" ;;
  *)
    echo "Error: Unsupported OS: $OS"
    echo "For Windows, use the PowerShell installer."
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH_NAME="amd64" ;;
  aarch64|arm64) ARCH_NAME="arm64" ;;
  *) echo "Error: Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "NovoSSH Network Client"
echo "======================"
echo "OS: $OS_NAME ($ARCH_NAME)"
echo "Server: $NOVOSSH_URL"
echo ""

# ─── Method 1: Password login ───
if [ -z "$AUTH_KEY" ] && [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  echo "Logging in to NovoSSH..."
  TOKEN=$(curl -s -X POST "$NOVOSSH_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

  if [ -z "$TOKEN" ]; then
    echo "Login failed. Check your email and password."
    exit 1
  fi

  echo "Generating network key..."
  AUTH_KEY=$(curl -s -X POST "$NOVOSSH_URL/api/tailscale/auth" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)

  if [ -z "$AUTH_KEY" ]; then
    echo "Failed to generate network key."
    exit 1
  fi
  echo "Network key obtained."
fi

# ─── Method 2: OAuth (automatic) ───
if [ -z "$AUTH_KEY" ] && [ -z "$EMAIL" ]; then
  CALLBACK_PORT=19876
  echo "Starting OAuth login..."
  echo "A browser window will open. Complete the login to connect automatically."
  echo ""

  # Start temporary server to capture token
  AUTH_TOKEN=""
  (
    while [ -z "$AUTH_TOKEN" ]; do
      RESPONSE=$(echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nok" | nc -l -p $CALLBACK_PORT -q 1 2>/dev/null)
      AUTH_TOKEN=$(echo "$RESPONSE" | grep -oP 'token=\K[^& ]+' 2>/dev/null)
    done
  ) &
  SERVER_PID=$!

  # Open browser
  case "$OS_NAME" in
    linux) xdg-open "$NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT" 2>/dev/null & ;;
    macos) open "$NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT" 2>/dev/null & ;;
  esac

  echo "Waiting for login... (max 2 min)"
  echo "Or open manually: $NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT"
  echo ""

  for i in $(seq 1 120); do
    [ -n "$AUTH_TOKEN" ] && break
    sleep 1
  done
  kill $SERVER_PID 2>/dev/null

  if [ -z "$AUTH_TOKEN" ]; then
    echo "Timeout waiting for OAuth login."
    exit 1
  fi

  echo "Token received. Generating network key..."
  AUTH_KEY=$(curl -s -X POST "$NOVOSSH_URL/api/tailscale/auth" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)

  if [ -z "$AUTH_KEY" ]; then
    echo "Failed to generate network key."
    exit 1
  fi
fi

# ─── Validate ───
if [ -z "$AUTH_KEY" ]; then
  echo "Error: No authentication provided."
  echo "Usage: --email user@novossh.com --password <pass>"
  echo "       --authkey <key>"
  echo "       (no args for interactive OAuth)"
  exit 1
fi

# ─── Install Tailscale ───
if ! command -v tailscale &> /dev/null; then
  echo "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# ─── Connect ───
echo "Connecting to NovoSSH network..."
sudo tailscale up --login-server="$HEADSCALE_URL" --authkey="$AUTH_KEY"

IP=$(tailscale ip -4 2>/dev/null || echo "pending")

echo ""
echo "Connected!"
echo "======================"
echo "Your Tailscale IP: $IP"
echo ""
echo "Add this IP as a host in NovoSSH to connect via SSH."
