package com.aishub

import com.aishub.core.Redactor
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RedactorTest {
    @Test
    fun `redacts google api key`() {
        val input = "failed with key AIzaSyD-abcdefghijklmnopqrstuvwxyz123456789"
        val out = Redactor.redact(input)
        assertFalse(out.contains("AIzaSyD-abcdefghijklmnopqrstuvwxyz"))
        assertTrue(out.contains("[REDACTED_GOOGLE_KEY]"))
    }

    @Test
    fun `redacts bearer tokens`() {
        val out = Redactor.redact("Authorization: Bearer abcdef1234567890abcdef")
        assertFalse(out.contains("abcdef1234567890abcdef"))
    }

    @Test
    fun `redacts groq and openrouter keys`() {
        assertFalse(Redactor.redact("gsk_abcdefghijklmnopqrstuvwxyz123456").contains("gsk_abcdefghij"))
        assertFalse(Redactor.redact("sk-or-v1-abcdefghijklmnopqrstuvwxyz123456").contains("sk-or-v1-abcdefghij"))
    }

    @Test
    fun `redacts github tokens`() {
        assertFalse(Redactor.redact("ghp_abcdefghijklmnopqrstuvwxyz1234567890").contains("ghp_abcdefghij"))
        assertFalse(Redactor.redact("github_pat_abcdefghijklmnopqrstuvwxyz1234567890").contains("github_pat_abcdefghij"))
    }

    @Test
    fun `leaves normal text alone`() {
        val text = "The model responded with a helpful answer about Kotlin."
        assertTrue(Redactor.redact(text) == text)
    }
}
