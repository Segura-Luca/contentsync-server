/**
 * Pantalla única de la app Android: un WebView que muestra la web de ContentSync.
 * Aporta lo que la web no puede hacer sola: elegir archivos de la galería, acceso con Google
 * nativo y conservar la sesión. No contiene lógica de negocio.
 */
package com.contentsync.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import com.contentsync.app.presentation.auth.requestGoogleIdToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Actividad principal. Compose dibuja encima del WebView las pantallas de carga y de error. */
class MainActivity : ComponentActivity() {

    // Función con la que se devuelven a la web los archivos elegidos.
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webViewRef: WebView? = null

    // Estados que controlan qué se ve: carga, error de red y si el botón Atrás navega dentro de la web.
    private var isInitialLoading by mutableStateOf(true)
    private var hasNetworkError by mutableStateOf(false)
    private var canNavigateBack by mutableStateOf(false)

    // Recibe el resultado del selector de archivos y lo entrega a la web (uno o varios archivos, o ninguno si se canceló).
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult

        if (result.resultCode == Activity.RESULT_OK) {
            val data = result.data
            val uris: Array<Uri>? = when {
                data?.clipData != null -> {
                    val count = data.clipData!!.itemCount
                    Array(count) { idx -> data.clipData!!.getItemAt(idx).uri }
                }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
            callback.onReceiveValue(uris)
        } else {
            callback.onReceiveValue(null)
        }
    }

    /** Configura las barras del sistema y crea la interfaz con el WebView. */
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = AndroidColor.parseColor("#0B0C0E")
        window.navigationBarColor = AndroidColor.parseColor("#0B0C0E")
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        val targetUrl = BuildConfig.WEB_APP_URL

        setContent {
            // El botón Atrás navega dentro de la web mientras haya páginas anteriores.
            BackHandler(enabled = canNavigateBack && !hasNetworkError) {
                webViewRef?.goBack()
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF0B0C0E))
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        WebView(context).apply {
                            webViewRef = this
                            setBackgroundColor(AndroidColor.parseColor("#0B0C0E"))

                            // Activa JavaScript y almacenamiento local, y bloquea contenido inseguro y el acceso a archivos del teléfono.
                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                mediaPlaybackRequiresUserGesture = false
                                allowFileAccess = false
                                allowContentAccess = true
                                loadWithOverviewMode = true
                                useWideViewPort = true
                                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            }

                            val wv = this
                            // Acepta cookies: el refresh token de la sesión vive en una.
                            CookieManager.getInstance().apply {
                                setAcceptCookie(true)
                                setAcceptThirdPartyCookies(wv, true)
                            }

                            // Expone a la web el objeto window.ContentSyncAndroid.
                            addJavascriptInterface(AndroidWebBridge(), "ContentSyncAndroid")

                            // Decide qué enlaces se abren dentro de la app y detecta los errores de carga.
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(
                                    view: WebView?,
                                    request: WebResourceRequest?
                                ): Boolean {
                                    val uri = request?.url ?: return false
                                    val scheme = uri.scheme?.lowercase() ?: return false
                                    // Enlaces que no son web (mailto:, tel:): los abre otra aplicación.
                                    if (scheme != "http" && scheme != "https") {
                                        return try {
                                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                                            true
                                        } catch (_: Exception) {
                                            true
                                        }
                                    }

                                    val appHost = Uri.parse(targetUrl).host?.lowercase()
                                    val reqHost = uri.host?.lowercase()
                                    // Acceso social con Facebook y GitHub: necesita la cookie de la sesión del WebView.
                                    // Google lo resuelve el selector nativo y bloquea su autorización dentro de un WebView.
                                    val inAppHosts = listOf("facebook.com", "github.com")
                                    if (appHost != null && reqHost != null && reqHost != appHost &&
                                        inAppHosts.none { reqHost == it || reqHost.endsWith(".$it") }
                                    ) {
                                        return try {
                                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                                            true
                                        } catch (_: Exception) {
                                            false
                                        }
                                    }
                                    return false
                                }

                                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                    super.onPageStarted(view, url, favicon)
                                    canNavigateBack = view?.canGoBack() == true
                                }

                                override fun onPageFinished(view: WebView?, url: String?) {
                                    super.onPageFinished(view, url)
                                    canNavigateBack = view?.canGoBack() == true
                                    if (!hasNetworkError) {
                                        isInitialLoading = false
                                    }
                                }

                                // Solo un fallo de la página principal muestra la pantalla de error; no el de una imagen.
                                override fun onReceivedError(
                                    view: WebView?,
                                    request: WebResourceRequest?,
                                    error: WebResourceError?
                                ) {
                                    super.onReceivedError(view, request, error)
                                    if (request?.isForMainFrame == true) {
                                        hasNetworkError = true
                                        isInitialLoading = false
                                    }
                                }
                            }

                            // Abre el selector de fotos y videos cuando la web lo pide con un input de archivo.
                            webChromeClient = object : WebChromeClient() {
                                override fun onShowFileChooser(
                                    webView: WebView?,
                                    filePathCallbackParam: ValueCallback<Array<Uri>>?,
                                    fileChooserParams: FileChooserParams?
                                ): Boolean {
                                    // Si quedó un pedido anterior sin responder, se cierra antes de abrir otro.
                                    filePathCallback?.onReceiveValue(null)
                                    filePathCallback = filePathCallbackParam

                                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                        addCategory(Intent.CATEGORY_OPENABLE)
                                        type = "*/*"
                                        putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                                    }
                                    return try {
                                        fileChooserLauncher.launch(
                                            Intent.createChooser(intent, "Elegí fotos o videos")
                                        )
                                        true
                                    } catch (_: Exception) {
                                        filePathCallback = null
                                        false
                                    }
                                }
                            }

                            loadUrl(targetUrl)
                        }
                    }
                )

                // Pantalla de carga mientras se abre la web.
                if (isInitialLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF0B0C0E)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(32.dp)
                        ) {
                            CircularProgressIndicator(
                                color = Color(0xFFD4F238),
                                strokeWidth = 3.dp,
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(modifier = Modifier.height(20.dp))
                            Text(
                                text = "CONTENTSYNC",
                                color = Color(0xFFF2F3F5),
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                letterSpacing = 2.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Conectando con el estudio en la nube...",
                                color = Color(0xFF949BA6),
                                fontSize = 13.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                // Pantalla de error con un botón para reintentar.
                if (hasNetworkError) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF0B0C0E))
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .border(1.dp, Color(0xFF282D37), RoundedCornerShape(8.dp))
                                .background(Color(0xFF13151A), RoundedCornerShape(8.dp))
                                .padding(28.dp)
                        ) {
                            Text(
                                text = "CONEXIÓN EN ESPERA",
                                color = Color(0xFFD4F238),
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                letterSpacing = 1.5.sp
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "El servidor se está iniciando o no hay señal de internet en este momento.",
                                color = Color(0xFFF2F3F5),
                                fontSize = 14.sp,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(20.dp))
                            Button(
                                onClick = {
                                    hasNetworkError = false
                                    isInitialLoading = true
                                    webViewRef?.loadUrl(targetUrl)
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFFD4F238),
                                    contentColor = Color(0xFF0B0C0E)
                                ),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    text = "Reintentar ahora",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    /** Al volver a la app, avisa a la web para que actualice los datos. */
    override fun onResume() {
        super.onResume()
        webViewRef?.evaluateJavascript("window.__onAppResume && window.__onAppResume();", null)
    }

    override fun onPause() {
        super.onPause()
        // El WebView escribe las cookies con demora: si Android cierra la app se perdería la sesión.
        CookieManager.getInstance().flush()
    }

    /** Puente entre la web y Android: sus métodos se llaman desde JavaScript. */
    inner class AndroidWebBridge {
        /** Abre el selector de cuentas y devuelve el token, o el error, a window.__onAndroidGoogleToken. */
        @JavascriptInterface
        fun signInWithGoogle() {
            lifecycleScope.launch(Dispatchers.Main) {
                // El token de Google solo se entrega a nuestra propia web, nunca a un proveedor abierto en el WebView.
                val currentHost = webViewRef?.url?.let { Uri.parse(it).host?.lowercase() }
                if (currentHost != Uri.parse(BuildConfig.WEB_APP_URL).host?.lowercase()) return@launch
                val res = requestGoogleIdToken(this@MainActivity)
                res.fold(
                    onSuccess = { token ->
                        val js = "window.__onAndroidGoogleToken && window.__onAndroidGoogleToken(${JSONObject.quote(token)}, null);"
                        webViewRef?.post { webViewRef?.evaluateJavascript(js, null) }
                    },
                    onFailure = { err ->
                        val msg = err.message ?: "No se pudo completar el acceso con Google."
                        val js = "window.__onAndroidGoogleToken && window.__onAndroidGoogleToken(null, ${JSONObject.quote(msg)});"
                        webViewRef?.post { webViewRef?.evaluateJavascript(js, null) }
                    }
                )
            }
        }
    }
}
