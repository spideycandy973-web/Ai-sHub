# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.aishub.**$$serializer { *; }
-keepclassmembers class com.aishub.** { *** Companion; }
-keepclasseswithmembers class com.aishub.** { kotlinx.serialization.KSerializer serializer(...); }
# OkHttp / Retrofit
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepclasseswithmembers class * { @retrofit2.http.* <methods>; }
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**
