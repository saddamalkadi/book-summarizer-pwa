package com.saddamalkadi.aiworkspace;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Configure the Capacitor WebView so the live-voice session's `getUserMedia`
        // call and the subsequent `<audio>` / Web Audio playback work reliably on
        // Android. Without these two settings, the WebView:
        //   - blocks MediaDevices.getUserMedia even when RECORD_AUDIO is granted
        //     (it needs an explicit PermissionRequest grant from the app),
        //   - refuses to play audio that wasn't started inside a user gesture
        //     (the TTS reply in a voice session fires from a network callback).
        try {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        // Auto-grant mic / video capture for our own origin. The
                        // underlying RECORD_AUDIO Android runtime permission is
                        // still required (declared in the manifest and requested
                        // via the SpeechRecognition plugin from JS), so this only
                        // bridges the WebView-level gate.
                        try {
                            String[] resources = request.getResources();
                            boolean wantsMic = false;
                            for (String r : resources) {
                                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)
                                        || PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) {
                                    wantsMic = true;
                                    break;
                                }
                            }
                            if (wantsMic) {
                                request.grant(request.getResources());
                            } else {
                                request.deny();
                            }
                        } catch (Throwable t) {
                            try { request.deny(); } catch (Throwable ignored) {}
                        }
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
}
