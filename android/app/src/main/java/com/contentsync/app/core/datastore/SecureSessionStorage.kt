package com.contentsync.app.core.datastore

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.contentsync.app.domain.model.ThemeModePreference
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore by preferencesDataStore(name = "contentsync_preferences")

/**
 * Almacenamiento seguro de Access Token y Refresh Token utilizando Android Keystore
 * (`EncryptedSharedPreferences` con AES256_GCM) y `DataStore` para preferencias de tema.
 */
@Singleton
class SecureSessionStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val encryptedPrefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            context,
            "contentsync_secure_tokens",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveTokens(accessToken: String, refreshToken: String, expiresAtEpochMs: Long) {
        encryptedPrefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_EXPIRES_AT, expiresAtEpochMs)
            .apply()
    }

    fun getAccessToken(): String? = encryptedPrefs.getString(KEY_ACCESS_TOKEN, null)

    fun getRefreshToken(): String? = encryptedPrefs.getString(KEY_REFRESH_TOKEN, null)

    fun isAccessTokenExpired(): Boolean {
        val expiresAt = encryptedPrefs.getLong(KEY_EXPIRES_AT, 0L)
        return System.currentTimeMillis() >= expiresAt
    }

    fun clearTokens() {
        encryptedPrefs.edit().clear().apply()
    }

    val themeModeFlow: Flow<ThemeModePreference> = context.dataStore.data.map { prefs ->
        val raw = prefs[KEY_THEME_MODE] ?: ThemeModePreference.SYSTEM.name
        runCatching { ThemeModePreference.valueOf(raw) }.getOrDefault(ThemeModePreference.SYSTEM)
    }

    suspend fun setThemeMode(mode: ThemeModePreference) {
        context.dataStore.edit { prefs ->
            prefs[KEY_THEME_MODE] = mode.name
        }
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "jwt_access_token"
        private const val KEY_REFRESH_TOKEN = "jwt_refresh_token"
        private const val KEY_EXPIRES_AT = "jwt_expires_at"
        private val KEY_THEME_MODE = stringPreferencesKey("ui_theme_mode")
    }
}
