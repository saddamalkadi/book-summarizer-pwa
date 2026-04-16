# Capacitor requires these classes
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# WebView + JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Keep Capacitor bridge and plugin communication
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**

# Keep AndroidX components
-keep class androidx.** { *; }
-dontwarn androidx.**

# Preserve annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses

# Hide source file info in stack traces
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
