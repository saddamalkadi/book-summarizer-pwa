package com.saddamalkadi.aiworkspace;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Main activity for the Capacitor-hosted WebView.
 *
 * Beyond the stock Capacitor bridge we implement:
 *   1. {@link WebChromeClient#onPermissionRequest} — grant mic/video capture
 *      to our own WebView origin so {@code navigator.mediaDevices.getUserMedia}
 *      resolves even after the OS-level RECORD_AUDIO grant is in place.
 *   2. {@link WebChromeClient#onShowFileChooser} — bridge {@code <input type="file">}
 *      (including {@code multiple}, {@code accept=...} and {@code capture})
 *      to Android's Storage Access Framework and, optionally, the camera
 *      or voice-recorder intents so file upload works inside the APK.
 *   3. Runtime CAMERA permission request, fired only when the JS actually
 *      triggers a capture-capable file chooser.
 *   4. Structured Logcat logging (tag = "AIWorkspace/Chooser") mirroring the
 *      JS-side voice session logging contract, so production support can
 *      correlate client-side errors with Android events.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "AIWorkspace/Chooser";

    /** Callback supplied by {@link WebChromeClient#onShowFileChooser}. */
    private ValueCallback<Uri[]> pendingFileCallback;

    /** If the chooser launched a camera/video/audio capture intent, the
     *  FileProvider URI we asked the system to write into. */
    private Uri pendingCaptureUri;

    /** Set when the current chooser was triggered with the capture flag
     *  (so we can grant CAMERA lazily only in that path). */
    private boolean pendingNeedsCamera;

    /** The most recent {@link WebChromeClient.FileChooserParams} — kept so
     *  we can re-launch the chooser after the user grants CAMERA. */
    private WebChromeClient.FileChooserParams pendingChooserParams;

    /** Launcher for the chooser Intent. Registered in {@link #onCreate}. */
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    /** Launcher for the CAMERA runtime permission request. */
    private ActivityResultLauncher<String> cameraPermissionLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                new ActivityResultCallback<ActivityResult>() {
                    @Override
                    public void onActivityResult(ActivityResult result) {
                        handleFileChooserResult(result);
                    }
                });

        cameraPermissionLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestPermission(),
                new ActivityResultCallback<Boolean>() {
                    @Override
                    public void onActivityResult(Boolean granted) {
                        if (Boolean.TRUE.equals(granted)) {
                            Log.i(TAG, "camera_permission granted, re-launching chooser");
                            launchChooserIntent(pendingChooserParams, /*allowCamera=*/ true);
                        } else {
                            Log.w(TAG, "camera_permission denied by user");
                            // Fall back to a pure SAF chooser without camera option.
                            launchChooserIntent(pendingChooserParams, /*allowCamera=*/ false);
                        }
                    }
                });

        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                // Required so <audio> / Web Audio playback driven by network
                // callbacks (TTS replies) is not silently muted by the WebView.
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        // Grant mic / camera capture to our own origin after
                        // the OS-level RECORD_AUDIO / CAMERA runtime grant is
                        // in place. Anything else is denied.
                        try {
                            String[] resources = request.getResources();
                            List<String> allow = new ArrayList<>();
                            for (String r : resources) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)
                                        || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                    allow.add(r);
                                }
                            }
                            if (!allow.isEmpty()) {
                                Log.i(TAG, "webview_permission grant " + allow);
                                request.grant(allow.toArray(new String[0]));
                            } else {
                                Log.w(TAG, "webview_permission deny " + java.util.Arrays.toString(resources));
                                request.deny();
                            }
                        } catch (Throwable t) {
                            Log.e(TAG, "webview_permission error", t);
                            try { request.deny(); } catch (Throwable ignored) {}
                        }
                    }

                    @Override
                    public boolean onShowFileChooser(WebView view,
                                                    ValueCallback<Uri[]> filePathCallback,
                                                    FileChooserParams fileChooserParams) {
                        return handleShowFileChooser(filePathCallback, fileChooserParams);
                    }

                    @Override
                    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                        // Forward WebView console to Logcat so production
                        // support can read voice/artifact diagnostics from
                        // adb logcat without needing Chrome devtools.
                        if (consoleMessage == null) return false;
                        String msg = "webview_console [" + consoleMessage.messageLevel() + "] "
                                + consoleMessage.message()
                                + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")";
                        switch (consoleMessage.messageLevel()) {
                            case ERROR: Log.e(TAG, msg); break;
                            case WARNING: Log.w(TAG, msg); break;
                            case DEBUG: Log.d(TAG, msg); break;
                            default: Log.i(TAG, msg); break;
                        }
                        return true;
                    }
                });
            }
        } catch (Throwable ignored) {
            // Never let WebView tweaks crash the activity.
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    // =========================================================================
    // File chooser pipeline
    // =========================================================================

    private boolean handleShowFileChooser(ValueCallback<Uri[]> filePathCallback,
                                          WebChromeClient.FileChooserParams params) {
        // If a previous chooser never completed, cancel it cleanly so the
        // JS side doesn't hang on a never-resolving <input change> event.
        if (pendingFileCallback != null) {
            try { pendingFileCallback.onReceiveValue(null); } catch (Throwable ignored) {}
            pendingFileCallback = null;
        }
        pendingFileCallback = filePathCallback;
        pendingChooserParams = params;

        boolean wantsCapture = params != null && params.isCaptureEnabled();
        String[] accept = params != null ? params.getAcceptTypes() : null;
        String acceptSummary = accept == null ? "[]" : java.util.Arrays.toString(accept);
        Log.i(TAG, "chooser_show accept=" + acceptSummary
                + " multiple=" + (params != null && params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
                + " capture=" + wantsCapture);

        pendingNeedsCamera = wantsCapture && chooserNeedsCamera(accept);

        if (pendingNeedsCamera && !hasPermission(Manifest.permission.CAMERA)) {
            Log.i(TAG, "chooser_request_camera_permission");
            try {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                return true;
            } catch (Throwable t) {
                Log.e(TAG, "chooser_request_camera_permission failed", t);
            }
        }

        return launchChooserIntent(params, pendingNeedsCamera);
    }

    private boolean launchChooserIntent(WebChromeClient.FileChooserParams params, boolean allowCamera) {
        if (params == null || pendingFileCallback == null) {
            deliverChooserResult(null);
            return false;
        }

        try {
            Intent baseIntent = new Intent(Intent.ACTION_GET_CONTENT);
            baseIntent.addCategory(Intent.CATEGORY_OPENABLE);
            baseIntent.setType("*/*");

            String[] accept = params.getAcceptTypes();
            String[] mimeTypes = normalizeMimeTypes(accept);
            if (mimeTypes != null && mimeTypes.length > 0) {
                // Most pickers honor android.intent.extra.MIME_TYPES.
                baseIntent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
                // Use the broadest common type as the primary filter.
                baseIntent.setType(collapseMimeTypes(mimeTypes));
            }

            if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
                baseIntent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            }

            // Chooser with optional camera/video/audio capture intents as
            // initial intents so the user can take a photo / record audio
            // directly from the <input capture> element.
            List<Intent> captureIntents = new ArrayList<>();
            if (allowCamera) {
                Intent photo = buildCameraCaptureIntent();
                if (photo != null) captureIntents.add(photo);
                Intent video = buildVideoCaptureIntent(accept);
                if (video != null) captureIntents.add(video);
                Intent audio = buildAudioCaptureIntent(accept);
                if (audio != null) captureIntents.add(audio);
            }

            Intent chooser = Intent.createChooser(baseIntent, params.getTitle() != null
                    ? params.getTitle().toString()
                    : "اختيار ملف");
            if (!captureIntents.isEmpty()) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS,
                        captureIntents.toArray(new Intent[0]));
            }

            fileChooserLauncher.launch(chooser);
            Log.i(TAG, "chooser_launched camera=" + allowCamera + " capture_intents=" + captureIntents.size());
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "chooser_launch_failed", t);
            deliverChooserResult(null);
            return false;
        }
    }

    private void handleFileChooserResult(ActivityResult result) {
        try {
            if (result == null) {
                deliverChooserResult(null);
                return;
            }
            int code = result.getResultCode();
            Intent data = result.getData();

            if (code != android.app.Activity.RESULT_OK) {
                Log.i(TAG, "chooser_cancelled code=" + code);
                deliverChooserResult(null);
                return;
            }

            Uri[] results = WebChromeClient.FileChooserParams.parseResult(code, data);
            if ((results == null || results.length == 0) && pendingCaptureUri != null) {
                // Camera/video/audio capture intents don't return data via
                // the Intent, they write to the URI we passed in.
                results = new Uri[]{ pendingCaptureUri };
            }

            Log.i(TAG, "chooser_result files=" + (results == null ? 0 : results.length));
            deliverChooserResult(results);
        } catch (Throwable t) {
            Log.e(TAG, "chooser_result_error", t);
            deliverChooserResult(null);
        } finally {
            pendingCaptureUri = null;
            pendingChooserParams = null;
            pendingNeedsCamera = false;
        }
    }

    private void deliverChooserResult(Uri[] uris) {
        ValueCallback<Uri[]> cb = pendingFileCallback;
        pendingFileCallback = null;
        if (cb != null) {
            try { cb.onReceiveValue(uris); } catch (Throwable ignored) {}
        }
    }

    // =========================================================================
    // Capture intents (image / video / audio)
    // =========================================================================

    private Intent buildCameraCaptureIntent() {
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            Uri uri = createCaptureUri("jpg");
            if (uri == null) return null;
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            pendingCaptureUri = uri;
            return intent;
        } catch (Throwable t) {
            Log.w(TAG, "camera_intent_build_failed", t);
            return null;
        }
    }

    private Intent buildVideoCaptureIntent(String[] accept) {
        if (!acceptIncludesPrefix(accept, "video/")) return null;
        try {
            Intent intent = new Intent(MediaStore.ACTION_VIDEO_CAPTURE);
            Uri uri = createCaptureUri("mp4");
            if (uri == null) return null;
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            pendingCaptureUri = uri;
            return intent;
        } catch (Throwable t) {
            Log.w(TAG, "video_intent_build_failed", t);
            return null;
        }
    }

    private Intent buildAudioCaptureIntent(String[] accept) {
        if (!acceptIncludesPrefix(accept, "audio/")) return null;
        try {
            // Android doesn't really ship a "write to this URI" audio
            // recorder intent the way it does for camera/video, so we just
            // surface the system recorder and let the user pick the file
            // they produced via SAF afterwards.
            Intent intent = new Intent(MediaStore.Audio.Media.RECORD_SOUND_ACTION);
            return intent.resolveActivity(getPackageManager()) != null ? intent : null;
        } catch (Throwable t) {
            Log.w(TAG, "audio_intent_build_failed", t);
            return null;
        }
    }

    private Uri createCaptureUri(String extension) {
        try {
            File dir = new File(getExternalFilesDir(null), "captures");
            if (!dir.exists() && !dir.mkdirs()) {
                Log.w(TAG, "capture_dir_create_failed: " + dir.getAbsolutePath());
            }
            String name = "capture-" + System.currentTimeMillis() + "." + extension;
            File out = new File(dir, name);
            // Ensure the file exists so FileProvider can stat it.
            if (!out.exists()) {
                //noinspection ResultOfMethodCallIgnored
                out.createNewFile();
            }
            String authority = getPackageName() + ".fileprovider";
            return FileProvider.getUriForFile(this, authority, out);
        } catch (Throwable t) {
            Log.e(TAG, "capture_uri_failed", t);
            return null;
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private boolean hasPermission(String perm) {
        return ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean chooserNeedsCamera(String[] accept) {
        if (accept == null || accept.length == 0) return true;
        for (String a : accept) {
            if (a == null) continue;
            String lower = a.toLowerCase();
            if (lower.startsWith("image/") || lower.startsWith("video/")
                    || lower.equals("*/*") || lower.isEmpty()) {
                return true;
            }
        }
        return false;
    }

    private boolean acceptIncludesPrefix(String[] accept, String prefix) {
        if (accept == null || accept.length == 0) return true; // accept="*"
        for (String a : accept) {
            if (a == null) continue;
            String lower = a.toLowerCase();
            if (lower.startsWith(prefix) || lower.equals("*/*")) return true;
        }
        return false;
    }

    /** Expand common `accept` shorthands like ".pdf" into real MIME types. */
    private String[] normalizeMimeTypes(String[] accept) {
        if (accept == null || accept.length == 0) return null;
        List<String> out = new ArrayList<>();
        for (String raw : accept) {
            if (raw == null) continue;
            String a = raw.trim();
            if (a.isEmpty()) continue;
            if (a.contains("/")) {
                out.add(a);
                continue;
            }
            if (a.startsWith(".")) {
                String mime = extensionToMime(a.substring(1).toLowerCase());
                if (mime != null) out.add(mime);
            }
        }
        if (out.isEmpty()) return null;
        return out.toArray(new String[0]);
    }

    private String collapseMimeTypes(String[] mimeTypes) {
        if (mimeTypes == null || mimeTypes.length == 0) return "*/*";
        // If every mime shares the same top-level type, use it; otherwise fall
        // back to */*.
        String top = null;
        for (String m : mimeTypes) {
            int slash = m.indexOf('/');
            if (slash < 0) return "*/*";
            String t = m.substring(0, slash);
            if (top == null) top = t;
            else if (!top.equals(t)) return "*/*";
        }
        return top + "/*";
    }

    private String extensionToMime(String ext) {
        switch (ext) {
            case "pdf": return "application/pdf";
            case "doc": return "application/msword";
            case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xls": return "application/vnd.ms-excel";
            case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "ppt": return "application/vnd.ms-powerpoint";
            case "pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "txt": return "text/plain";
            case "md": return "text/markdown";
            case "csv": return "text/csv";
            case "json": return "application/json";
            case "xml": return "application/xml";
            case "html":
            case "htm": return "text/html";
            case "png": return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "gif": return "image/gif";
            case "svg": return "image/svg+xml";
            case "mp3": return "audio/mpeg";
            case "wav": return "audio/wav";
            case "ogg": return "audio/ogg";
            case "m4a": return "audio/mp4";
            case "mp4": return "video/mp4";
            case "mov": return "video/quicktime";
            case "webm": return "video/webm";
            case "zip": return "application/zip";
            default: return null;
        }
    }
}
