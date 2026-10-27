package com.astrosoulpath.astro_soul_path

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.app.Activity
import android.content.Intent
import java.util.concurrent.Executors

class MainActivity : FlutterActivity() {
    private var pending: MethodChannel.Result? = null
    private var pdfBytes: ByteArray? = null
    private val worker = Executors.newSingleThreadExecutor()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "asp/kundli_pdf_export")
            .setMethodCallHandler { call, result ->
                if (call.method != "savePdf") { result.notImplemented(); return@setMethodCallHandler }
                if (pending != null) { result.error("busy", "A PDF save is already active", null); return@setMethodCallHandler }
                val bytes = call.argument<ByteArray>("bytes")
                val name = call.argument<String>("name")
                if (bytes == null || bytes.size < 16 || name == null || !name.endsWith(".pdf") || name.contains('/') || name.contains('\\')) {
                    result.error("invalid_pdf", "Invalid PDF export", null); return@setMethodCallHandler
                }
                pending = result; pdfBytes = bytes
                try {
                    startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "application/pdf"
                        putExtra(Intent.EXTRA_TITLE, name)
                    }, 4817)
                } catch (_: Exception) { pending = null; pdfBytes = null; result.error("picker_unavailable", "Save picker unavailable", null) }
            }
    }

    @Deprecated("Android legacy activity result bridge")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != 4817) { super.onActivityResult(requestCode, resultCode, data); return }
        val callback = pending ?: return
        val bytes = pdfBytes
        val uri = data?.data
        if (resultCode == Activity.RESULT_CANCELED) { pending = null; pdfBytes = null; callback.success(null); return }
        if (resultCode != Activity.RESULT_OK || uri == null || bytes == null) {
            pending = null; pdfBytes = null; callback.error("save_failed", "No export destination", null); return
        }
        worker.execute {
            try {
                val output = contentResolver.openOutputStream(uri, "wt") ?: error("No output stream")
                output.use { it.write(bytes); it.flush() }
                val input = contentResolver.openInputStream(uri) ?: error("Cannot verify saved PDF")
                input.use {
                    val buffer = ByteArray(8192)
                    var offset = 0
                    while (true) {
                        val count = it.read(buffer)
                        if (count == -1) break
                        if (offset + count > bytes.size) error("Size mismatch")
                        for (i in 0 until count) if (buffer[i] != bytes[offset + i]) error("Content mismatch")
                        offset += count
                    }
                    if (offset != bytes.size) error("Incomplete save")
                }
                runOnUiThread { pending = null; pdfBytes = null; callback.success(uri.toString()) }
            } catch (_: Exception) {
                runOnUiThread { pending = null; pdfBytes = null; callback.error("save_failed", "PDF write or verification failed", null) }
            }
        }
    }
}
