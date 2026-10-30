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
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.json.JSONObject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var webViewRef: WebView? = null

    private var isInitialLoading by mutableStateOf(true)
    private var hasNetworkError by mutableStateOf(false)
    private var canNavigateBack by mutableStateOf(false)

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

                            settings.apply {
                                javaScriptEnabled = true
                                domStorageEnabled = true
                                databaseEnabled = true
                                mediaPlaybackRequiresUserGesture = false
                                allowFileAccess = true
                                allowContentAccess = true
                                loadWithOverviewMode = true
                                useWideViewPort = true
                                mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                                userAgentString = userAgentString.replace("; wv", "")
                            }

                            val wv = this
                            CookieManager.getInstance().apply {
                                setAcceptCookie(true)
                                setAcceptThirdPartyCookies(wv, true)
                            }

                            addJavascriptInterface(AndroidWebBridge(), "ContentSyncAndroid")

                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(
                                    view: WebView?,
                                    request: WebResourceRequest?
                                ): Boolean {
                                    val uri = request?.url ?: return false
                                    val scheme = uri.scheme?.lowercase() ?: return false
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
                                    if (appHost != null && reqHost != null && reqHost != appHost &&
                                        !reqHost.endsWith("accounts.google.com") &&
                                        !reqHost.endsWith("facebook.com")
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

                            webChromeClient = object : WebChromeClient() {
                                override fun onShowFileChooser(
                                    webView: WebView?,
                                    filePathCallbackParam: ValueCallback<Array<Uri>>?,
                                    fileChooserParams: FileChooserParams?
                                ): Boolean {
                                    filePathCallback?.onReceiveValue(null)
                                    filePathCallback = filePathCallbackParam

                                    val acceptTypes = fileChooserParams?.acceptTypes
                                        ?.filter { it.isNotBlank() }
                                        ?: emptyList()
                                    val mime = if (acceptTypes.any { it.contains("video") }) "video/*" else "*/*"

                                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                        addCategory(Intent.CATEGORY_OPENABLE)
                                        type = mime
                                    }
                                    return try {
                                        fileChooserLauncher.launch(
                                            Intent.createChooser(intent, "Elegí el archivo de video")
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

    inner class AndroidWebBridge {
        @JavascriptInterface
        fun signInWithGoogle() {
            lifecycleScope.launch {
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
