package com.contentsync.app.presentation.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.contentsync.app.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * Abre el selector oficial de cuentas de Google del dispositivo. El usuario elige y autoriza
 * una cuenta propia; devuelve el token firmado por Google que el servidor verifica.
 */
suspend fun requestGoogleIdToken(context: Context): Result<String> {
    val request = GetCredentialRequest.Builder()
        .addCredentialOption(GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build())
        .build()
    return try {
        val result = CredentialManager.create(context).getCredential(context, request)
        val credential = result.credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            Result.success(GoogleIdTokenCredential.createFrom(credential.data).idToken)
        } else {
            Result.failure(IllegalStateException("No pudimos obtener tu cuenta de Google."))
        }
    } catch (e: GetCredentialCancellationException) {
        Result.failure(IllegalStateException("Cancelaste el acceso con Google."))
    } catch (e: NoCredentialException) {
        Result.failure(IllegalStateException("No hay cuentas de Google en este dispositivo. Agregá una e intentá de nuevo."))
    } catch (e: GoogleIdTokenParsingException) {
        Result.failure(IllegalStateException("No pudimos leer la respuesta de Google."))
    } catch (e: GetCredentialException) {
        Result.failure(IllegalStateException("No pudimos abrir el acceso con Google. Intentá de nuevo."))
    }
}
