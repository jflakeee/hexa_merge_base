#if UNITY_EDITOR
namespace HexaMerge.Editor
{
    using UnityEditor;
    using UnityEngine;
    using System.IO;

    /// <summary>
    /// WebGL 및 Android 빌드를 자동화하는 에디터 유틸리티.
    /// 메뉴: HexaMerge > Build
    /// </summary>
    public static class BuildHelper
    {
        private static readonly string[] GameScenes = new string[]
        {
            "Assets/Scenes/GameScene.unity"
        };

        // ─────────────────────────────────────
        // WebGL 빌드
        // ─────────────────────────────────────

        [MenuItem("HexaMerge/Build/WebGL (Development)")]
        public static void BuildWebGLDev()
        {
            BuildWebGL(true);
        }

        [MenuItem("HexaMerge/Build/WebGL (Release)")]
        public static void BuildWebGLRelease()
        {
            BuildWebGL(false);
        }

        private static void BuildWebGL(bool isDevelopment)
        {
            string outputPath = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Build/WebGL");

            if (!Directory.Exists(outputPath))
                Directory.CreateDirectory(outputPath);

            // WebGL 빌드 설정 (GitHub Pages 등 정적 호스팅 호환을 위해 압축 비활성화)
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.linkerTarget = WebGLLinkerTarget.Wasm;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
            PlayerSettings.WebGL.template = "PROJECT:HexaMerge";

            // 코드 스트리핑
            PlayerSettings.stripEngineCode = true;

            var options = new BuildPlayerOptions
            {
                scenes = GameScenes,
                locationPathName = outputPath,
                target = BuildTarget.WebGL,
                options = isDevelopment
                    ? BuildOptions.Development | BuildOptions.ConnectWithProfiler
                    : BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(options);

            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                Debug.Log("[BuildHelper] WebGL 빌드 성공: " + outputPath);
                Debug.Log("[BuildHelper] 빌드 크기: " +
                    (report.summary.totalSize / (1024f * 1024f)).ToString("F2") + " MB");
            }
            else
            {
                Debug.LogError("[BuildHelper] WebGL 빌드 실패: " + report.summary.result);
            }
        }

        // ─────────────────────────────────────
        // Android 빌드
        // ─────────────────────────────────────

        [MenuItem("HexaMerge/Build/Android APK (Development)")]
        public static void BuildAndroidAPKDev()
        {
            BuildAndroid(false, true);
        }

        [MenuItem("HexaMerge/Build/Android APK (Release)")]
        public static void BuildAndroidAPKRelease()
        {
            BuildAndroid(false, false);
        }

        [MenuItem("HexaMerge/Build/Android AAB (Release)")]
        public static void BuildAndroidAABRelease()
        {
            BuildAndroid(true, false);
        }

        private static void BuildAndroid(bool isAAB, bool isDevelopment)
        {
            string ext = isAAB ? ".aab" : ".apk";
            string suffix = isDevelopment ? "_dev" : "";
            string fileName = "HexaMerge" + suffix + ext;
            string outputPath = Path.Combine(
                Directory.GetParent(Application.dataPath).FullName,
                "Build/Android",
                fileName);

            string dir = Path.GetDirectoryName(outputPath);
            if (!Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            // Android 빌드 설정
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel22;
            PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)33;
            EditorUserBuildSettings.buildAppBundle = isAAB;

            // IL2CPP + ARM64
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            var options = new BuildPlayerOptions
            {
                scenes = GameScenes,
                locationPathName = outputPath,
                target = BuildTarget.Android,
                options = isDevelopment
                    ? BuildOptions.Development | BuildOptions.ConnectWithProfiler
                    : BuildOptions.None
            };

            var report = BuildPipeline.BuildPlayer(options);

            if (report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
            {
                Debug.Log("[BuildHelper] Android 빌드 성공: " + outputPath);
                Debug.Log("[BuildHelper] 빌드 크기: " +
                    (report.summary.totalSize / (1024f * 1024f)).ToString("F2") + " MB");
            }
            else
            {
                Debug.LogError("[BuildHelper] Android 빌드 실패: " + report.summary.result);
            }
        }

        // ─────────────────────────────────────
        // 유틸리티
        // ─────────────────────────────────────

        [MenuItem("HexaMerge/Build/Open Build Folder")]
        public static void OpenBuildFolder()
        {
            string buildPath = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Build");
            if (!Directory.Exists(buildPath))
                Directory.CreateDirectory(buildPath);

            EditorUtility.RevealInFinder(buildPath);
        }
    }
}
#endif
