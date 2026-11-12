package com.aishub.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aishub.data.settings.AppSettings
import com.aishub.di.ServiceLocator
import com.aishub.ui.screens.agent.AgentScreen
import com.aishub.ui.screens.battle.BattleScreen
import com.aishub.ui.screens.chat.ChatListScreen
import com.aishub.ui.screens.chat.ChatScreen
import com.aishub.ui.screens.dashboard.DashboardScreen
import com.aishub.ui.screens.developer.DeveloperScreen
import com.aishub.ui.screens.errors.ErrorCenterScreen
import com.aishub.ui.screens.image.ImageStudioScreen
import com.aishub.ui.screens.research.ResearchScreen
import com.aishub.ui.screens.settings.SettingsScreen
import com.aishub.ui.screens.voice.VoiceScreen
import com.aishub.ui.screens.workspace.WorkspaceScreen
import kotlinx.coroutines.launch

data class Destination(val route: String, val label: String, val icon: ImageVector)

val bottomDestinations = listOf(
    Destination("chat_list", "Chat", Icons.AutoMirrored.Filled.Chat),
    Destination("agent", "Agent", Icons.Default.SmartToy),
    Destination("battle", "Battle", Icons.Default.Dashboard),
    Destination("workspace", "Workspace", Icons.Default.Folder)
)

val drawerDestinations = listOf(
    Destination("image", "Image Studio", Icons.Default.Image),
    Destination("voice", "Voice AI", Icons.Default.Mic),
    Destination("research", "Research", Icons.Default.Search),
    Destination("developer", "Developer Hub", Icons.Default.Code),
    Destination("dashboard", "Free AI Access", Icons.Default.Dashboard),
    Destination("errors", "Error Center", Icons.Default.Warning),
    Destination("settings", "Settings", Icons.Default.Settings)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiHubRoot(locator: ServiceLocator, settings: AppSettings) {
    val nav = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Text("Ai'sHub", style = androidx.compose.material3.MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(20.dp))
                HorizontalDivider()
                drawerDestinations.forEach { dest ->
                    NavigationDrawerItem(
                        label = { Text(dest.label) },
                        icon = { Icon(dest.icon, contentDescription = dest.label) },
                        selected = currentRoute == dest.route,
                        onClick = {
                            scope.launch { drawerState.close() }
                            nav.navigate(dest.route) {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp)
                    )
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        val label = (bottomDestinations + drawerDestinations).find { it.route == currentRoute }?.label
                            ?: if (currentRoute?.startsWith("chat/") == true) "Chat" else "Ai'sHub"
                        Text(label)
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Open navigation menu")
                        }
                    }
                )
            },
            bottomBar = {
                NavigationBar {
                    bottomDestinations.forEach { dest ->
                        NavigationBarItem(
                            selected = currentRoute == dest.route || (dest.route == "chat_list" && currentRoute?.startsWith("chat/") == true),
                            onClick = {
                                nav.navigate(dest.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(dest.icon, contentDescription = dest.label) },
                            label = { Text(dest.label) }
                        )
                    }
                }
            }
        ) { padding ->
            NavHost(nav, startDestination = "chat_list", modifier = Modifier.padding(padding)) {
                composable("chat_list") { ChatListScreen(locator) { cid -> nav.navigate("chat/$cid") } }
                composable("chat/{cid}") { entry ->
                    ChatScreen(locator, entry.arguments?.getString("cid") ?: "")
                }
                composable("agent") { AgentScreen(locator) }
                composable("battle") { BattleScreen(locator) }
                composable("workspace") { WorkspaceScreen(locator) }
                composable("image") { ImageStudioScreen(locator) }
                composable("voice") { VoiceScreen(locator) }
                composable("research") { ResearchScreen(locator) }
                composable("developer") { DeveloperScreen(locator) }
                composable("dashboard") { DashboardScreen(locator) }
                composable("errors") { ErrorCenterScreen(locator) }
                composable("settings") { SettingsScreen(locator, settings) }
            }
        }
    }
}
