#!/bin/bash
# NovoSSH Network Client — macOS Installer
#
# Usage:
#   curl -fsSL https://novossh.com/network/install-macos.sh | sh -s -- --email user@novossh.com --password <pass>
#   curl -fsSL https://novossh.com/network/install-macos.sh | sh -s -- --authkey <key>
#   curl -fsSL https://novossh.com/network/install-macos.sh | sh   (interactive OAuth)

set -e

NOVOSSH_URL="${NOVOSSH_URL:-https://ssh.novossh.com:8787}"
NOVOSSH_WEB="${NOVOSSH_WEB:-https://novossh.com}"
AUTH_KEY=""
EMAIL=""
PASSWORD=""

for arg in "$@"; do
  case $arg in
    --authkey=*) AUTH_KEY="${arg#*=}" ;;
    --authkey) shift; AUTH_KEY="$1" ;;
    --email=*) EMAIL="${arg#*=}" ;;
    --email) shift; EMAIL="$1" ;;
    --password=*) PASSWORD="${arg#*=}" ;;
    --password) shift; PASSWORD="$1" ;;
  esac
done

echo "NovoSSH Network Client — macOS Installer"
echo "========================================="
echo ""

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Error: This installer is for macOS only"
  exit 1
fi

# Install Tailscale if not present
if ! command -v tailscale &> /dev/null; then
  echo "Installing Tailscale..."
  if command -v brew &> /dev/null; then
    brew install tailscale
  else
    echo "Please install Tailscale from https://tailscale.com/download/mac"
    echo "Or install Homebrew first: https://brew.sh"
    exit 1
  fi
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
fi

# Method 2: OAuth — auto-capture token via local server
if [ -z "$AUTH_KEY" ] && [ -z "$EMAIL" ]; then
  CALLBACK_PORT=19876
  echo ""
  echo "Starting OAuth flow..."
  echo "A browser window will open. Log in and the installer will connect automatically."
  echo ""

  AUTH_TOKEN=""
  (
    while [ -z "$AUTH_TOKEN" ]; do
      RESPONSE=$(echo -e "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nok" | nc -l $CALLBACK_PORT 2>/dev/null)
      AUTH_TOKEN=$(echo "$RESPONSE" | grep -oP 'token=\K[^& ]+' 2>/dev/null)
    done
  ) &
  SERVER_PID=$!

  open "$NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT" 2>/dev/null

  echo "Waiting for login... (browser should open automatically)"
  echo "If the browser didn't open, visit: $NOVOSSH_WEB/#/network-setup?port=$CALLBACK_PORT"
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
    -H "Authorization: Bearer $AUTH_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('authKey',''))" 2>/dev/null)

  if [ -z "$AUTH_KEY" ]; then
    echo "Failed to generate network key."
    exit 1
  fi
  echo "Network key obtained."
fi

# Install wrapper
echo "Installing novossh-network client..."
cat > /usr/local/bin/novossh-network << 'SCRIPT'
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

if [ -z "$AUTH_KEY" ] && [ -z "$EMAIL" ]; then
  open "$NOVOSSH_WEB" 2>/dev/null
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
  status) tailscale status; tailscale ip -4 2>/dev/null ;;
  logout) sudo tailscale logout; echo "Disconnected." ;;
  down) sudo tailscale down; echo "Tailscale is down." ;;
esac
SCRIPT
chmod +x /usr/local/bin/novossh-network

echo ""
echo "Installation complete!"
if [ -n "$AUTH_KEY" ]; then
  novossh-network --authkey="$AUTH_KEY"
  echo "Connected!"
else
  echo "Run: novossh-network --email user@novossh.com --password <pass>"
  echo "  or: novossh-network --authkey <key>"
  echo "  or: novossh-network   (interactive OAuth)"
fi
