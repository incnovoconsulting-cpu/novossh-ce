import Foundation

#if DEBUG

@MainActor
class DirectSSHClientTests {
  static func runAllTests() {
    print("Testing NetworkClassifier...")
    testPrivateIPRanges()
    testTailscaleIPs()
    testConnectionModeSelection()
  }

  private static func testPrivateIPRanges() {
    assert(NetworkClassifier.isPrivateIPRange("10.0.0.1") == true, "10.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("10.255.255.255") == true, "10.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("172.16.0.0") == true, "172.16-31.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("172.31.255.255") == true, "172.16-31.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("172.15.0.0") == false, "172.15.x should be public")
    assert(NetworkClassifier.isPrivateIPRange("172.32.0.0") == false, "172.32.x should be public")
    assert(NetworkClassifier.isPrivateIPRange("192.168.0.1") == true, "192.168.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("192.168.255.255") == true, "192.168.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("127.0.0.1") == true, "127.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("169.254.0.1") == true, "169.254.x should be private")
    assert(NetworkClassifier.isPrivateIPRange("::1") == true, "IPv6 loopback should be private")
    assert(NetworkClassifier.isPrivateIPRange("8.8.8.8") == false, "Public IP should not be private")
    assert(NetworkClassifier.isPrivateIPRange("1.1.1.1") == false, "Public IP should not be private")
    print("✓ Private IP range tests passed")
  }

  private static func testTailscaleIPs() {
    assert(NetworkClassifier.isTailscaleIP("100.64.0.1") == true, "100.x should be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("100.127.255.255") == true, "100.x should be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("myhost.ts.net") == true, "*.ts.net should be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("example.ts.net") == true, "*.ts.net should be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("fd7a:115c:1234:5678::1") == true, "fd7a:115c: should be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("192.168.1.1") == false, "Private IP should not be Tailscale")
    assert(NetworkClassifier.isTailscaleIP("example.com") == false, "Regular domain should not be Tailscale")
    print("✓ Tailscale IP tests passed")
  }

  private static func testConnectionModeSelection() {
    let direct = DirectSSHConnectionManager.determineConnectionMode(
      hostAddress: "8.8.8.8",
      requestedMode: .direct
    )
    assert(direct == .direct, "Public IP with direct mode should stay direct")

    let tailscaleDirect = DirectSSHConnectionManager.determineConnectionMode(
      hostAddress: "100.64.0.1",
      requestedMode: .direct
    )
    // iOS has no local Tailscale/WireGuard interface, so a raw direct TCP connect to a
    // Tailscale address has no route and always fails — route it through the relay
    // (which has Headscale mesh connectivity) instead, even though direct was requested.
    assert(tailscaleDirect == .relay, "Tailscale IP with direct mode should route via relay (no local Tailscale interface on iOS)")

    let tailscaleMode = DirectSSHConnectionManager.determineConnectionMode(
      hostAddress: "100.64.0.1",
      requestedMode: .tailscale
    )
    assert(tailscaleMode == .tailscale, "Tailscale IP with tailscale mode should stay tailscale")

    print("✓ Connection mode selection tests passed")
  }
}

// Test target resolution
extension DirectSSHClientTests {
  static func testTargetResolution() {
    let direct = DirectSSHConnectionManager.resolveTarget(
      hostAddress: "8.8.8.8",
      hostPort: 22,
      connectionMode: .direct
    )
    assert(direct.host == "8.8.8.8", "Direct mode should use original host")
    assert(direct.port == 22, "Direct mode should use original port")

    let tailscale = DirectSSHConnectionManager.resolveTarget(
      hostAddress: "100.64.0.1",
      hostPort: 22,
      connectionMode: .tailscale
    )
    assert(tailscale.host == "127.0.0.1", "Tailscale should route to localhost")
    assert(tailscale.port == 2222, "Tailscale should use port 2222")

    print("✓ Target resolution tests passed")
  }
}

#endif
