package com.aishub

import android.app.Application
import com.aishub.di.ServiceLocator

/** Application entry point. Initializes the manual DI container. */
class AiHubApp : Application() {
    lateinit var locator: ServiceLocator
        private set

    override fun onCreate() {
        super.onCreate()
        locator = ServiceLocator(this)
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                locator.errorCenter.recordBlocking(
                    category = "crash",
                    title = "Uncaught exception on ${thread.name}",
                    throwable = throwable
                )
            } catch (_: Throwable) {
                // Never let diagnostics crash the crash handler.
            }
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    private val defaultHandler: Thread.UncaughtExceptionHandler? =
        Thread.getDefaultUncaughtExceptionHandler()
}
