package com.aishub;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Ai'sHub — package com.aishub
 *
 * Thin native shell around the bundled offline-first web app, plus the
 * PhoneControl bridge that lets the in-app assistant act on the phone.
 *
 * It also refuses to ever show a silent white screen:
 *  - a stale service worker from an older build is deleted before the WebView starts
 *  - if the web app has not reported a healthy boot, a native panel shows exactly
 *    why (with the build revision, Android and WebView versions) instead of nothing
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "AiHubBoot";
    private static final String PREFS = "aishub_boot";
    private static final String KEY_REV = "rev_cleaned";

    private int attempts = 0;
    private boolean overlayShown = false;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Clear a stale service worker BEFORE the WebView exists: while it controls
        // the page it serves the OLD bundle, so JS can never unregister it in time.
        try {
            resetServiceWorkerIfNewBuild();
        } catch (Throwable t) {
            Log.w(TAG, "service worker reset failed", t);
        }

        // A native plugin must never be able to stop the app from starting.
        try {
            registerPlugin(PhoneControlPlugin.class);
        } catch (Throwable t) {
            Log.e(TAG, "PhoneControl plugin registration failed", t);
        }

        super.onCreate(savedInstanceState);

        try {
            WebView.setWebContentsDebuggingEnabled(true);
            ui.postDelayed(this::checkBoot, 5000);
        } catch (Throwable t) {
            Log.e(TAG, "could not schedule the boot check", t);
        }
    }

    private String buildRev() {
        try {
            return getString(R.string.build_rev);
        } catch (Throwable t) {
            return "unknown";
        }
    }

    private void resetServiceWorkerIfNewBuild() {
        SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String rev = buildRev();
        if (rev.equals(sp.getString(KEY_REV, ""))) return;

        File data = getApplicationInfo().dataDir != null
            ? new File(getApplicationInfo().dataDir)
            : getFilesDir().getParentFile();
        if (data != null) {
            // Only the service-worker store: IndexedDB (your chats) lives elsewhere.
            deleteTree(new File(data, "app_webview/Default/Service Worker"));
            deleteTree(new File(data, "app_webview/Service Worker"));
        }
        sp.edit().putString(KEY_REV, rev).apply();
        Log.i(TAG, "cleared stale service worker for build " + rev);
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) {
            for (File k : kids) deleteTree(k);
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    private void checkBoot() {
        if (overlayShown) return;
        final WebView webView;
        try {
            webView = getBridge() != null ? getBridge().getWebView() : null;
        } catch (Throwable t) {
            showOverlay("The web view never started", "Native shell is running, but Capacitor could not give me a WebView.\n\n" + environment());
            return;
        }
        if (webView == null) {
            showOverlay("The web view never started", "Capacitor returned no WebView for this activity.\n\n" + environment());
            return;
        }

        String js = "(function(){try{"
            + "return 'boot=' + (window.AIHUB_BOOTED === true)"
            + " + '|url=' + String(location.href)"
            + " + '|scripts=' + document.scripts.length"
            + " + '|styles=' + document.querySelectorAll('style').length"
            + " + '|guard=' + (typeof window.AIHUB_BOOT_ERROR === 'function')"
            + " + '|ua=' + navigator.userAgent"
            + " + '|stage=' + String(window.AIHUB_STAGE || 'none')"
            + " + '|bootlog=' + JSON.stringify(window.AIHUB_BOOT_LOG || []).slice(0, 300)"
            + " + '|text=' + String((document.body && document.body.innerText) || '').replace(/\\s+/g,' ').slice(0, 400);"
            + "}catch(e){return 'js-error=' + e.message;}})()";

        try {
            webView.evaluateJavascript(js, new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    String report = unquote(value);
                    if (report.contains("boot=true")) {
                        Log.i(TAG, "boot ok: " + report);
                        return;
                    }
                    attempts++;
                    if (attempts == 1) {
                        // One silent retry: a half-written cache can fail once and then work.
                        Log.w(TAG, "boot not ready, reloading once: " + report);
                        try {
                            webView.reload();
                        } catch (Throwable ignored) {
                        }
                        ui.postDelayed(MainActivity.this::checkBoot, 7000);
                        return;
                    }
                    showOverlay("Ai'sHub did not finish starting", report + "\n\n" + environment());
                }
            });
        } catch (Throwable t) {
            showOverlay("Could not inspect the page", t.toString() + "\n\n" + environment());
        }
    }

    private String environment() {
        String webview = "unknown";
        try {
            webview = WebSettings.getDefaultUserAgent(this);
        } catch (Throwable ignored) {
        }
        String installed = "unknown";
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            installed = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(new Date(pi.lastUpdateTime));
        } catch (Throwable ignored) {
        }
        return "build: " + buildRev()
            + "\npackage: " + getPackageName()
            + "\ninstalled: " + installed
            + "\nAndroid " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")"
            + "\nwebview: " + webview;
    }

    private static String unquote(String value) {
        if (value == null) return "(no reply from the page)";
        String s = value;
        if (s.length() > 1 && s.startsWith("\"") && s.endsWith("\"")) {
            s = s.substring(1, s.length() - 1);
        }
        return s.replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\").replace("\\u003c", "<");
    }

    private void showOverlay(final String title, final String detail) {
        if (overlayShown) return;
        overlayShown = true;

        int pad = (int) (20 * getResources().getDisplayMetrics().density);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(Color.parseColor("#07070B"));
        box.setPadding(pad, pad, pad, pad);

        TextView head = new TextView(this);
        head.setText(title);
        head.setTextColor(Color.parseColor("#FF7AB6"));
        head.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        head.setPadding(0, 0, 0, pad / 2);
        box.addView(head);

        TextView body = new TextView(this);
        body.setText(detail);
        body.setTextColor(Color.parseColor("#B9B7D0"));
        body.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        body.setTypeface(android.graphics.Typeface.MONOSPACE);
        body.setTextIsSelectable(true);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(body);
        LinearLayout.LayoutParams scrollParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        box.addView(scroll, scrollParams);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, pad / 2, 0, 0);

        Button copy = new Button(this);
        copy.setText("Copy report");
        copy.setOnClickListener(v -> {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Ai'sHub report", title + "\n" + detail));
            Toast.makeText(this, "Report copied", Toast.LENGTH_SHORT).show();
        });
        row.addView(copy);

        Button reload = new Button(this);
        reload.setText("Reload");
        reload.setOnClickListener(v -> {
            try {
                overlayShown = false;
                attempts = 0;
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().reload();
                }
            } catch (Throwable ignored) {
            }
            ui.postDelayed(this::checkBoot, 6000);
        });
        row.addView(reload);

        box.addView(row);

        try {
            addContentView(box, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        } catch (Throwable t) {
            Log.e(TAG, "could not show the diagnostics panel", t);
        }
        Log.e(TAG, title + " :: " + detail);
    }
}
