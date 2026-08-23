package app.novossh.android.ssh

/**
 * Test utilities for DirectSSHClient and NetworkClassifier
 * Run via Android instrumentation tests
 */
object DirectSSHClientTests {
    fun runAllTests() {
        println("Testing NetworkClassifier...")
        testPrivateIPRanges()
        testTailscaleIPs()
        testConnectionModeSelection()
        testTargetResolution()
        println("✓ All DirectSSHClient tests passed")
    }

    private fun testPrivateIPRanges() {
        assert(NetworkClassifier.isPrivateIPRange("10.0.0.1")) { "10.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("10.255.255.255")) { "10.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("172.16.0.0")) { "172.16-31.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("172.31.255.255")) { "172.16-31.x should be private" }
        assert(!NetworkClassifier.isPrivateIPRange("172.15.0.0")) { "172.15.x should be public" }
        assert(!NetworkClassifier.isPrivateIPRange("172.32.0.0")) { "172.32.x should be public" }
        assert(NetworkClassifier.isPrivateIPRange("192.168.0.1")) { "192.168.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("192.168.255.255")) { "192.168.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("127.0.0.1")) { "127.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("169.254.0.1")) { "169.254.x should be private" }
        assert(NetworkClassifier.isPrivateIPRange("::1")) { "IPv6 loopback should be private" }
        assert(!NetworkClassifier.isPrivateIPRange("8.8.8.8")) { "Public IP should not be private" }
        assert(!NetworkClassifier.isPrivateIPRange("1.1.1.1")) { "Public IP should not be private" }
        println("✓ Private IP range tests passed")
    }

    private fun testTailscaleIPs() {
        assert(NetworkClassifier.isTailscaleIP("100.64.0.1")) { "100.x should be Tailscale" }
        assert(NetworkClassifier.isTailscaleIP("100.127.255.255")) { "100.x should be Tailscale" }
        assert(NetworkClassifier.isTailscaleIP("myhost.ts.net")) { "*.ts.net should be Tailscale" }
        assert(NetworkClassifier.isTailscaleIP("example.ts.net")) { "*.ts.net should be Tailscale" }
        assert(NetworkClassifier.isTailscaleIP("fd7a:115c:1234:5678::1")) { "fd7a:115c: should be Tailscale" }
        assert(!NetworkClassifier.isTailscaleIP("192.168.1.1")) { "Private IP should not be Tailscale" }
        assert(!NetworkClassifier.isTailscaleIP("example.com")) { "Regular domain should not be Tailscale" }
        println("✓ Tailscale IP tests passed")
    }

    private fun testConnectionModeSelection() {
        val direct = DirectSSHConnectionManager.determineConnectionMode(
            "8.8.8.8",
            SSHConnectionMode.DIRECT
        )
        assert(direct == SSHConnectionMode.DIRECT) { "Public IP with direct mode should stay direct" }

        val tailscaleDirect = DirectSSHConnectionManager.determineConnectionMode(
            "100.64.0.1",
            SSHConnectionMode.DIRECT
        )
        assert(tailscaleDirect == SSHConnectionMode.DIRECT) { "Tailscale IP with direct mode should stay direct" }

        val tailscaleMode = DirectSSHConnectionManager.determineConnectionMode(
            "100.64.0.1",
            SSHConnectionMode.TAILSCALE
        )
        assert(tailscaleMode == SSHConnectionMode.TAILSCALE) { "Tailscale IP with tailscale mode should stay tailscale" }

        println("✓ Connection mode selection tests passed")
    }

    private fun testTargetResolution() {
        val direct = DirectSSHConnectionManager.resolveTarget(
            "8.8.8.8",
            22,
            SSHConnectionMode.DIRECT
        )
        assert(direct.first == "8.8.8.8") { "Direct mode should use original host" }
        assert(direct.second == 22) { "Direct mode should use original port" }

        val tailscale = DirectSSHConnectionManager.resolveTarget(
            "100.64.0.1",
            22,
            SSHConnectionMode.TAILSCALE
        )
        assert(tailscale.first == "127.0.0.1") { "Tailscale should route to localhost" }
        assert(tailscale.second == 2222) { "Tailscale should use port 2222" }

        println("✓ Target resolution tests passed")
    }
}
