# Capacitor / WebView — keep JS interface classes
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Sign-In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep WebView JavaScript interface
-keepattributes JavascriptInterface

# Keep line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
