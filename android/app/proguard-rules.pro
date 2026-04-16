# AI Workspace Studio — ProGuard/R8 rules for release build

# Keep line numbers for crash reporting (strip source file names)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ── Capacitor core ──────────────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class com.getcapacitor.plugin.** { *; }

# ── App package ─────────────────────────────────────────────────────────────
-keep class com.saddamalkadi.aiworkspace.** { *; }

# ── WebView JavaScript interface ────────────────────────────────────────────
-keepclassmembers class * extends android.webkit.WebView {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Google Sign-In ───────────────────────────────────────────────────────────
-keep class com.google.android.gms.** { *; }
-keep interface com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ── Speech recognition (Capacitor community plugin) ─────────────────────────
-keep class com.capacitorjs.community.speechrecognition.** { *; }

# ── Text to speech ──────────────────────────────────────────────────────────
-keep class com.getcapacitor.community.texttospeech.** { *; }

# ── Google One Tap ──────────────────────────────────────────────────────────
-keep class com.plugin.nativegoogleonetap.** { *; }

# ── AndroidX & Support ──────────────────────────────────────────────────────
-keep class androidx.** { *; }
-keep interface androidx.** { *; }
-dontwarn androidx.**

# ── Prevent stripping of Parcelable implementations ─────────────────────────
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

# ── Serialization ────────────────────────────────────────────────────────────
-keepclassmembers class * implements java.io.Serializable {
    private static final long serialVersionUID;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ── General safety ───────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
