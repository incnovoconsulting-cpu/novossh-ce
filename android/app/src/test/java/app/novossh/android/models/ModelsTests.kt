package app.novossh.android.models

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.*

class ModelsTests {

    @Test
    fun `host default values are sensible`() {
        val host = Host(label = "home", address = "192.168.1.10", username = "root")
        assertEquals("home", host.label)
        assertEquals(22, host.port)
        assertEquals(AuthMethod.PASSWORD, host.authMethod)
        assertEquals(ProxyType.NONE, host.proxyType)
        assertEquals(ConnectionMode.DIRECT, host.connectionMode)
        assertTrue(host.id.isNotBlank())
        assertTrue(host.createdAt > 0)
        assertTrue(host.updatedAt > 0)
    }

    @Test
    fun `host tags are stored as comma separated string`() {
        val host = Host(label = "work", address = "10.0.0.1", username = "dev", tags = "aws,prod,us")
        assertEquals("aws,prod,us", host.tags)
    }

    @Test
    fun `snippet default timestamp is recent`() {
        val before = System.currentTimeMillis()
        val snippet = Snippet(label = "ls", command = "ls -la")
        val after = System.currentTimeMillis()
        assertTrue(snippet.createdAt in before..after)
    }

    @Test
    fun `sftp file icon for folders`() {
        val folder = SFTPFile(name = "src", path = "/src", isDirectory = true)
        assertEquals("folder", folder.icon)
    }

    @Test
    fun `sftp file size formatting`() {
        val file = SFTPFile(name = "a.txt", path = "/a.txt", isDirectory = false, size = 512)
        assertEquals("512 B", file.sizeFormatted)

        val kb = SFTPFile(name = "b.txt", path = "/b.txt", isDirectory = false, size = 2048)
        assertEquals("2 KB", kb.sizeFormatted)

        val mb = SFTPFile(name = "c.txt", path = "/c.txt", isDirectory = false, size = 5L * 1024 * 1024)
        assertEquals("5 MB", mb.sizeFormatted)

        val gb = SFTPFile(name = "d.txt", path = "/d.txt", isDirectory = false, size = 2L * 1024 * 1024 * 1024)
        assertEquals("2 GB", gb.sizeFormatted)
    }

    @Test
    fun `user settings defaults`() {
        val settings = UserSettings()
        assertEquals(14, settings.fontSize)
        assertEquals("Monospace", settings.fontFamily)
        assertTrue(settings.cursorBlink)
        assertEquals(5000, settings.scrollback)
        assertEquals(30, settings.keepAliveSeconds)
        assertTrue(settings.sendOnEnter)
        assertFalse(settings.hasSeenOnboarding)
    }
}
