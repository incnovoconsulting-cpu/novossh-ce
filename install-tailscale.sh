#!/bin/bash

# NovoSSH Tailscale Installation Script
# DEPRECATED: This script uses Tailscale SaaS + OAuth which is no longer used.
# NovoSSH now uses self-hosted headscale for Tailscale coordination.
# See server/services/HeadscaleService.ts for the new integration.
# This script is kept for reference only.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js not installed"
        echo "Please install Node.js 18+ from https://nodejs.org"
        exit 1
    fi
    log_success "Node.js $(node -v) found"

    if ! command -v npm &> /dev/null; then
        log_error "npm not installed"
        exit 1
    fi
    log_success "npm $(npm -v) found"

    if ! command -v git &> /dev/null; then
        log_warning "git not installed (optional)"
    else
        log_success "git $(git --version | awk '{print $3}') found"
    fi

    if ! command -v tailscale &> /dev/null; then
        log_warning "Tailscale CLI not found on this machine"
        echo "   If you want to tag your server: brew install tailscale (macOS) or apt install tailscale (Linux)"
    else
        log_success "Tailscale found"
    fi
}

# Clone/update repository
setup_repository() {
    log_info "Setting up repository..."

    if [ -d "NovoSSH" ]; then
        log_info "NovoSSH directory already exists"
        cd NovoSSH
        log_info "Updating repository..."
        git pull origin main 2>/dev/null || true
    else
        log_info "Cloning NovoSSH repository..."
        git clone https://github.com/incnovoconsulting-cpu/NovoSSH.git
        cd NovoSSH
    fi

    log_success "Repository ready"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm install
    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."
    npm run build
    log_success "Build complete"
}

# Get OAuth credentials
get_oauth_credentials() {
    log_info "OAuth Configuration"
    echo ""
    echo "To enable OAuth with Tailscale:"
    echo "1. Go to: https://login.tailscale.com/admin/settings/oauth"
    echo "2. Click 'Create OAuth Client'"
    echo "3. Configure:"
    echo "   - Application name: NovoSSH"
    echo "   - Redirect URI: https://your-domain.com/auth/tailscale/callback"
    echo "                   (or http://localhost:5173/auth/tailscale/callback for dev)"
    echo "4. Copy the Client ID and Secret"
    echo ""

    read -p "Do you have OAuth credentials? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter Tailscale Client ID: " CLIENT_ID
        read -sp "Enter Tailscale Client Secret: " CLIENT_SECRET
        echo

        # Create .env file
        cat > .env.local << EOF
TAILSCALE_CLIENT_ID=$CLIENT_ID
TAILSCALE_CLIENT_SECRET=$CLIENT_SECRET
HOST=0.0.0.0
PORT=8787
EOF
        log_success "OAuth credentials saved to .env.local"
        return 0
    else
        log_warning "Skipping OAuth setup (manual config available later)"
        return 1
    fi
}

# Tag server on Tailscale
tag_server() {
    log_info "Tailscale Server Tagging"

    if command -v tailscale &> /dev/null; then
        read -p "Tag this machine for NovoSSH discovery? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Adding tag:novossh tag..."
            sudo tailscale tag tag:novossh || log_error "Failed to add tag (requires sudo)"
            log_success "Server tagged"
        fi
    else
        log_warning "Tailscale CLI not available"
        echo "   You can tag your server manually:"
        echo "   1. Go to: https://login.tailscale.com/admin/machines"
        echo "   2. Find your machine"
        echo "   3. Add tag: tag:novossh"
    fi
}

# Choose deployment method
choose_deployment() {
    log_info "Deployment Options"
    echo ""
    echo "1) Run locally (development)"
    echo "2) Docker (production)"
    echo "3) Systemd service (Linux)"
    echo "4) Skip (I'll run it manually)"
    echo ""
    read -p "Choose deployment method (1-4): " choice

    case $choice in
        1)
            deploy_local
            ;;
        2)
            deploy_docker
            ;;
        3)
            deploy_systemd
            ;;
        4)
            log_info "Skipping deployment setup"
            log_info "To run manually: npm start"
            ;;
        *)
            log_error "Invalid choice"
            ;;
    esac
}

# Deploy locally
deploy_local() {
    log_info "Starting NovoSSH locally..."
    echo ""
    echo "Starting server on http://localhost:8787"
    echo "Open in browser: http://localhost:5173"
    echo ""
    echo "Press Ctrl+C to stop"
    echo ""

    if [ -f .env.local ]; then
        # Load environment from .env.local
        export $(cat .env.local | xargs)
    fi

    npm start
}

# Deploy with Docker
deploy_docker() {
    log_info "Setting up Docker deployment..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed"
        echo "Please install Docker from https://docker.com"
        return 1
    fi

    log_success "Docker found"

    # Create docker-compose .env file
    if [ -f .env.local ]; then
        cp .env.local .env.docker
        log_success "Configuration copied to .env.docker"
    else
        cat > .env.docker << EOF
# Add your OAuth credentials here
TAILSCALE_CLIENT_ID=
TAILSCALE_CLIENT_SECRET=
TAILSCALE_IP_ADDRESS=
NODE_ENV=production
EOF
        log_warning "Created .env.docker - please fill in your OAuth credentials"
    fi

    log_info "Building Docker image..."
    docker build -f Dockerfile.tailscale -t novossh:latest .
    log_success "Docker image built"

    log_info "Starting container..."
    docker-compose -f docker-compose.tailscale.yml up -d

    log_success "NovoSSH running in Docker!"
    echo ""
    echo "Server: http://localhost:8787"
    echo "Stop: docker-compose -f docker-compose.tailscale.yml down"
    echo "View logs: docker-compose -f docker-compose.tailscale.yml logs -f"
}

# Deploy as systemd service
deploy_systemd() {
    log_info "Setting up systemd service..."

    if [ ! -f /etc/systemd/system/novossh.service ]; then
        log_warning "Systemd service requires sudo"
        read -p "Install systemd service? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi

        INSTALL_DIR=$(pwd)
        if [ -f .env.local ]; then
            # Create systemd service with environment from .env.local
            sudo tee /etc/systemd/system/novossh.service > /dev/null << EOF
[Unit]
Description=NovoSSH Server
After=network.target tailscaled.service
Wants=tailscaled.service

[Service]
Type=simple
User=\$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node dist/server/index.js
EnvironmentFile=$INSTALL_DIR/.env.local
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        else
            sudo tee /etc/systemd/system/novossh.service > /dev/null << EOF
[Unit]
Description=NovoSSH Server
After=network.target tailscaled.service
Wants=tailscaled.service

[Service]
Type=simple
User=\$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node dist/server/index.js
Environment="HOST=0.0.0.0"
Environment="PORT=8787"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        fi

        sudo systemctl daemon-reload
        log_success "Systemd service installed"

        read -p "Start service now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo systemctl enable novossh
            sudo systemctl start novossh
            log_success "NovoSSH started"
            echo ""
            echo "View logs: sudo journalctl -u novossh -f"
        fi
    else
        log_warning "Systemd service already installed"
    fi
}

# Print summary
print_summary() {
    echo ""
    log_success "Installation complete!"
    echo ""
    echo "Next steps:"
    echo "1. Configure OAuth (if not done): Settings → Network → Configure"
    echo "2. Add a remote host to connect to"
    echo "3. Select 'Tailscale' as connection mode"
    echo "4. Connect and enjoy!"
    echo ""
    echo "Documentation:"
    echo "- Setup: $(pwd)/TAILSCALE_SETUP.md"
    echo "- Package: $(pwd)/TAILSCALE_PACKAGE.md"
    echo ""
}

# Main installation flow
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  NovoSSH Tailscale Installation       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites
    setup_repository
    install_dependencies
    build_application

    echo ""
    if get_oauth_credentials; then
        tag_server
    fi

    echo ""
    choose_deployment
    print_summary
}

# Run installation
main
