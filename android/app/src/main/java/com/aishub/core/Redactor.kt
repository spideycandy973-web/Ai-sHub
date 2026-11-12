package com.aishub.core

/** Redacts likely secrets from diagnostics before they are stored or displayed. */
object Redactor {
    private val patterns = listOf(
        Regex("""(?i)(bearer\s+)[A-Za-z0-9._\-+/=]{8,}""") to "$1[REDACTED]",
        Regex("""(?i)(api[_-]?key["'\s:=]+)[A-Za-z0-9._\-]{8,}""") to "$1[REDACTED]",
        Regex("""(?i)(token["'\s:=]+)[A-Za-z0-9._\-]{8,}""") to "$1[REDACTED]",
        Regex("""AIza[0-9A-Za-z_\-]{20,}""") to "[REDACTED_GOOGLE_KEY]",
        Regex("""gsk_[0-9A-Za-z]{20,}""") to "[REDACTED_GROQ_KEY]",
        Regex("""sk-or-[0-9A-Za-z_\-]{20,}""") to "[REDACTED_OPENROUTER_KEY]",
        Regex("""gh[pousr]_[0-9A-Za-z]{20,}""") to "[REDACTED_GITHUB_TOKEN]",
        Regex("""github_pat_[0-9A-Za-z_]{20,}""") to "[REDACTED_GITHUB_PAT]",
        Regex("""ya29\.[0-9A-Za-z_\-\.]{20,}""") to "[REDACTED_GOOGLE_TOKEN]"
    )

    fun redact(input: String): String {
        var out = input
        for ((regex, replacement) in patterns) out = regex.replace(out, replacement)
        return out
    }
}
