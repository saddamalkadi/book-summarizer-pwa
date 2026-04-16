# Capacitor WebView bridge — keep all plugin and bridge classes
-keep class com.getcapacitor.** { *; }
-keep class com.saddamalkadi.aiworkspace.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Capacitor plugins
-keep class com.capacitor.** { *; }
-keep class capacitor.** { *; }

# AndroidX
-keep class androidx.** { *; }

# Google Sign-In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Suppress warnings for common libraries
-dontwarn org.apache.**
-dontwarn okhttp3.**
-dontwarn okio.**
