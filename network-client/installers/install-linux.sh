#!/bin/bash
# NovoSSH Network Client — Linux Installer
# Auto-detects x86_64 / arm64 and installs the daemon as a systemd service
#
# Usage:
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --email user@novossh.com --password <pass>
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --authkey <key>
#   curl -fsSL https://novossh.com/network/install.sh | sudo sh   (interactive OAuth)

set -e

NOVOSSH_URL="${NOVOSSH_URL:-https://ssh.novossh.com:8787}"
NOVOSSH_WEB="${NOVOSSH_WEB:-https://novossh.com}"
AUTH_KEY=""
EMAIL=""
PASSWORD=""
INSTALL_DIR="/usr/local/bin"
SERVICE_DIR="/etc/systemd/system"

# Parse arguments
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

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64) TAILSCALE_ARCH="amd64" ;;
  aarch64) TAILSCALE_ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

echo "NovoSSH Network Client Installer"
echo "================================="
echo "Architecture: $ARCH ($TAILSCALE_ARCH)"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

# Method 1: Password login
if [ -z "$AUTH_KEY" ] && [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  echo "Logging in to NovoSSH..."
  TOKEN=$(curl -s -X POST "$NOVOSSH_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)

  if [ -z "$TOKEN" ]; then
    echo "Login failed. Check your email and password."
    exit 1
  fi

  echo "Generating network key..."
  AUTH_KEY=$(curl -s -X POST "$NOVOSSH_URL/api/tailscale/auth" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)

  if [ -z "$AUTH_KEY" ]; then
    echo "Failed to generate network key."
    exit 1
  fi
  echo "Network key obtained."
fi

# Method 2: OAuth — start local server, open callback page, auto-capture token
if [ -z "$AUTH_KEY" ] && [ -z "$EMAIL" ]; then
  CALLBACK_PORT=19876
  echo ""
  echo "Starting OAuth flow..."
  echo "A browser window will open. Log in and the installer will connect automatically."
  echo ""

  # Start a temporary HTTP server to capture the OAuth token
  AUTH_TOKEN=""
  (
    while [ -z "$AUTH_TOKEN" ]; do
      RESPONSE=$(echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nok" | nc -l -p $CALLBACK_PORT -q 1 2>/dev/null)
      AUTH_TOKEN=$(echo "$RESPONSE" | grep -oP 'token=\K[^& ]+' 2>/dev/null)
    done
  ) &
  SERVER_PID=$!

  # Open browser to callback page
  if command -v xdg-open &> /dev/null; then
    xdg-open "$NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT" 2>/dev/null &
  fi

  echo "Waiting for login... (browser should open automatically)"
  echo "If the browser didn't open, visit: $NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT"
  echo ""

  # Wait for token (max 120 seconds)
  for i in $(seq 1 120); do
    if [ -n "$AUTH_TOKEN" ]; then break; fi
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
    -H "Authorization: Bearer $AUTH_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)

  if [ -z "$AUTH_KEY" ]; then
    echo "Failed to generate network key."
    exit 1
  fi
  echo "Network key obtained."
fi

# Install Tailscale if not present
if ! command -v tailscale &> /dev/null; then
  echo "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# Install the wrapper script
echo "Installing novossh-network client..."
cat > "$INSTALL_DIR/novossh-network" << 'SCRIPT'
#!/bin/bash
NOVOSSH_URL="${NOVOSSH_URL:-https://ssh.novossh.com:8787}"
NOVOSSH_WEB="${NOVOSSH_WEB:-https://novossh.com}"
AUTH_KEY=""
EMAIL=""
PASSWORD=""
ACTION="login"

while [[ $# -gt 0 ]]; do
  case $1 in
    --authkey) AUTH_KEY="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --status) ACTION="status"; shift ;;
    --logout) ACTION="logout"; shift ;;
    --down) ACTION="down"; shift ;;
    *) shift ;;
  esac
done

# Auto-fetch key via password
if [ -z "$AUTH_KEY" ] && [ -n "$EMAIL" ] && [ -n "$PASSWORD" ]; then
  TOKEN=$(curl -s -X POST "$NOVOSSH_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    AUTH_KEY=$(curl -s -X POST "$NOVOSSH_URL/api/tailscale/auth" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)
  fi
fi

# Auto-fetch key via OAuth
if [ -z "$AUTH_KEY" ] && [ -z "$EMAIL" ]; then
  xdg-open "$NOVOSSH_WEB" 2>/dev/null || open "$NOVOSSH_WEB" 2>/dev/null
  echo "Log in at $NOVOSSH_WEB → Settings → Network → Generate Network Key"
  read -p "Paste your Network Key: " AUTH_KEY
fi

case $ACTION in
  login)
    if [ -z "$AUTH_KEY" ]; then
      echo "Error: Provide --authkey, --email/--password, or paste key from browser"
      exit 1
    fi
    echo "Connecting to NovoSSH network..."
    sudo tailscale up --login-server="http://ssh.novossh.com:8080" --authkey="$AUTH_KEY"
    IP=$(tailscale ip -4 2>/dev/null || echo "pending")
    echo ""
    echo "Connected! Your Tailscale IP: $IP"
    echo "Add this IP as a host in NovoSSH to connect via SSH."
    ;;
  status)
    tailscale status
    IP=$(tailscale ip -4 2>/dev/null || echo "not connected")
    echo "Tailscale IP: $IP"
    ;;
  logout)
    sudo tailscale logout
    echo "Disconnected from NovoSSH network."
    ;;
  down)
    sudo tailscale down
    echo "Tailscale is down."
    ;;
esac
SCRIPT
chmod +x "$INSTALL_DIR/novossh-network"

# Install systemd service
echo "Installing systemd service..."
cat > "$SERVICE_DIR/novossh-network.service" << 'EOF'
[Unit]
Description=NovoSSH Network Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/novossh-network --status
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable novossh-network

echo ""
echo "Installation complete!"
echo ""

if [ -n "$AUTH_KEY" ]; then
  echo "Connecting to NovoSSH network..."
  novossh-network --authkey="$AUTH_KEY"
  systemctl start novossh-network
  echo "Service started and enabled."
else
  echo "To connect, run:"
  echo "  novossh-network --email user@novossh.com --password <pass>"
  echo "  novossh-network --authkey <your-key>"
  echo "  novossh-network   (interactive OAuth login)"
fi
