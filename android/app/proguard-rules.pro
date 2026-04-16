# AI Workspace Studio — ProGuard / R8 rules

# Capacitor core bridge — must not be obfuscated
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Main activity
-keep class com.saddamalkadi.aiworkspace.** { *; }

# WebView JS interfaces — keep all annotated @JavascriptInterface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Sign-In / One-Tap
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Speech recognition & TTS plugins
-keep class com.capacitorjs.plugins.** { *; }
-dontwarn com.capacitorjs.plugins.**

# Suppress common warnings from transitive deps
-dontwarn org.apache.**
-dontwarn javax.**
-dontwarn java.lang.invoke.**
-dontwarn sun.misc.**

# Keep line numbers to help diagnose crashes in the field
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Enum safety
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Parcelable
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <fields>;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}
