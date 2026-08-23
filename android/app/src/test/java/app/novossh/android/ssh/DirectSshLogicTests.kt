package app.novossh.android.ssh

import app.novossh.android.models.ConnectionMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DirectSshLogicTests {

    @Test
    fun `private ip ranges are classified correctly`() {
        assertTrue(NetworkClassifier.isPrivateIPRange("10.0.0.1"))
        assertTrue(NetworkClassifier.isPrivateIPRange("10.255.255.255"))
        assertTrue(NetworkClassifier.isPrivateIPRange("172.16.0.0"))
        assertTrue(NetworkClassifier.isPrivateIPRange("172.31.255.255"))
        assertFalse(NetworkClassifier.isPrivateIPRange("172.15.0.0"))
        assertFalse(NetworkClassifier.isPrivateIPRange("172.32.0.0"))
        assertTrue(NetworkClassifier.isPrivateIPRange("192.168.0.1"))
        assertTrue(NetworkClassifier.isPrivateIPRange("192.168.255.255"))
        assertTrue(NetworkClassifier.isPrivateIPRange("127.0.0.1"))
        assertTrue(NetworkClassifier.isPrivateIPRange("169.254.0.1"))
        assertTrue(NetworkClassifier.isPrivateIPRange("::1"))
        assertFalse(NetworkClassifier.isPrivateIPRange("8.8.8.8"))
        assertFalse(NetworkClassifier.isPrivateIPRange("1.1.1.1"))
    }

    @Test
    fun `tailscale ips and domains are classified correctly`() {
        assertTrue(NetworkClassifier.isTailscaleIP("100.64.0.1"))
        assertTrue(NetworkClassifier.isTailscaleIP("100.127.255.255"))
        assertTrue(NetworkClassifier.isTailscaleIP("myhost.ts.net"))
        assertTrue(NetworkClassifier.isTailscaleIP("example.ts.net"))
        assertTrue(NetworkClassifier.isTailscaleIP("fd7a:115c:1234:5678::1"))
        assertFalse(NetworkClassifier.isTailscaleIP("192.168.1.1"))
        assertFalse(NetworkClassifier.isTailscaleIP("example.com"))
    }

    @Test
    fun `connection mode stays direct for requested direct`() {
        assertEquals(
            SSHConnectionMode.DIRECT,
            DirectSSHConnectionManager.determineConnectionMode("8.8.8.8", SSHConnectionMode.DIRECT)
        )
    }

    @Test
    fun `tailscale mode falls back to direct for non-tailscale address`() {
        assertEquals(
            SSHConnectionMode.DIRECT,
            DirectSSHConnectionManager.determineConnectionMode("8.8.8.8", SSHConnectionMode.TAILSCALE)
        )
    }

    @Test
    fun `tailscale mode remains tailscale for tailscale address`() {
        assertEquals(
            SSHConnectionMode.TAILSCALE,
            DirectSSHConnectionManager.determineConnectionMode("100.64.0.1", SSHConnectionMode.TAILSCALE)
        )
    }

    @Test
    fun `null requested mode defaults to relay`() {
        assertEquals(
            SSHConnectionMode.RELAY,
            DirectSSHConnectionManager.determineConnectionMode("8.8.8.8", null)
        )
    }

    @Test
    fun `direct mode resolves to original target`() {
        val result = DirectSSHConnectionManager.resolveTarget("8.8.8.8", 22, SSHConnectionMode.DIRECT)
        assertEquals("8.8.8.8", result.first)
        assertEquals(22, result.second)
    }

    @Test
    fun `tailscale mode resolves to localhost and tunnel port`() {
        val result = DirectSSHConnectionManager.resolveTarget("100.64.0.1", 22, SSHConnectionMode.TAILSCALE)
        assertEquals("127.0.0.1", result.first)
        assertEquals(2222, result.second)
    }

    @Test
    fun `relay mode resolves to original target`() {
        val result = DirectSSHConnectionManager.resolveTarget("1.2.3.4", 2222, SSHConnectionMode.RELAY)
        assertEquals("1.2.3.4", result.first)
        assertEquals(2222, result.second)
    }

    @Test
    fun `tailscale mode custom port override`() {
        val result = DirectSSHConnectionManager.resolveTarget(
            "100.64.0.1",
            22,
            SSHConnectionMode.TAILSCALE,
            tailscalePort = 8080
        )
        assertEquals("127.0.0.1", result.first)
        assertEquals(8080, result.second)
    }
}
