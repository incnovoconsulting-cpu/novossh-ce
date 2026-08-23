# NovoSSH Network Client — Windows Installer
#
# Usage (PowerShell as Administrator):
#   .\install-windows.ps1 -Email user@novossh.com -Password <pass>
#   .\install-windows.ps1 -AuthKey <key>
#   .\install-windows.ps1   (interactive OAuth)

param(
    [string]$AuthKey = "",
    [string]$Email = "",
    [string]$Password = "",
    [string]$ServerUrl = "https://ssh.novossh.com:8787"
)

Write-Host "NovoSSH Network Client — Windows Installer" -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host ""

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Error: Please run as Administrator" -ForegroundColor Red
    exit 1
}

# Method 1: Password login
if (-not $AuthKey -and $Email -and $Password) {
    Write-Host "Logging in to NovoSSH..."
    $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
    try {
        $loginResp = Invoke-RestMethod -Uri "$ServerUrl/api/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
        $token = $loginResp.accessToken
        if ($token) {
            Write-Host "Generating network key..."
            $headers = @{ Authorization = "Bearer $token" }
            $keyResp = Invoke-RestMethod -Uri "$ServerUrl/api/tailscale/auth" -Method Post -ContentType "application/json" -Headers $headers
            $AuthKey = $keyResp.authKey
        }
    } catch {
        Write-Host "Login failed: $_" -ForegroundColor Red
        exit 1
    }
}

# Method 2: OAuth — auto-capture token via local server
if (-not $AuthKey -and -not $Email) {
    $CallbackPort = 19876
    Write-Host ""
    Write-Host "Starting OAuth flow..."
    Write-Host "A browser window will open. Log in and the installer will connect automatically."
    Write-Host ""

    Start-Process "https://novossh.com/#/network-setup?port=$CallbackPort"

    # Start a listener that waits for the token POST
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add("http://localhost:${CallbackPort}/")
    $listener.Start()

    Write-Host "Waiting for login... (browser should open automatically)"
    Write-Host "If the browser didn't open, visit: https://novossh.com/#/network-setup?port=$CallbackPort"
    Write-Host ""

    $tokenReceived = $false
    $deadline = [DateTime]::Now.AddSeconds(120)
    while (-not $tokenReceived -and [DateTime]::Now -lt $deadline) {
        if ($listener.Pending()) {
            $context = $listener.GetContext()
            $body = [System.IO.StreamReader]::new($context.Request.InputStream).ReadToEnd()
            try {
                $data = $body | ConvertFrom-Json
                $AuthKey = $data.authKey
                $tokenReceived = $true
                $context.Response.StatusCode = 200
                $context.Response.Close()
            } catch {
                $context.Response.StatusCode = 400
                $context.Response.Close()
            }
        } else {
            Start-Sleep -Milliseconds 500
        }
    }
    $listener.Stop()

    if (-not $AuthKey) {
        Write-Host "Timeout waiting for OAuth login." -ForegroundColor Red
        exit 1
    }
    Write-Host "Token received. Generating network key..."

if (-not $AuthKey) {
    Write-Host "Error: Provide -Email/-Password, -AuthKey, or paste key from browser" -ForegroundColor Red
    exit 1
}

# Install Tailscale if not present
if (-not (Get-Command tailscale -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Tailscale..."
    $installer = "$env:TEMP\TailscaleSetup.exe"
    Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" -OutFile $installer
    Start-Process -FilePath $installer -ArgumentList "/S" -Wait
    Remove-Item $installer -ErrorAction SilentlyContinue
}

Write-Host "Connecting to NovoSSH network..."
tailscale up --login-server="http://ssh.novossh.com:8080" --authkey=$AuthKey

$ip = tailscale ip -4 2>$null
Write-Host ""
Write-Host "Connected! Your Tailscale IP: $ip" -ForegroundColor Green
Write-Host "Add this IP as a host in NovoSSH to connect via SSH."
