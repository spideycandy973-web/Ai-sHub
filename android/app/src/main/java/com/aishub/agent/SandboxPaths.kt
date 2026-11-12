package com.aishub.agent

import java.io.File

/** Pure path-safety logic, unit-testable without Android. */
object SandboxPaths {
    fun resolve(base: File, relative: String): File {
        require(relative.isNotBlank()) { "Empty path" }
        require(!relative.startsWith("/") && !relative.startsWith("\\")) { "Absolute paths not allowed: $relative" }
        val canonicalBase = base.canonicalFile
        val target = File(canonicalBase, relative).canonicalFile
        require(target.path == canonicalBase.path || target.path.startsWith(canonicalBase.path + File.separator)) {
            "Path escapes project sandbox: $relative"
        }
        return target
    }
}
