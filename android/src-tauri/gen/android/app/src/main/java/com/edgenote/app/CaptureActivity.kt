package com.edgenote.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

// The capture bubble: the site's /capture.html in a small floating window over
// whatever is on screen. It runs in the app's process, so its WebView shares
// the app's sign-in cookies. The page asks to close (or to open the app) by
// navigating to /__capture/done or /__capture/open; those are caught here.
class CaptureActivity : ComponentActivity() {
  companion object {
    private const val SITE = "https://lightpink-pheasant-889269.hostingersite.com"
    private const val EXTRA_TASK = "task"

    fun intent(context: Context, asTask: Boolean): Intent =
      Intent(context, CaptureActivity::class.java)
        .putExtra(EXTRA_TASK, asTask)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
  }

  private lateinit var web: WebView

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density

    // Tapping the dimmed area around the bubble closes it.
    val root = FrameLayout(this).apply { setOnClickListener { finish() } }

    web = WebView(this).apply {
      setBackgroundColor(Color.TRANSPARENT)
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      isFocusable = true
      isFocusableInTouchMode = true
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val path = request.url.path ?: return false
          if (!path.startsWith("/__capture/")) return false
          if (path == "/__capture/open") {
            startActivity(
              Intent(this@CaptureActivity, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
          }
          finish()
          return true
        }

        override fun onPageFinished(view: WebView, url: String) {
          view.requestFocus()
          view.evaluateJavascript("window.__edgeCaptureReady && window.__edgeCaptureReady();", null)
          WindowCompat.getInsetsController(window, view).show(WindowInsetsCompat.Type.ime())
        }
      }
    }

    // A bubble near the top, clear of the status bar, so the keyboard never covers it.
    val bubbleParams = FrameLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT, (168 * density).toInt(), Gravity.TOP
    ).apply {
      val side = (6 * density).toInt()
      setMargins(side, (24 * density).toInt(), side, 0)
    }
    root.addView(web, bubbleParams)
    setContentView(root)

    ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      view.setPadding(bars.left, bars.top, bars.right, 0)
      insets
    }

    val task = if (intent.getBooleanExtra(EXTRA_TASK, false)) "&task=1" else ""
    web.loadUrl("$SITE/capture.html?bubble=1$task")
  }

  override fun onDestroy() {
    web.destroy()
    super.onDestroy()
  }
}
