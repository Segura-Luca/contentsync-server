package com.contentsync.app.core.di

import android.content.Context
import androidx.room.Room
import com.contentsync.app.BuildConfig
import com.contentsync.app.core.database.CachedVideoDao
import com.contentsync.app.core.database.ContentSyncDatabase
import com.contentsync.app.core.network.ContentSyncApiService
import com.contentsync.app.core.network.JwtAuthInterceptor
import com.contentsync.app.core.network.TokenRefreshAuthenticator
import com.contentsync.app.data.repository.ContentSyncRepositoryImpl
import com.contentsync.app.domain.repository.ContentSyncRepository
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryBindingModule {
    @Binds
    @Singleton
    abstract fun bindContentSyncRepository(
        impl: ContentSyncRepositoryImpl
    ): ContentSyncRepository
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkAndDatabaseModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(
        jwtAuthInterceptor: JwtAuthInterceptor,
        tokenRefreshAuthenticator: TokenRefreshAuthenticator
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor(jwtAuthInterceptor)
            .addInterceptor(logging)
            .authenticator(tokenRefreshAuthenticator)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ContentSyncApiService {
        return retrofit.create(ContentSyncApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ContentSyncDatabase {
        return Room.databaseBuilder(
            context,
            ContentSyncDatabase::class.java,
            "contentsync_offline.db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideCachedVideoDao(db: ContentSyncDatabase): CachedVideoDao = db.cachedVideoDao()
}
