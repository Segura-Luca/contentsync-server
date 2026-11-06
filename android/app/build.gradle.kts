/** Configuración de compilación de la app Android: versiones, URL de la web, firma del APK y dependencias. */
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.contentsync.app"
    compileSdk = 34

    // Identificador de la app, versiones de Android admitidas (minSdk/targetSdk) y versión publicada.
    defaultConfig {
        applicationId = "com.contentsync.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "2.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
        // URL que abre la app. Se toma de -PWEB_APP_URL, de una variable de entorno o del valor por defecto.
        val webAppUrl = (project.findProperty("WEB_APP_URL") as? String)
            ?: System.getenv("WEB_APP_URL")
            ?: "https://contentsync-app.onrender.com/"
        buildConfigField("String", "API_BASE_URL", "\"${webAppUrl.trimEnd('/')}/api/v1/\"")
        buildConfigField("String", "WEB_APP_URL", "\"$webAppUrl\"")
        // Cliente OAuth de Google para el acceso nativo. Este identificador es público; no es un secreto.
        val googleWebClientId = (project.findProperty("GOOGLE_WEB_CLIENT_ID") as? String)
            ?: System.getenv("GOOGLE_WEB_CLIENT_ID")
            ?: "1094596610720-789upd6feoki20vhiirbk8msov3uitps.apps.googleusercontent.com"
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
    }

    // La firma vive fuera de Git: android/keystore.properties (ver keystore.properties.example)
    // o las variables KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS y KEY_PASSWORD.
    // Sin ellas, assembleRelease genera un APK sin firmar.
    val signingProps = Properties().apply {
        val propsFile = rootProject.file("keystore.properties")
        if (propsFile.exists()) propsFile.inputStream().use { load(it) }
    }
    fun signing(env: String, prop: String): String? = System.getenv(env) ?: signingProps.getProperty(prop)
    val keystoreFile = signing("KEYSTORE_PATH", "storeFile")?.let { rootProject.file(it) }
    val keystorePassword = signing("KEYSTORE_PASSWORD", "storePassword")
    val canSignRelease = keystoreFile?.exists() == true && !keystorePassword.isNullOrBlank()

    signingConfigs {
        create("release") {
            if (canSignRelease) {
                storeFile = keystoreFile
                storePassword = keystorePassword
                keyAlias = signing("KEY_ALIAS", "keyAlias") ?: "contentsync"
                keyPassword = signing("KEY_PASSWORD", "keyPassword") ?: keystorePassword
            }
        }
    }

    // debug: para desarrollo, sin ofuscar. release: reducido y ofuscado, para distribuir.
    buildTypes {
        debug {
            isMinifyEnabled = false
            // Permite http:// solo en desarrollo (por ejemplo http://10.0.2.2:3000 en el emulador).
            manifestPlaceholders["usesCleartextTraffic"] = "true"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            manifestPlaceholders["usesCleartextTraffic"] = "false"
            if (canSignRelease) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // Activa Jetpack Compose (pantallas de carga y error) y la clase BuildConfig.
    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// Librerías de la app.
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)

    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")

    // Acceso con Google nativo (Credential Manager)
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
