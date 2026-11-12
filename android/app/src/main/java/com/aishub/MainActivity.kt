package com.aishub

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aishub.data.settings.AppSettings
import com.aishub.ui.AiHubRoot
import com.aishub.ui.theme.AiHubTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val locator = (application as AiHubApp).locator
        setContent {
            val settings by locator.settings.settings.collectAsStateWithLifecycle(initialValue = AppSettings())
            AiHubTheme(settings.theme) {
                AiHubRoot(locator, settings)
            }
        }
    }
}
