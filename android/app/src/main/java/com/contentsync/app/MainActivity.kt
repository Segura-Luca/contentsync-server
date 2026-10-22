package com.contentsync.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import com.contentsync.app.core.designsystem.ContentSyncTheme
import com.contentsync.app.core.navigation.ContentSyncAdaptiveShell
import com.contentsync.app.presentation.MainViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val viewModel: MainViewModel = hiltViewModel()
            val uiState by viewModel.uiState.collectAsState()
            val windowSizeClass = calculateWindowSizeClass(this)

            ContentSyncTheme(themePreference = uiState.themeMode) {
                ContentSyncAdaptiveShell(
                    windowSizeClass = windowSizeClass,
                    uiState = uiState,
                    viewModel = viewModel
                )
            }
        }
    }
}
