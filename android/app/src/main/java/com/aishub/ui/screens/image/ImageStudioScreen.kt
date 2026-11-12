package com.aishub.ui.screens.image

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.aishub.di.ServiceLocator
import com.aishub.ui.common.InfoCard
import java.io.File
import java.io.FileOutputStream

/**
 * Image Studio v0.1: LOCAL editing only (crop/rotate/resize), honestly labeled.
 *
 * AI generation status (verified 2026-11-13): Google's image models (Nano Banana line)
 * are paid-only on the API; no compliant free hosted image-generation route was verified.
 * Per the zero-paid policy, AI generation is BLOCKED and clearly disclosed here rather
 * than faked. This screen never fabricates a "generated" image.
 */
@Composable
fun ImageStudioScreen(locator: ServiceLocator) {
    val context = LocalContext.current
    var bitmap by remember { mutableStateOf<Bitmap?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    val assetsDir = remember { File(context.filesDir, "image_assets").apply { mkdirs() } }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    // Downsample large images to protect memory.
                    val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    BitmapFactory.decodeStream(stream, null, opts)
                }
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val opts = BitmapFactory.Options().apply { inSampleSize = 2 }
                    BitmapFactory.decodeStream(stream, null, opts)
                }
            }.onSuccess { bitmap = it; status = "Loaded ${it?.width}×${it?.height}" }
                .onFailure { status = "Could not read image: ${it.message}" }
        }
    }

    fun save() {
        val bmp = bitmap ?: return
        val f = File(assetsDir, "edit_${System.currentTimeMillis()}.png")
        FileOutputStream(f).use { bmp.compress(Bitmap.CompressFormat.PNG, 95, it) }
        status = "Saved to app storage: ${f.name} (${f.length() / 1024} KB)"
    }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            InfoCard(
                "AI generation: BLOCKED (honest status)",
                "Verified 2026-11-13: no compliant FREE hosted image-generation API was found " +
                    "(Gemini image models are API-paid-only; free websites do not imply free APIs). " +
                    "The zero-paid policy forbids paid fallbacks, so AI generation is disabled rather than faked. " +
                    "Local editing below is real and fully offline."
            )
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { picker.launch("image/*") }) { Text("Pick image") }
                OutlinedButton(enabled = bitmap != null, onClick = { save() }) { Text("Save to assets") }
            }
        }
        status?.let { item { Text(it, style = MaterialTheme.typography.bodySmall) } }
        bitmap?.let { bmp ->
            item {
                Image(bmp.asImageBitmap(), contentDescription = "Image being edited",
                    modifier = Modifier.fillMaxWidth().height(300.dp), contentScale = ContentScale.Fit)
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        val m = Matrix().apply { postRotate(90f) }
                        bitmap = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
                        status = "Rotated 90° (local edit)"
                    }) { Text("Rotate") }
                    OutlinedButton(onClick = {
                        val side = minOf(bmp.width, bmp.height)
                        val x = (bmp.width - side) / 2; val y = (bmp.height - side) / 2
                        bitmap = Bitmap.createBitmap(bmp, x, y, side, side)
                        status = "Center-cropped to square (local edit)"
                    }) { Text("Crop □") }
                    OutlinedButton(onClick = {
                        bitmap = Bitmap.createScaledBitmap(bmp, bmp.width / 2, bmp.height / 2, true)
                        status = "Resized 50% (local edit)"
                    }) { Text("Resize ½") }
                }
            }
        }
        item {
            Text("Saved assets: ${assetsDir.listFiles()?.size ?: 0}", style = MaterialTheme.typography.bodySmall)
        }
    }
}
