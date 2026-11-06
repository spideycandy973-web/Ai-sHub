run: 42187109604 | job: build | ref: arena/f8879742-ai-shub

===== verify.log =====
verifying out/app-release.apk
package id: com.aishub
=== what this APK demands of the phone ===
targetSdkVersion:'36'
APK bundle: 427455 bytes | css 44712 chars | js 370985 chars | @include 0
boot guard: present | ES2020 operators outside strings: 2
total 6968
-rw-r--r-- 1 runner runner 7135040 Jan  1  1981 classes.dex
dex: found PhoneControl
dex: found AiHubAccessibilityService
dex: found screenAction
dex: found tapByText
dex: found accessibilityStatus
N: android=http://schemas.android.com/apk/res/android (line=2)
  E: manifest (line=2)
    A: http://schemas.android.com/apk/res/android:versionCode(0x0101021b)=7
manifest: accessibility service declared
resources: build revision stamped (()"409155b")

===== publish.log =====
=== OUT CONTENTS ===
total 9544
-rw-r--r-- 1 runner runner 5464794 Nov  6 08:24 app-debug.apk
-rw-r--r-- 1 runner runner 4182976 Nov  6 08:24 app-release.apk
-rw-r--r-- 1 runner runner    2091 Nov  6 08:24 errors.txt
-rw-r--r-- 1 runner runner  102389 Nov  6 08:24 gradle-debug.log
-rw-r--r-- 1 runner runner    8312 Nov  6 08:24 gradle-release.log
=== apksigner probe ===
--- out/app-debug.apk
V2 Signer: certificate DN: C=US, O=Android, CN=Android Debug
V2 Signer: certificate SHA-256 digest: 78c6b65ff899469912c0d9478a48a786509c926b441a67d9f32d2263025891b5
V2 Signer: certificate SHA-1 digest: ed387393bb062ac56fdbea2ab0ac7f56864840a9
V2 Signer: certificate MD5 digest: bffc09d39c935ca61c9ecb55e993be98
--- out/app-release.apk
V2 Signer: certificate DN: CN=Ai'sHub, OU=Mobile, O=Ai'sHub, L=Chattogram, C=BD
V2 Signer: certificate SHA-256 digest: 3c1ea113824e0f664484fa35e13af9ede7e63b878ceccefaee36fd4a92401eea
V2 Signer: certificate SHA-1 digest: 279d5f9e42a2640ea54d7c3b48190cd234999890
V2 Signer: certificate MD5 digest: a81e079f0065821c7bb83336e365cc95
uploaded AisHub-1.0.6-debug.apk
uploaded AisHub-1.0.6-release.apk
AisHub-1.0.5-debug.apk
AisHub-1.0.5-release.apk
AisHub-1.0.6-debug.apk
AisHub-1.0.6-release.apk

===== out/ =====
total 18980
drwxr-xr-x  2 runner runner    4096 Nov  6 08:24 .
drwxr-xr-x 14 runner runner    4096 Nov  6 08:24 ..
-rw-r--r--  1 runner runner 5464794 Nov  6 08:24 AisHub-1.0.6-debug.apk
-rw-r--r--  1 runner runner 4182976 Nov  6 08:24 AisHub-1.0.6-release.apk
-rw-r--r--  1 runner runner 5464794 Nov  6 08:24 app-debug.apk
-rw-r--r--  1 runner runner 4182976 Nov  6 08:24 app-release.apk
-rw-r--r--  1 runner runner    2091 Nov  6 08:24 errors.txt
-rw-r--r--  1 runner runner  102389 Nov  6 08:24 gradle-debug.log
-rw-r--r--  1 runner runner    8312 Nov  6 08:24 gradle-release.log

conclusion of the build step is shown in the workflow summary

===== errors.txt (first 60 matching lines) =====
no errors.txt was produced

===== What went wrong =====

===== tail of gradle-debug.log =====
> Task :app:checkDebugAarMetadata
> Task :app:processDebugNavigationResources
> Task :app:generateDebugResValues
> Task :capacitor-android:generateDebugResValues
> Task :app:compileDebugNavigationResources
> Task :capacitor-android:generateDebugResources
> Task :capacitor-android:packageDebugResources
> Task :capacitor-cordova-android-plugins:generateDebugResValues
> Task :capacitor-cordova-android-plugins:generateDebugResources
> Task :capacitor-cordova-android-plugins:packageDebugResources
> Task :app:mapDebugSourceSetPaths
> Task :app:generateDebugResources
> Task :app:packageDebugResources
> Task :app:mergeDebugResources
> Task :app:createDebugCompatibleScreenManifests
> Task :app:extractDeepLinksDebug
> Task :capacitor-android:extractDeepLinksDebug
> Task :capacitor-cordova-android-plugins:extractDeepLinksDebug
> Task :capacitor-android:compileDebugLibraryResources
> Task :capacitor-android:processDebugManifest
> Task :capacitor-cordova-android-plugins:processDebugManifest
> Task :capacitor-android:parseDebugLocalResources
> Task :app:parseDebugLocalResources
> Task :app:processDebugMainManifest
> Task :app:processDebugManifest
> Task :capacitor-cordova-android-plugins:compileDebugLibraryResources
> Task :app:processDebugManifestForPackage
> Task :capacitor-android:javaPreCompileDebug
> Task :capacitor-cordova-android-plugins:javaPreCompileDebug
> Task :capacitor-cordova-android-plugins:parseDebugLocalResources
> Task :capacitor-android:generateDebugRFile
> Task :app:mergeDebugShaders
> Task :capacitor-cordova-android-plugins:generateDebugRFile

> Task :capacitor-android:compileDebugJavaWithJavac
Note: Some input files use unchecked or unsafe operations.
Note: Recompile with -Xlint:unchecked for details.

> Task :capacitor-cordova-android-plugins:compileDebugJavaWithJavac NO-SOURCE
> Task :app:compileDebugShaders NO-SOURCE
> Task :app:generateDebugAssets UP-TO-DATE
> Task :capacitor-cordova-android-plugins:bundleLibCompileToJarDebug
> Task :capacitor-android:mergeDebugShaders
> Task :capacitor-android:compileDebugShaders NO-SOURCE
> Task :capacitor-android:generateDebugAssets UP-TO-DATE
> Task :capacitor-android:mergeDebugAssets
> Task :capacitor-android:bundleLibCompileToJarDebug
> Task :capacitor-cordova-android-plugins:mergeDebugShaders
> Task :capacitor-cordova-android-plugins:compileDebugShaders NO-SOURCE
> Task :capacitor-cordova-android-plugins:generateDebugAssets UP-TO-DATE
> Task :capacitor-cordova-android-plugins:mergeDebugAssets
> Task :app:mergeDebugAssets
> Task :capacitor-cordova-android-plugins:bundleLibRuntimeToJarDebug
> Task :capacitor-android:bundleLibRuntimeToJarDebug
> Task :app:compressDebugAssets
> Task :app:desugarDebugFileDependencies
> Task :app:processDebugJavaRes NO-SOURCE
> Task :capacitor-android:processDebugJavaRes NO-SOURCE
> Task :capacitor-cordova-android-plugins:processDebugJavaRes NO-SOURCE
> Task :app:processDebugResources
> Task :app:mergeDebugJavaResource

> Task :app:compileDebugJavaWithJavac
Note: Some input files use or override a deprecated API.
Note: Recompile with -Xlint:deprecation for details.

> Task :app:dexBuilderDebug
> Task :app:checkDebugDuplicateClasses
> Task :capacitor-cordova-android-plugins:bundleLibRuntimeToDirDebug
> Task :capacitor-android:bundleLibRuntimeToDirDebug
> Task :app:mergeDebugGlobalSynthetics
> Task :app:mergeDebugJniLibFolders
> Task :capacitor-android:mergeDebugJniLibFolders
> Task :app:mergeProjectDexDebug
> Task :capacitor-android:mergeDebugNativeLibs NO-SOURCE
> Task :capacitor-android:copyDebugJniLibsProjectOnly
> Task :capacitor-cordova-android-plugins:mergeDebugJniLibFolders
> Task :capacitor-cordova-android-plugins:mergeDebugNativeLibs NO-SOURCE
> Task :capacitor-cordova-android-plugins:copyDebugJniLibsProjectOnly
> Task :app:validateSigningDebug
> Task :app:mergeDebugNativeLibs NO-SOURCE
> Task :app:stripDebugDebugSymbols NO-SOURCE
> Task :app:writeDebugAppMetadata
> Task :app:writeDebugSigningConfigVersions
> Task :app:mergeLibDexDebug
> Task :capacitor-android:checkDebugAarMetadata
> Task :capacitor-android:stripDebugDebugSymbols NO-SOURCE
> Task :capacitor-android:copyDebugJniLibsProjectAndLocalJars
> Task :app:mergeExtDexDebug
> Task :capacitor-android:extractDebugAnnotations
> Task :capacitor-android:extractDeepLinksForAarDebug
> Task :capacitor-android:mergeDebugGeneratedProguardFiles
> Task :capacitor-android:mergeDebugConsumerProguardFiles
> Task :capacitor-android:prepareDebugArtProfile
> Task :capacitor-android:prepareLintJarForPublish
> Task :capacitor-android:mergeDebugJavaResource
> Task :capacitor-cordova-android-plugins:checkDebugAarMetadata
> Task :capacitor-android:syncDebugLibJars
> Task :capacitor-android:bundleDebugAar
> Task :capacitor-android:assembleDebug
> Task :capacitor-cordova-android-plugins:stripDebugDebugSymbols NO-SOURCE
> Task :capacitor-cordova-android-plugins:copyDebugJniLibsProjectAndLocalJars
> Task :capacitor-cordova-android-plugins:extractDebugAnnotations
> Task :capacitor-cordova-android-plugins:extractDeepLinksForAarDebug
> Task :capacitor-cordova-android-plugins:mergeDebugGeneratedProguardFiles
> Task :capacitor-cordova-android-plugins:mergeDebugConsumerProguardFiles
> Task :capacitor-cordova-android-plugins:prepareDebugArtProfile
> Task :capacitor-cordova-android-plugins:prepareLintJarForPublish
> Task :capacitor-cordova-android-plugins:mergeDebugJavaResource
> Task :app:packageDebug
> Task :app:createDebugApkListingFileRedirect
> Task :app:assembleDebug
> Task :capacitor-cordova-android-plugins:syncDebugLibJars
> Task :capacitor-cordova-android-plugins:bundleDebugAar
> Task :capacitor-cordova-android-plugins:assembleDebug

[Incubating] Problems report is available at: file:///home/runner/work/Ai-sHub/Ai-sHub/android/build/reports/problems/problems-report.html

BUILD SUCCESSFUL in 1m 24s
93 actionable tasks: 93 executed

===== sdk-check =====
SDK located: /usr/local/lib/android/sdk
openjdk version "21.0.13" 2026-10-20 LTS
OpenJDK Runtime Environment Temurin-21.0.13+9 (build 21.0.13+9-LTS)
OpenJDK 64-Bit Server VM Temurin-21.0.13+9 (build 21.0.13+9-LTS, mixed mode, sharing)

===== merged values.xml (resource compile input) =====
<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:ns1="http://schemas.android.com/tools" xmlns:ns2="urn:oasis:names:tc:xliff:document:1.2">
    <attr format="reference" name="coordinatorLayoutStyle"/>
    <attr format="reference" name="drawerArrowStyle"/>
    <attr format="string" name="fontProviderSystemFontFamily"/>
    <attr format="string" name="fontVariationSettings"/>
    <attr format="dimension" name="height"/>
    <attr format="boolean" name="isLightTheme"/>
    <attr format="reference" name="nestedScrollViewStyle"/>
    <attr format="reference" name="postSplashScreenTheme"/>
    <attr format="dimension" name="splashScreenIconSize"/>
    <attr format="string" name="title"/>
    <attr format="reference" name="windowSplashScreenAnimatedIcon"/>
    <attr format="integer" name="windowSplashScreenAnimationDuration"/>
    <attr format="color" name="windowSplashScreenBackground"/>
    <attr format="color" name="windowSplashScreenIconBackgroundColor"/>
    <bool name="abc_action_bar_embed_tabs">true</bool>
    <bool name="abc_config_actionMenuItemAllCaps">true</bool>
    <color name="abc_decor_view_status_guard">#ff000000</color>
    <color name="abc_decor_view_status_guard_light">#ffffffff</color>
    <color name="abc_search_url_text_normal">#7fa87f</color>
    <color name="abc_search_url_text_pressed">@android:color/black</color>
    <color name="abc_search_url_text_selected">@android:color/black</color>
    <color name="accent_material_dark">@color/material_deep_teal_200</color>
    <color name="accent_material_light">@color/material_deep_teal_500</color>
    <color name="androidx_core_ripple_material_light">#1f000000</color>
    <color name="androidx_core_secondary_text_default_material_light">#8a000000</color>
    <color name="background_floating_material_dark">@color/material_grey_800</color>
    <color name="background_floating_material_light">@android:color/white</color>
    <color name="background_material_dark">@color/material_grey_850</color>
    <color name="background_material_light">@color/material_grey_50</color>
    <color name="bright_foreground_disabled_material_dark">#80ffffff</color>
    <color name="bright_foreground_disabled_material_light">#80000000</color>
    <color name="bright_foreground_inverse_material_dark">@color/bright_foreground_material_light</color>
    <color name="bright_foreground_inverse_material_light">@color/bright_foreground_material_dark</color>
    <color name="bright_foreground_material_dark">@android:color/white</color>
    <color name="bright_foreground_material_light">@android:color/black</color>
    <color name="button_material_dark">#ff5a595b</color>
    <color name="button_material_light">#ffd6d7d7</color>
    <color name="call_notification_answer_color">#1d873b</color>
    <color name="call_notification_decline_color">#d93025</color>
    <color name="colorAccent" ns1:ignore="UnusedResources">#FF4081</color>
    <color name="colorPrimary" ns1:ignore="UnusedResources">#3F51B5</color>
    <color name="colorPrimaryDark" ns1:ignore="UnusedResources">#303F9F</color>
    <color name="dim_foreground_disabled_material_dark">#80bebebe</color>
    <color name="dim_foreground_disabled_material_light">#80323232</color>
    <color name="dim_foreground_material_dark">#ffbebebe</color>
    <color name="dim_foreground_material_light">#ff323232</color>
    <color name="error_color_material_dark">#ff7043</color>
    <color name="error_color_material_light">#ff5722</color>
    <color name="foreground_material_dark">@android:color/white</color>
    <color name="foreground_material_light">@android:color/black</color>
    <color name="highlighted_text_material_dark">#6680cbc4</color>
    <color name="highlighted_text_material_light">#66009688</color>
    <color name="ic_launcher_background">#07070B</color>
    <color name="material_blue_grey_800">#ff37474f</color>
    <color name="material_blue_grey_900">#ff263238</color>
    <color name="material_blue_grey_950">#ff21272b</color>
    <color n
===== every values resource file =====
--- android/app/src/main/res/values/ic_launcher_background.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#07070B</color>
</resources>

--- android/app/src/main/res/values/strings.xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Ai\'sHub</string>
    <string name="title_activity_main">Ai\'sHub</string>
    <string name="package_name">com.aishub</string>
    <string name="custom_url_scheme">com.aishub</string>
    <string name="accessibility_label">Ai\'sHub control</string>
    <string name="accessibility_description">Lets the Ai\'sHub assistant tap buttons and type for you, only when you ask it to. Turn it off any time in Accessibility settings.</string>
</resources>

--- android/app/src/main/res/values/styles.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>

    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">#7C5CFF</item>
        <item name="colorPrimaryDark">#07070B</item>
        <item name="colorAccent">#22D3EE</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>

--- android/app/src/main/res/values/build_info.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="build_rev" translatable="false">409155b</string>
</resources>

--- android/capacitor-cordova-android-plugins/src/main/res/.gitkeep


