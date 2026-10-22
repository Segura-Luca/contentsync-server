package com.contentsync.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.contentsync.app.core.designsystem.ContentSyncTheme
import com.contentsync.app.core.designsystem.WorkflowStatusBadge
import com.contentsync.app.domain.model.VideoWorkflowStatus
import org.junit.Rule
import org.junit.Test

class ContentSyncUiTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun workflowStatusBadge_displaysCorrectSpanishLabel() {
        composeTestRule.setContent {
            ContentSyncTheme {
                WorkflowStatusBadge(status = VideoWorkflowStatus.APPROVED)
            }
        }
        composeTestRule.onNodeWithText("Aprobado").assertIsDisplayed()
    }
}
