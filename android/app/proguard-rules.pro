# AI Workspace Studio — ProGuard / R8 rules

# Keep Capacitor bridge classes intact
-keep class com.getcapacitor.** { *; }
-keep class com.saddamalkadi.aiworkspace.** { *; }
-dontwarn com.getcapacitor.**

# Keep AndroidX and Google Play core classes
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep JavaScript interfaces (WebView bridge)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep annotations and signatures for reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Suppress obfuscation noise for crash reports
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable

# Suppress warnings from third-party libraries
-dontwarn okio.**
-dontwarn retrofit2.**
-dontwarn org.conscrypt.**
