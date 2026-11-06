# Reglas de R8/ProGuard: evita que la compilación Release elimine o renombre código que se usa por su nombre.
# El puente JavaScript se invoca por nombre desde la web.
-keepclassmembers class com.contentsync.app.MainActivity$AndroidWebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
