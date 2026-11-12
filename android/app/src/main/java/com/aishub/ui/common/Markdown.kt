package com.aishub.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Lightweight native Markdown renderer: headings, bold/italic, inline code, fenced code blocks, lists. */
@Composable
fun MarkdownText(markdown: String, modifier: Modifier = Modifier) {
    val blocks = rememberBlocks(markdown)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        blocks.forEach { block ->
            when (block) {
                is MdBlock.Code -> CodeBlock(block.language, block.content)
                is MdBlock.Text -> Text(
                    inlineMarkdown(block.content),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

private sealed class MdBlock {
    data class Text(val content: String) : MdBlock()
    data class Code(val language: String, val content: String) : MdBlock()
}

@Composable
private fun rememberBlocks(markdown: String): List<MdBlock> =
    androidx.compose.runtime.remember(markdown) { parseBlocks(markdown) }

private fun parseBlocks(markdown: String): List<MdBlock> {
    val blocks = mutableListOf<MdBlock>()
    val lines = markdown.lines()
    var i = 0
    val text = StringBuilder()
    fun flushText() {
        if (text.isNotBlank()) blocks += MdBlock.Text(text.toString().trimEnd())
        text.clear()
    }
    while (i < lines.size) {
        val line = lines[i]
        if (line.trimStart().startsWith("```")) {
            flushText()
            val lang = line.trimStart().removePrefix("```").trim()
            val code = StringBuilder()
            i++
            while (i < lines.size && !lines[i].trimStart().startsWith("```")) {
                code.appendLine(lines[i]); i++
            }
            blocks += MdBlock.Code(lang, code.toString().trimEnd())
        } else {
            text.appendLine(line)
        }
        i++
    }
    flushText()
    return blocks
}

private fun inlineMarkdown(src: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < src.length) {
        when {
            src.startsWith("**", i) -> {
                val end = src.indexOf("**", i + 2)
                if (end > 0) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(src.substring(i + 2, end)) }
                    i = end + 2
                } else { append(src[i]); i++ }
            }
            src.startsWith("`", i) -> {
                val end = src.indexOf('`', i + 1)
                if (end > 0) {
                    withStyle(SpanStyle(fontFamily = FontFamily.Monospace, fontSize = 13.sp)) {
                        append(src.substring(i + 1, end))
                    }
                    i = end + 1
                } else { append(src[i]); i++ }
            }
            src.startsWith("### ", i) || src.startsWith("## ", i) || src.startsWith("# ", i) -> {
                val hashes = src.takeWhile { it == '#' }.length
                val end = src.indexOf('\n', i).let { if (it < 0) src.length else it }
                val size = when (hashes) { 1 -> 20.sp; 2 -> 18.sp; else -> 16.sp }
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, fontSize = size)) {
                    append(src.substring(i + hashes + 1, end))
                }
                i = end
            }
            else -> { append(src[i]); i++ }
        }
    }
}

@Composable
fun CodeBlock(language: String, code: String) {
    val clipboard = LocalClipboardManager.current
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                language.ifBlank { "code" },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            IconButton(onClick = { clipboard.setText(AnnotatedString(code)) }) {
                Icon(Icons.Default.ContentCopy, contentDescription = "Copy code block", modifier = Modifier.padding(2.dp))
            }
        }
        Text(
            code,
            fontFamily = FontFamily.Monospace,
            fontSize = 13.sp,
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp)
        )
    }
}
