# El puente JavaScript se invoca por nombre desde la web.
-keepclassmembers class com.contentsync.app.MainActivity$AndroidWebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
