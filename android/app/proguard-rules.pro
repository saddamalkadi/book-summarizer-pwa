# Capacitor WebView app - keep WebView JS interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# Keep native Google One Tap sign-in
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.libraries.identity.** { *; }

# Keep Capacitor Cordova plugins
-keep class org.apache.cordova.** { *; }

# Don't warn about missing classes from optional dependencies
-dontwarn com.google.android.gms.**
-dontwarn org.apache.cordova.**
-dontwarn com.getcapacitor.**

# Keep JavaScript interface annotations
-keepattributes JavascriptInterface

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}
