package com.haibao.carhelper;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.NetworkInterface;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ProgressBar progressBar;
    private TextView titleView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);
        titleView = findViewById(R.id.titleView);

        titleView.setText(R.string.app_name);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(ProgressBar.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(ProgressBar.GONE);
                }
            }
        });

        webView.addJavascriptInterface(new NativeBridge(this), "Native");

        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public class NativeBridge {

        private final Activity activity;

        public NativeBridge(Activity activity) {
            this.activity = activity;
        }

        // ==================== 设备信息 ====================

        @JavascriptInterface
        public String getDeviceInfo() {
            try {
                StringBuilder sb = new StringBuilder("{");
                sb.append("\"model\":\"").append(Build.MODEL).append("\",");
                sb.append("\"brand\":\"").append(Build.BRAND).append("\",");
                sb.append("\"manufacturer\":\"").append(Build.MANUFACTURER).append("\",");
                sb.append("\"android_version\":\"").append(Build.VERSION.RELEASE).append("\",");
                sb.append("\"sdk\":\"").append(Build.VERSION.SDK_INT).append("\",");
                sb.append("\"serial\":\"").append(getSerial()).append("\",");
                DisplayMetrics dm = new DisplayMetrics();
                activity.getWindowManager().getDefaultDisplay().getMetrics(dm);
                sb.append("\"screen_size\":\"").append(dm.widthPixels).append("x").append(dm.heightPixels).append("\",");
                sb.append("\"device\":\"").append(Build.DEVICE).append("\",");
                sb.append("\"product\":\"").append(Build.PRODUCT).append("\"");
                sb.append("}");
                return sb.toString();
            } catch (Exception e) {
                return "{\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        private String getSerial() {
            try {
                return Build.SERIAL;
            } catch (Exception e) {
                return "unknown";
            }
        }

        // ==================== Shell 命令 ====================

        @JavascriptInterface
        public String execShell(String command) {
            try {
                String[] cmd = {"sh", "-c", command};
                Process process = Runtime.getRuntime().exec(cmd);

                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }

                BufferedReader errReader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream()));
                StringBuilder errOutput = new StringBuilder();
                while ((line = errReader.readLine()) != null) {
                    errOutput.append(line).append("\n");
                }

                process.waitFor();

                StringBuilder sb = new StringBuilder("{");
                sb.append("\"success\":").append(process.exitValue() == 0).append(",");
                sb.append("\"output\":").append(jsonStr(output.toString())).append(",");
                sb.append("\"error\":").append(jsonStr(errOutput.toString()));
                sb.append("}");
                return sb.toString();
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== 应用管理 ====================

        @JavascriptInterface
        public String listPackages() {
            try {
                String[] cmd = {"sh", "-c", "pm list packages -3 2>/dev/null || pm list packages"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                List<String> pkgs = new ArrayList<>();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("package:")) {
                        pkgs.add(line.substring(8).trim());
                    }
                }
                process.waitFor();

                Collections.sort(pkgs);
                StringBuilder sb = new StringBuilder("{\"packages\":[");
                for (int i = 0; i < pkgs.size(); i++) {
                    if (i > 0) sb.append(",");
                    sb.append("\"").append(pkgs.get(i)).append("\"");
                }
                sb.append("],\"total\":").append(pkgs.size()).append("}");
                return sb.toString();
            } catch (Exception e) {
                return "{\"packages\":[],\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String launchApp(String pkg) {
            try {
                String[] cmd = {"sh", "-c", "monkey -p " + pkg + " -c android.intent.category.LAUNCHER 1 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
                process.waitFor();
                String result = output.toString();
                return "{\"success\":" + (result.contains("Events injected") || result.contains("No activities")) +
                    ",\"output\":" + jsonStr(result) + "}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String uninstallApp(String pkg) {
            try {
                String[] cmd = {"sh", "-c", "pm uninstall " + pkg + " 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
                process.waitFor();
                String result = output.toString();
                return "{\"success\":" + result.contains("Success") + ",\"output\":" + jsonStr(result) + "}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== APK 安装 ====================

        @JavascriptInterface
        public String installApk(String base64Data, String fileName) {
            try {
                File cacheDir = activity.getExternalCacheDir();
                if (cacheDir == null) cacheDir = activity.getCacheDir();
                File apkFile = new File(cacheDir, fileName);

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                FileOutputStream fos = new FileOutputStream(apkFile);
                fos.write(bytes);
                fos.close();

                String[] cmd = {"sh", "-c", "pm install -r \"" + apkFile.getAbsolutePath() + "\" 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
                process.waitFor();

                apkFile.delete();

                String result = output.toString();
                return "{\"success\":" + (result.contains("Success") || result.contains("INSTALL_PARSE_FAILED_NO_CERTIFICATES") == false) +
                    ",\"output\":" + jsonStr(result) + "}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== 文件管理 ====================

        @JavascriptInterface
        public String listFiles(String path) {
            try {
                File dir = new File(path);
                if (!dir.exists() || !dir.isDirectory()) {
                    return "{\"files\":[],\"path\":\"" + path + "\",\"error\":\"directory not found\"}";
                }

                File[] files = dir.listFiles();
                StringBuilder sb = new StringBuilder("{\"files\":[");
                if (files != null) {
                    boolean first = true;
                    for (File f : files) {
                        if (f.getName().startsWith(".")) continue;
                        if (!first) sb.append(",");
                        first = false;
                        sb.append("{\"name\":\"").append(escapeJson(f.getName())).append("\",");
                        sb.append("\"is_dir\":").append(f.isDirectory()).append(",");
                        sb.append("\"size\":").append(f.length()).append(",");
                        sb.append("\"last_modified\":").append(f.lastModified()).append("}");
                    }
                }
                sb.append("],\"path\":\"").append(escapeJson(path)).append("\"}");
                return sb.toString();
            } catch (Exception e) {
                return "{\"files\":[],\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String deleteFile(String path) {
            try {
                File f = new File(path);
                boolean success = f.delete();
                return "{\"success\":" + success + "}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== 截图 ====================

        @JavascriptInterface
        public String takeScreenshot() {
            try {
                File cacheDir = activity.getExternalCacheDir();
                if (cacheDir == null) cacheDir = activity.getCacheDir();
                File screenshot = new File(cacheDir, "screenshot_" + System.currentTimeMillis() + ".png");

                String[] cmd = {"sh", "-c", "screencap -p \"" + screenshot.getAbsolutePath() + "\" 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                process.waitFor();

                if (!screenshot.exists()) {
                    return "{\"success\":false,\"error\":\"screenshot failed\"}";
                }

                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inPreferredConfig = Bitmap.Config.RGB_565;
                Bitmap bitmap = BitmapFactory.decodeFile(screenshot.getAbsolutePath(), opts);

                if (bitmap == null) {
                    screenshot.delete();
                    return "{\"success\":false,\"error\":\"decode failed\"}";
                }

                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.PNG, 50, bos);
                bitmap.recycle();

                String base64 = Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
                screenshot.delete();

                return "{\"success\":true,\"image\":\"" + base64 + "\"}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== 设备控制 ====================

        @JavascriptInterface
        public String controlDevice(String action) {
            try {
                String cmd;
                switch (action) {
                    case "reboot":
                        cmd = "reboot";
                        break;
                    case "recovery":
                        cmd = "reboot recovery";
                        break;
                    case "bootloader":
                        cmd = "reboot bootloader";
                        break;
                    case "shutdown":
                        cmd = "reboot -p";
                        break;
                    default:
                        return "{\"success\":false,\"error\":\"unknown action\"}";
                }

                Runtime.getRuntime().exec(new String[]{"sh", "-c", cmd});
                return "{\"success\":true,\"message\":\"command sent\"}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String sendKey(int keycode) {
            try {
                String[] cmd = {"sh", "-c", "input keyevent " + keycode + " 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                process.waitFor();
                return "{\"success\":true}";
            } catch (Exception e) {
                return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String tap(int x, int y) {
            return execShell("input tap " + x + " " + y);
        }

        @JavascriptInterface
        public String swipe(int x1, int y1, int x2, int y2, int duration) {
            return execShell("input swipe " + x1 + " " + y1 + " " + x2 + " " + y2 + " " + duration);
        }

        // ==================== 日志 ====================

        @JavascriptInterface
        public String getLogcat(int lines) {
            try {
                String[] cmd = {"sh", "-c", "logcat -d -t " + lines + " 2>&1"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder sb = new StringBuilder("{\"logs\":[");
                String line;
                boolean first = true;
                while ((line = reader.readLine()) != null) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append("\"").append(escapeJson(line)).append("\"");
                }
                sb.append("]}");
                process.waitFor();
                return sb.toString();
            } catch (Exception e) {
                return "{\"logs\":[],\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        // ==================== 系统信息 ====================

        @JavascriptInterface
        public String getStorageInfo() {
            try {
                String[] cmd = {"sh", "-c", "df -h /data 2>/dev/null || df -h /sdcard 2>/dev/null"};
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream()));
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
                process.waitFor();
                return "{\"output\":" + jsonStr(output.toString()) + "}";
            } catch (Exception e) {
                return "{\"output\":\"\",\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String getTopActivity() {
            return execShell("dumpsys activity activities | grep mResumedActivity");
        }

        // ==================== 工具方法 ====================

        private String jsonStr(String s) {
            if (s == null) return "\"\"";
            return "\"" + escapeJson(s) + "\"";
        }

        private String escapeJson(String s) {
            if (s == null) return "";
            StringBuilder sb = new StringBuilder();
            for (char c : s.toCharArray()) {
                switch (c) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (c < 0x20) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                }
            }
            return sb.toString();
        }
    }
}
