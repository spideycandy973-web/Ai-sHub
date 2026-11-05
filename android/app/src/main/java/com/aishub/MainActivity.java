package com.aishub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Ai'sHub — package com.aishub
 *
 * Thin native shell around the bundled offline-first web app, plus the
 * PhoneControl bridge that lets the in-app assistant actually act on the phone
 * (alarms, calendar, contacts, apps, settings, flashlight, screen taps).
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register local plugins BEFORE the bridge is created.
        registerPlugin(PhoneControlPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
