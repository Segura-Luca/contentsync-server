# ============================================================================
# Reglas R8 / ProGuard para Release de ContentSync Android
# ============================================================================

# Conservar modelos serializables y DTOs de Retrofit / Gson
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers class com.contentsync.app.data.remote.** { *; }
-keep class com.contentsync.app.core.network.** { *; }
-keep class com.contentsync.app.domain.model.** { *; }

# Retrofit & OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Google Tink / AndroidX Security Crypto (EncryptedSharedPreferences)
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.crypto.tink.**
-keep class com.google.crypto.tink.** { *; }

# Room Database
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**
