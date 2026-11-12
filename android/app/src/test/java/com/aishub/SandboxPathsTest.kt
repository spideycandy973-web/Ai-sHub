package com.aishub

import com.aishub.agent.SandboxPaths
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class SandboxPathsTest {
    @get:Rule val tmp = TemporaryFolder()

    @Test
    fun `normal relative path resolves inside sandbox`() {
        val base = tmp.newFolder("project")
        val f = SandboxPaths.resolve(base, "src/main.txt")
        assertTrue(f.canonicalPath.startsWith(base.canonicalPath))
    }

    @Test
    fun `parent traversal is rejected`() {
        val base = tmp.newFolder("project")
        try {
            SandboxPaths.resolve(base, "../secrets.txt")
            fail("Expected rejection")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("escapes"))
        }
    }

    @Test
    fun `nested traversal is rejected`() {
        val base = tmp.newFolder("project")
        try {
            SandboxPaths.resolve(base, "a/../../outside.txt")
            fail("Expected rejection")
        } catch (e: IllegalArgumentException) { /* expected */ }
    }

    @Test
    fun `absolute path is rejected`() {
        val base = tmp.newFolder("project")
        try {
            SandboxPaths.resolve(base, "/etc/passwd")
            fail("Expected rejection")
        } catch (e: IllegalArgumentException) { /* expected */ }
    }

    @Test
    fun `symlink escape is rejected`() {
        val base = tmp.newFolder("project")
        val outside = tmp.newFolder("outside")
        val link = File(base, "evil-link")
        try {
            java.nio.file.Files.createSymbolicLink(link.toPath(), outside.toPath())
        } catch (e: UnsupportedOperationException) {
            return // platform without symlinks; canonical check still tested elsewhere
        }
        try {
            SandboxPaths.resolve(base, "evil-link/data.txt")
            fail("Expected rejection")
        } catch (e: IllegalArgumentException) { /* expected */ }
    }
}
