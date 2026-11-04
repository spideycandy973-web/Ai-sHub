package com.aishub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Ai'sHub — package com.aishub
 * Thin native shell around the bundled offline-first web app.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // keep the WebView's own back stack handling; Capacitor bridges it for us
    }
}
