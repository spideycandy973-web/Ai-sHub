package com.aishub;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.admin.DevicePolicyManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.StatFs;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.AlarmClock;
import android.provider.CalendarContract;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.text.format.Formatter;
import android.view.accessibility.AccessibilityManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Ai'sHub · phone control
 *
 * Gives the in-app assistant real, working control over the phone:
 * alarms, timers, calendar events, contacts, SMS, calls, apps, settings,
 * flashlight, volume, media, notifications, clipboard, battery, storage.
 *
 * Runs inside the Ai'sHub WebView so the system permission dialogs are
 * attributed to com.aishub and your key is never involved.
 */
@CapacitorPlugin(
    name = "PhoneControl",
    permissions = {
        @Permission(alias = "contacts", strings = {android.Manifest.permission.READ_CONTACTS}),
        @Permission(alias = "sms", strings = {android.Manifest.permission.SEND_SMS}),
        @Permission(alias = "phone", strings = {android.Manifest.permission.CALL_PHONE}),
        @Permission(alias = "calendarRead", strings = {android.Manifest.permission.READ_CALENDAR}),
        @Permission(alias = "calendarWrite", strings = {android.Manifest.permission.WRITE_CALENDAR}),
        @Permission(alias = "media", strings = {android.Manifest.permission.READ_MEDIA_IMAGES})
    }
)
public class PhoneControlPlugin extends Plugin {

    /* ─────────────────────────── capability report ─────────────────────────── */

    @PluginMethod
    public void capabilities(PluginCall call) {
        JSObject out = new JSObject();
        JSObject features = new JSObject();

        features.put("intents", true);
        features.put("alarms", true);
        features.put("timers", true);
        features.put("calendar", true);
        features.put("contacts", hasPermissionDeclared(android.Manifest.permission.READ_CONTACTS));
        features.put("sms", hasPermissionDeclared(android.Manifest.permission.SEND_SMS));
        features.put("calls", hasPermissionDeclared(android.Manifest.permission.CALL_PHONE));
        features.put("apps", true);
        features.put("settings", true);
        features.put("flashlight", true);
        features.put("volume", true);
        features.put("brightness", true);
        features.put("clipboard", true);
        features.put("battery", true);
        features.put("storage", true);
        features.put("vibrate", true);
        features.put("accessibilityClicks", isAccessibilityServiceEnabled());

        out.put("platform", "android");
        out.put("androidVersion", Build.VERSION.RELEASE);
        out.put("sdkInt", Build.VERSION.SDK_INT);
        out.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        out.put("device", Build.DEVICE);
        out.put("features", features);
        call.resolve(out);
    }

    /* ─────────────────────────── device status ─────────────────────────── */

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        Context ctx = getContext();

        BatteryManager bm = (BatteryManager) ctx.getSystemService(Context.BATTERY_SERVICE);
        out.put("battery", bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : -1);
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null) out.put("charging", pm.isPowerSaveMode() ? "power-save" : (pm.isInteractive() ? "on" : "screen-off"));

        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            out.put("volume", am.getStreamVolume(AudioManager.STREAM_MUSIC));
            out.put("volumeMax", am.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
            out.put("ringerMode", ringerName(am.getRingerMode()));
        }

        TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
        if (tm != null) out.put("operator", tm.getNetworkOperatorName());

        WifiManager wifi = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        out.put("wifi", wifi != null && wifi.isWifiEnabled());

        StatFs stat = new StatFs(ctx.getFilesDir().getPath());
        long free = stat.getAvailableBlocksLong() * stat.getBlockSizeLong();
        long total = stat.getBlockCountLong() * stat.getBlockSizeLong();
        out.put("storageFree", Formatter.formatFileSize(ctx, free));
        out.put("storageTotal", Formatter.formatFileSize(ctx, total));

        SimpleDateFormat fmt = new SimpleDateFormat("EEEE d MMMM yyyy, HH:mm:ss", Locale.getDefault());
        out.put("time", fmt.format(new Date()));
        out.put("timestamp", System.currentTimeMillis());
        call.resolve(out);
    }

    /* ─────────────────────────── alarms & timers ─────────────────────────── */

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        if (hour == null || minute == null) {
            call.reject("hour and minute are required");
            return;
        }
        String label = call.getString("label", "Ai'sHub alarm");
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        launch(intent, call, String.format(Locale.US, "Alarm set for %02d:%02d", hour, minute));
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        String label = call.getString("label", "Ai'sHub timer");
        if (seconds == null || seconds <= 0) {
            call.reject("seconds is required");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        launch(intent, call, "Timer started for " + seconds + "s");
    }

    /* ─────────────────────────── calendar ─────────────────────────── */

    @PluginMethod
    public void createEvent(PluginCall call) {
        String title = call.getString("title", "Ai'sHub event");
        String location = call.getString("location", "");
        Long begin = call.getLong("begin"); // epoch millis
        Long end = call.getLong("end");
        if (end == null) end = (begin != null ? begin : System.currentTimeMillis()) + 3600_000L;

        Intent intent = new Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, title)
            .putExtra(CalendarContract.Events.EVENT_LOCATION, location)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin != null ? begin : System.currentTimeMillis() + 600_000L)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end);
        launch(intent, call, "Opening calendar to add \"" + title + "\"");
    }

    @PluginMethod
    @PermissionCallback
    public void readEvents(PluginCall call) {
        if (!isGranted(call, "calendarRead")) {
            requestPermissionForAlias("calendarRead", call, "readEvents");
            return;
        }
        JSArray events = new JSArray();
        ContentResolver cr = getContext().getContentResolver();
        long now = System.currentTimeMillis();
        String[] proj = {
            CalendarContract.Events.TITLE, CalendarContract.Events.DTSTART, CalendarContract.Events.EVENT_LOCATION
        };
        try (Cursor c = cr.query(
            CalendarContract.Events.CONTENT_URI, proj,
            CalendarContract.Events.DTSTART + " >= ?", new String[]{String.valueOf(now)},
            CalendarContract.Events.DTSTART + " ASC")) {
            int n = 0;
            while (c != null && c.moveToNext() && n++ < 20) {
                JSObject e = new JSObject();
                e.put("title", c.getString(0));
                e.put("start", c.getLong(1));
                e.put("location", c.getString(2));
                events.put(e);
            }
        } catch (Exception err) {
            call.reject("Could not read the calendar: " + err.getMessage());
            return;
        }
        JSObject out = new JSObject();
        out.put("events", events);
        out.put("count", events.length());
        call.resolve(out);
    }

    /* ─────────────────────────── contacts ─────────────────────────── */

    @PluginMethod
    @PermissionCallback
    public void findContact(PluginCall call) {
        if (!isGranted(call, "contacts")) {
            requestPermissionForAlias("contacts", call, "findContact");
            return;
        }
        String query = call.getString("query", "");
        JSArray found = new JSArray();
        String[] proj = {
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER
        };
        String sel = ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?";
        try (Cursor c = getContext().getContentResolver().query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI, proj, sel,
            new String[]{"%" + query + "%"},
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC")) {
            int n = 0;
            while (c != null && c.moveToNext() && n++ < 20) {
                JSObject p = new JSObject();
                p.put("name", c.getString(0));
                p.put("number", c.getString(1));
                found.put(p);
            }
        } catch (Exception err) {
            call.reject("Could not read contacts: " + err.getMessage());
            return;
        }
        JSObject out = new JSObject();
        out.put("contacts", found);
        out.put("count", found.length());
        call.resolve(out);
    }

    /* ─────────────────────────── calls & messaging ─────────────────────────── */

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number", "");
        if (number.trim().isEmpty()) {
            call.reject("number is required");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(number)));
        launch(intent, call, "Opening dialer for " + number);
    }

    @PluginMethod
    @PermissionCallback
    public void sms(PluginCall call) {
        String number = call.getString("number", "");
        String body = call.getString("body", "");
        if (number.trim().isEmpty()) {
            call.reject("number is required");
            return;
        }
        // Prefer the messaging app: nothing is sent behind your back.
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)))
            .putExtra("sms_body", body);
        launch(intent, call, "Opening Messages to send to " + number);
    }

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "Share from Ai'sHub");
        Intent intent = new Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, text);
        Intent chooser = Intent.createChooser(intent, title);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(chooser);
            resolveOk(call, "Opening the share sheet");
        } catch (Exception err) {
            call.reject("Could not open the share sheet: " + err.getMessage());
        }
    }

    /* ─────────────────────────── apps ─────────────────────────── */

    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("package", "");
        if (pkg == null || pkg.trim().isEmpty()) {
            call.reject("package is required");
            return;
        }
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(pkg.trim());
        if (intent == null) {
            call.reject("No launchable app with package " + pkg);
            return;
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            resolveOk(call, "Opened " + pkg);
        } catch (Exception err) {
            call.reject("Could not open " + pkg + ": " + err.getMessage());
        }
    }

    @PluginMethod
    public void listApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        List<ApplicationInfo> apps = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        JSArray out = new JSArray();
        int n = 0;
        for (ApplicationInfo app : apps) {
            if (pm.getLaunchIntentForPackage(app.packageName) == null) continue;
            JSObject o = new JSObject();
            o.put("package", app.packageName);
            o.put("label", pm.getApplicationLabel(app).toString());
            out.put(o);
            if (++n >= 250) break;
        }
        JSObject res = new JSObject();
        res.put("apps", out);
        res.put("count", out.length());
        call.resolve(res);
    }

    /* ─────────────────────────── settings ─────────────────────────── */

    @PluginMethod
    public void openSettings(PluginCall call) {
        String which = call.getString("which", "settings");
        Intent intent;
        switch (which) {
            case "wifi": intent = new Intent(Settings.ACTION_WIFI_SETTINGS); break;
            case "bluetooth": intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS); break;
            case "data": intent = new Intent(Settings.ACTION_DATA_USAGE_SETTINGS); break;
            case "airplane": intent = new Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS); break;
            case "sound": intent = new Intent(Settings.ACTION_SOUND_SETTINGS); break;
            case "display": intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS); break;
            case "location": intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS); break;
            case "battery": intent = new Intent(Intent.ACTION_POWER_USAGE_SUMMARY); break;
            case "apps": intent = new Intent(Settings.ACTION_APPLICATION_SETTINGS); break;
            case "accessibility": intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS); break;
            default: intent = new Intent(Settings.ACTION_SETTINGS); break;
        }
        launch(intent, call, "Opening " + which + " settings");
    }

    /* ─────────────────────────── hardware ─────────────────────────── */

    @PluginMethod
    public void torch(PluginCall call) {
        Boolean on = call.getBoolean("on", true);
        CameraManager cm = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
        if (cm == null) {
            call.reject("No camera service on this device");
            return;
        }
        try {
            String id = null;
            for (String candidate : cm.getCameraIdList()) {
                Boolean flash = cm.getCameraCharacteristics(candidate)
                    .get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (Boolean.TRUE.equals(flash)) { id = candidate; break; }
            }
            if (id == null) {
                call.reject("This device has no flash");
                return;
            }
            cm.setTorchMode(id, on != null && on);
            resolveOk(call, "Flashlight " + (Boolean.TRUE.equals(on) ? "on" : "off"));
        } catch (Exception err) {
            call.reject("Could not switch the flashlight: " + err.getMessage());
        }
    }

    @PluginMethod
    public void volume(PluginCall call) {
        AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (am == null) {
            call.reject("No audio service");
            return;
        }
        if (call.hasOption("level")) {
            Integer level = call.getInt("level");
            am.setStreamVolume(AudioManager.STREAM_MUSIC, level == null ? 0 : level, 0);
            resolveOk(call, "Volume set to " + level);
            return;
        }
        String direction = call.getString("direction", "up");
        int dir = "down".equals(direction) ? AudioManager.ADJUST_LOWER
            : "mute".equals(direction) ? AudioManager.ADJUST_MUTE
            : "unmute".equals(direction) ? AudioManager.ADJUST_UNMUTE
            : AudioManager.ADJUST_RAISE;
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, dir, AudioManager.FLAG_SHOW_UI);
        resolveOk(call, "Volume " + direction);
    }

    @PluginMethod
    @PermissionCallback
    public void brightness(PluginCall call) {
        Integer level = call.getInt("level"); // 0..255
        if (level != null && !Settings.System.canWrite(getContext())) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
            launch(intent, call, "Allow Ai'sHub to change system settings, then try again");
            return;
        }
        try {
            if (level == null) {
                int current = Settings.System.getInt(getContext().getContentResolver(),
                    Settings.System.SCREEN_BRIGHTNESS);
                JSObject out = new JSObject();
                out.put("level", current);
                call.resolve(out);
                return;
            }
            Settings.System.putInt(getContext().getContentResolver(),
                Settings.System.SCREEN_BRIGHTNESS, Math.max(1, Math.min(255, level)));
            resolveOk(call, "Brightness set to " + level);
        } catch (Exception err) {
            call.reject("Could not change brightness: " + err.getMessage());
        }
    }

    @PluginMethod
    public void vibrate(PluginCall call) {
        Integer ms = call.getInt("ms", 200);
        Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) {
            call.reject("No vibrator on this device");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(ms == null ? 200 : ms, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            v.vibrate(ms == null ? 200 : ms);
        }
        resolveOk(call, "Buzzed");
    }

    @PluginMethod
    public void clipboard(PluginCall call) {
        ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) {
            call.reject("No clipboard service");
            return;
        }
        if (call.hasOption("text")) {
            cm.setPrimaryClip(ClipData.newPlainText("Ai'sHub", call.getString("text", "")));
            resolveOk(call, "Copied to the clipboard");
            return;
        }
        JSObject out = new JSObject();
        CharSequence text = cm.getPrimaryClip() != null && cm.getPrimaryClip().getItemCount() > 0
            ? cm.getPrimaryClip().getItemAt(0).coerceToText(getContext()) : "";
        out.put("text", text == null ? "" : text.toString());
        call.resolve(out);
    }

    /* ─────────────────────────── media & files ─────────────────────────── */

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (url.trim().isEmpty()) {
            call.reject("url is required");
            return;
        }
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
        launch(new Intent(Intent.ACTION_VIEW, Uri.parse(url)), call, "Opening " + url);
    }

    @PluginMethod
    public void openMedia(PluginCall call) {
        String which = call.getString("which", "gallery");
        Intent intent;
        switch (which) {
            case "camera": intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE); break;
            case "video": intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE); break;
            default: intent = new Intent(Intent.ACTION_VIEW).setType("image/*"); break;
        }
        launch(intent, call, "Opening " + which);
    }

    @PluginMethod
    public void listMedia(PluginCall call) {
        String kind = call.getString("kind", "image");
        Uri uri = "video".equals(kind) ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            : "audio".equals(kind) ? MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String col = "video".equals(kind) || "audio".equals(kind)
            ? MediaStore.Video.Media.TITLE : MediaStore.Images.Media.DISPLAY_NAME;
        JSArray items = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(uri, new String[]{col}, null, null,
            MediaStore.MediaColumns.DATE_ADDED + " DESC")) {
            int n = 0;
            while (c != null && c.moveToNext() && n++ < 30) items.put(c.getString(0));
        } catch (Exception err) {
            call.reject("Could not list media: " + err.getMessage());
            return;
        }
        JSObject out = new JSObject();
        out.put("items", items);
        out.put("count", items.length());
        call.resolve(out);
    }

    /* ─────────────────────────── accessibility (screen control) ─────────────────────────── */

    @PluginMethod
    public void accessibilityStatus(PluginCall call) {
        JSObject out = new JSObject();
        out.put("enabled", isAccessibilityServiceEnabled());
        out.put("service", getContext().getPackageName() + "/" + AiHubAccessibilityService.class.getName());
        call.resolve(out);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        launch(intent, call, "Enable \u201cAi'sHub control\u201d to let the assistant tap and type for you");
    }

    @PluginMethod
    public void screenAction(PluginCall call) {
        if (!isAccessibilityServiceEnabled()) {
            call.reject("Screen control is off. Enable \u201cAi'sHub control\u201d in Accessibility settings first.");
            return;
        }
        String action = call.getString("action", "");
        AiHubAccessibilityService svc = AiHubAccessibilityService.instance;
        if (svc == null) {
            call.reject("The accessibility service is not running yet — flip it off and on in Accessibility settings.");
            return;
        }
        try {
            switch (action) {
                case "back": svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK); break;
                case "home": svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME); break;
                case "recents": svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS); break;
                case "notifications": svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS); break;
                case "quickSettings": svc.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS); break;
                case "tapText": {
                    String text = call.getString("text", "");
                    boolean ok = svc.tapByText(text);
                    if (!ok) { call.reject("I could not find \"" + text + "\" on screen."); return; }
                    break;
                }
                case "type": {
                    String text = call.getString("text", "");
                    if (!svc.typeText(text)) { call.reject("There is no text field focused on screen."); return; }
                    break;
                }
                case "readScreen": {
                    JSObject out = new JSObject();
                    out.put("text", svc.readScreen());
                    call.resolve(out);
                    return;
                }
                default: call.reject("Unknown screen action: " + action); return;
            }
            resolveOk(call, "Done: " + action);
        } catch (Exception err) {
            call.reject("Screen control failed: " + err.getMessage());
        }
    }

    /* ─────────────────────────── helpers ─────────────────────────── */

    private void launch(Intent intent, PluginCall call, String message) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            resolveOk(call, message);
        } catch (ActivityNotFoundException err) {
            call.reject("This phone has no app that handles that action.");
        } catch (Exception err) {
            call.reject("Could not start that action: " + err.getMessage());
        }
    }

    private void resolveOk(PluginCall call, String message) {
        JSObject out = new JSObject();
        out.put("ok", true);
        out.put("message", message);
        call.resolve(out);
    }

    private boolean hasPermissionDeclared(String permission) {
        return getContext().checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isGranted(PluginCall call, String alias) {
        return getPermissionState(alias) == com.getcapacitor.PermissionState.GRANTED;
    }

    private boolean isAccessibilityServiceEnabled() {
        AccessibilityManager am = (AccessibilityManager) getContext().getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (am == null) return false;
        for (AccessibilityServiceInfo info : am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (info.getResolveInfo() != null
                && info.getResolveInfo().serviceInfo != null
                && AiHubAccessibilityService.class.getName().equals(info.getResolveInfo().serviceInfo.name)) {
                return true;
            }
        }
        return false;
    }

    private String ringerName(int mode) {
        switch (mode) {
            case AudioManager.RINGER_MODE_SILENT: return "silent";
            case AudioManager.RINGER_MODE_VIBRATE: return "vibrate";
            default: return "ring";
        }
    }
}
