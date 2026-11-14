package com.edgenote.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

// Home-screen quick capture. The bar opens the capture bubble, the check opens
// it as a task, and the logo opens the app.
class CaptureWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val capture = PendingIntent.getActivity(
      context, 1, CaptureActivity.intent(context, asTask = false), flags
    )
    val captureTask = PendingIntent.getActivity(
      context, 2, CaptureActivity.intent(context, asTask = true), flags
    )
    val openApp = PendingIntent.getActivity(
      context, 3,
      Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      flags
    )
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_capture).apply {
        setOnClickPendingIntent(R.id.widget_root, capture)
        setOnClickPendingIntent(R.id.widget_hint, capture)
        setOnClickPendingIntent(R.id.widget_task, captureTask)
        setOnClickPendingIntent(R.id.widget_mark, openApp)
      }
      manager.updateAppWidget(id, views)
    }
  }
}
