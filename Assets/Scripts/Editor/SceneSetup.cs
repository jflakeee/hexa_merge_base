#if UNITY_EDITOR
using System.IO;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEditor;

// Runtime namespaces
using HexaMerge.Game;
using HexaMerge.Core;
using HexaMerge.UI;
using HexaMerge.Audio;
using HexaMerge.Animation;
using HexaMerge.Input;

/// <summary>
/// Editor-only utility that builds the entire HexaMerge game scene
/// from scratch via  HexaMerge > Setup Game Scene.
/// Compatible with Unity 2020.3 (C# 7.3).
/// </summary>
public static class SceneSetup
{
    // ------------------------------------------------------------------ colours
    private static readonly Color Pink   = HexColor("#E91E63");
    private static readonly Color Grey   = new Color(0.6f, 0.6f, 0.6f, 1f);
    private static readonly Color Black  = Color.black;
    private static readonly Color White  = Color.white;

    // ------------------------------------------------------------------ entry
    [MenuItem("HexaMerge/Setup Game Scene")]
    public static void SetupGameScene()
    {
        // ---- 0. Ensure folders exist
        EnsureFolder("Assets/Prefabs");
        EnsureFolder("Assets/ScriptableObjects");

        // ---- 1. Main Camera
        Camera mainCam = SetupMainCamera();

        // ---- 2. Canvas ("GameCanvas")
        Canvas canvas = SetupCanvas(mainCam);
        RectTransform canvasRT = canvas.GetComponent<RectTransform>();

        // ---- 3. HUD
        GameObject hud = SetupHUD(canvasRT);

        // ---- 4. Board Container
        RectTransform boardContainer = SetupBoardContainer(canvasRT);

        // ---- 5. Ad Banner
        SetupAdBanner(canvasRT);

        // ---- 6. HexCell prefab
        GameObject hexCellPrefab = CreateHexCellPrefab();

        // ---- 7. SplashEffect prefab
        GameObject splashPrefab = CreateSplashEffectPrefab();

        // ---- 8. Manager objects
        SetupManagers(boardContainer, splashPrefab);

        // ---- 9. Controllers wired to Canvas / BoardContainer
        SetupControllers(canvas, boardContainer, hud, hexCellPrefab);

        // ---- 10. TileColorConfig ScriptableObject
        TileColorConfig colorConfig = CreateTileColorConfig();
        WireTileColorConfig(colorConfig);

        // ---- 11. Screen objects (GameOver, Pause)
        SetupScreens(canvasRT);

        // ---- finalise
        EditorUtility.SetDirty(canvas.gameObject);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();

        // Save scene file for build pipeline
        EnsureFolder("Assets/Scenes");
        var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
        UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene, "Assets/Scenes/GameScene.unity");
        Debug.Log("[SceneSetup] Scene saved to Assets/Scenes/GameScene.unity");
        Debug.Log("[SceneSetup] Game scene setup complete.");
    }

    // ==================================================================
    // 1. Main Camera
    // ==================================================================
    private static Camera SetupMainCamera()
    {
        DestroyExisting("Main Camera");
        GameObject camGO = new GameObject("Main Camera");
        camGO.tag = "MainCamera";
        Camera cam = camGO.AddComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = Black;
        cam.orthographic = true;
        camGO.AddComponent<AudioListener>();
        Undo.RegisterCreatedObjectUndo(camGO, "Create Main Camera");
        return cam;
    }

    // ==================================================================
    // 2. Canvas ("GameCanvas")
    // ==================================================================
    private static Canvas SetupCanvas(Camera cam)
    {
        DestroyExisting("GameCanvas");
        DestroyExisting("EventSystem");

        // --- Canvas
        GameObject canvasGO = new GameObject("GameCanvas");
        Canvas canvas = canvasGO.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceCamera;
        canvas.worldCamera = cam;

        CanvasScaler scaler = canvasGO.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080f, 1920f);
        scaler.matchWidthOrHeight = 0.5f;

        canvasGO.AddComponent<GraphicRaycaster>();
        canvasGO.AddComponent<CanvasGroup>();

        // Black background image
        GameObject bgGO = CreateUIObject("Background", canvasGO.transform);
        StretchFull(bgGO.GetComponent<RectTransform>());
        Image bgImg = bgGO.AddComponent<Image>();
        bgImg.color = Black;
        bgImg.raycastTarget = false;

        // --- EventSystem
        if (Object.FindObjectOfType<EventSystem>() == null)
        {
            GameObject esGO = new GameObject("EventSystem");
            esGO.AddComponent<EventSystem>();
            esGO.AddComponent<StandaloneInputModule>();
            Undo.RegisterCreatedObjectUndo(esGO, "Create EventSystem");
        }

        Undo.RegisterCreatedObjectUndo(canvasGO, "Create GameCanvas");
        return canvas;
    }

    // ==================================================================
    // 3. HUD
    // ==================================================================
    private static GameObject SetupHUD(RectTransform canvasRT)
    {
        GameObject hud = CreateUIObject("HUD", canvasRT);
        RectTransform hudRT = hud.GetComponent<RectTransform>();
        // top anchor, stretch horizontal
        hudRT.anchorMin = new Vector2(0f, 1f);
        hudRT.anchorMax = new Vector2(1f, 1f);
        hudRT.pivot = new Vector2(0.5f, 1f);
        hudRT.offsetMin = new Vector2(0f, -350f); // bottom edge 350px from top
        hudRT.offsetMax = new Vector2(0f, 0f);

        HUDManager hudMgr = hud.AddComponent<HUDManager>();

        // ---- Logo: "X" white + "UP" pink (two TMP texts side by side)
        GameObject logoContainer = CreateUIObject("LogoContainer", hudRT);
        RectTransform logoRT = logoContainer.GetComponent<RectTransform>();
        SetAnchored(logoRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(200f, 60f), new Vector2(0f, -20f));

        HorizontalLayoutGroup logoLayout = logoContainer.AddComponent<HorizontalLayoutGroup>();
        logoLayout.childAlignment = TextAnchor.MiddleCenter;
        logoLayout.spacing = 0f;
        logoLayout.childControlWidth = true;
        logoLayout.childControlHeight = true;
        logoLayout.childForceExpandWidth = false;
        logoLayout.childForceExpandHeight = false;

        Text logoX = CreateTMPText("LogoX", logoContainer.transform, "X", 48f, White, FontStyle.Bold);
        LayoutElement leX = logoX.gameObject.AddComponent<LayoutElement>();
        leX.preferredWidth = 50f;

        Text logoUP = CreateTMPText("LogoUP", logoContainer.transform, "UP", 48f, Pink, FontStyle.Bold);
        LayoutElement leUP = logoUP.gameObject.AddComponent<LayoutElement>();
        leUP.preferredWidth = 80f;

        // ---- SCORE label
        Text scoreLabel = CreateTMPText("ScoreLabel", hudRT, "SCORE", 24f, White, FontStyle.Bold);
        RectTransform scoreLabelRT = scoreLabel.GetComponent<RectTransform>();
        SetAnchored(scoreLabelRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 40f), new Vector2(0f, -100f));

        // ---- Score value
        Text scoreText = CreateTMPText("ScoreText", hudRT, "0", 64f, Pink, FontStyle.Bold);
        RectTransform scoreTextRT = scoreText.GetComponent<RectTransform>();
        SetAnchored(scoreTextRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(400f, 80f), new Vector2(0f, -150f));

        // ---- HI-SCORE label
        Text hiLabel = CreateTMPText("HiScoreLabel", hudRT, "HI-SCORE", 20f, Grey, FontStyle.Normal);
        RectTransform hiLabelRT = hiLabel.GetComponent<RectTransform>();
        SetAnchored(hiLabelRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 30f), new Vector2(0f, -230f));

        // ---- High score value
        Text hiScoreText = CreateTMPText("HighScoreText", hudRT, "0", 28f, Grey, FontStyle.Normal);
        RectTransform hiScoreTextRT = hiScoreText.GetComponent<RectTransform>();
        SetAnchored(hiScoreTextRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(300f, 40f), new Vector2(0f, -265f));

        // ---- Sound button (left, circular)
        GameObject soundBtn = CreateButtonObject("SoundButton", hudRT, new Vector2(60f, 60f));
        RectTransform soundBtnRT = soundBtn.GetComponent<RectTransform>();
        SetAnchored(soundBtnRT, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(60f, 60f), new Vector2(50f, -30f));
        Image soundImg = soundBtn.GetComponent<Image>();
        soundImg.color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text soundLabel = CreateTMPText("Icon", soundBtn.transform, "\u266A", 28f, White, FontStyle.Normal);
        StretchFull(soundLabel.GetComponent<RectTransform>());

        // ---- Menu button (right, hexagon-shaped placeholder)
        GameObject menuBtn = CreateButtonObject("MenuButton", hudRT, new Vector2(60f, 60f));
        RectTransform menuBtnRT = menuBtn.GetComponent<RectTransform>();
        SetAnchored(menuBtnRT, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                    new Vector2(60f, 60f), new Vector2(-50f, -30f));
        Image menuImg = menuBtn.GetComponent<Image>();
        menuImg.color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text menuLabel = CreateTMPText("Icon", menuBtn.transform, "\u2630", 28f, White, FontStyle.Normal);
        StretchFull(menuLabel.GetComponent<RectTransform>());

        // ---- Help button (right, below menu)
        GameObject helpBtn = CreateButtonObject("HelpButton", hudRT, new Vector2(60f, 60f));
        RectTransform helpBtnRT = helpBtn.GetComponent<RectTransform>();
        SetAnchored(helpBtnRT, new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                    new Vector2(60f, 60f), new Vector2(-50f, -100f));
        Image helpImg = helpBtn.GetComponent<Image>();
        helpImg.color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text helpLabel = CreateTMPText("Icon", helpBtn.transform, "?", 28f, White, FontStyle.Bold);
        StretchFull(helpLabel.GetComponent<RectTransform>());

        // ---- Wire HUDManager fields via SerializedObject
        SerializedObject soHud = new SerializedObject(hudMgr);
        soHud.FindProperty("scoreText").objectReferenceValue      = scoreText;
        soHud.FindProperty("highScoreText").objectReferenceValue   = hiScoreText;
        soHud.FindProperty("soundButton").objectReferenceValue     = soundBtn.GetComponent<Button>();
        soHud.FindProperty("menuButton").objectReferenceValue      = menuBtn.GetComponent<Button>();
        soHud.FindProperty("helpButton").objectReferenceValue      = helpBtn.GetComponent<Button>();
        soHud.ApplyModifiedPropertiesWithoutUndo();

        return hud;
    }

    // ==================================================================
    // 4. Board Container
    // ==================================================================
    private static RectTransform SetupBoardContainer(RectTransform canvasRT)
    {
        GameObject board = CreateUIObject("BoardContainer", canvasRT);
        RectTransform rt = board.GetComponent<RectTransform>();
        // centre anchor
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot     = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(800f, 800f);
        rt.anchoredPosition = Vector2.zero;
        return rt;
    }

    // ==================================================================
    // 5. Ad Banner
    // ==================================================================
    private static void SetupAdBanner(RectTransform canvasRT)
    {
        GameObject adGO = CreateUIObject("AdBanner", canvasRT);
        RectTransform rt = adGO.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, 0f);
        rt.pivot     = new Vector2(0.5f, 0f);
        rt.sizeDelta = new Vector2(0f, 100f);
        rt.anchoredPosition = Vector2.zero;

        Image img = adGO.AddComponent<Image>();
        img.color = new Color(0.15f, 0.15f, 0.15f, 1f);
        img.raycastTarget = false;

        Text adLabel = CreateTMPText("AdLabel", rt, "AD BANNER", 20f, Grey, FontStyle.Normal);
        StretchFull(adLabel.GetComponent<RectTransform>());
    }

    // ==================================================================
    // 6. HexCell Prefab
    // ==================================================================
    private static GameObject CreateHexCellPrefab()
    {
        string prefabPath = "Assets/Prefabs/HexCell.prefab";

        // Build in-scene temp
        GameObject cellGO = new GameObject("HexCell");
        RectTransform cellRT = cellGO.AddComponent<RectTransform>();
        cellRT.sizeDelta = new Vector2(80f, 80f);

        // hexBackground image
        Image bgImage = cellGO.AddComponent<Image>();
        bgImage.color = White;
        bgImage.sprite = null;
        bgImage.raycastTarget = true;

        // Button
        Button btn = cellGO.AddComponent<Button>();
        btn.targetGraphic = bgImage;

        // Child: ValueText
        GameObject valueTxtGO = new GameObject("ValueText");
        valueTxtGO.transform.SetParent(cellGO.transform, false);
        RectTransform valRT = valueTxtGO.AddComponent<RectTransform>();
        StretchFull(valRT);

        Text valTMP = valueTxtGO.AddComponent<Text>();
        valTMP.text = "";
        valTMP.fontSize = 32;
        valTMP.color = White;
        valTMP.fontStyle = FontStyle.Bold;
        valTMP.alignment = TextAnchor.MiddleCenter;
        valTMP.raycastTarget = false;
        valTMP.horizontalOverflow = HorizontalWrapMode.Overflow;
        valTMP.verticalOverflow = VerticalWrapMode.Overflow;
        valTMP.font = Resources.GetBuiltinResource<Font>("Arial.ttf");

        // Child: CrownIcon
        GameObject crownGO = new GameObject("CrownIcon");
        crownGO.transform.SetParent(cellGO.transform, false);
        RectTransform crownRT = crownGO.AddComponent<RectTransform>();
        crownRT.anchorMin = new Vector2(1f, 1f);
        crownRT.anchorMax = new Vector2(1f, 1f);
        crownRT.pivot     = new Vector2(1f, 1f);
        crownRT.sizeDelta = new Vector2(24f, 24f);
        crownRT.anchoredPosition = new Vector2(-2f, -2f);

        Image crownImg = crownGO.AddComponent<Image>();
        crownImg.color = new Color(1f, 0.84f, 0f, 1f); // gold
        crownImg.raycastTarget = false;
        crownGO.SetActive(false);

        // HexCellView component + field wiring
        HexCellView cellView = cellGO.AddComponent<HexCellView>();
        SerializedObject soCellView = new SerializedObject(cellView);
        soCellView.FindProperty("hexBackground").objectReferenceValue = bgImage;
        soCellView.FindProperty("valueText").objectReferenceValue     = valTMP;
        soCellView.FindProperty("crownIcon").objectReferenceValue     = crownGO;
        soCellView.FindProperty("button").objectReferenceValue        = btn;
        soCellView.ApplyModifiedPropertiesWithoutUndo();

        // Save as prefab
        GameObject prefab = PrefabUtility.SaveAsPrefabAsset(cellGO, prefabPath);
        Object.DestroyImmediate(cellGO);
        Debug.Log("[SceneSetup] HexCell prefab created at " + prefabPath);
        return prefab;
    }

    // ==================================================================
    // 7. SplashEffect Prefab
    // ==================================================================
    private static GameObject CreateSplashEffectPrefab()
    {
        string prefabPath = "Assets/Prefabs/SplashEffect.prefab";

        GameObject go = new GameObject("SplashEffect");
        RectTransform rt = go.AddComponent<RectTransform>();
        rt.sizeDelta = new Vector2(100f, 100f);

        Image img = go.AddComponent<Image>();
        img.color = White;
        img.sprite = null;
        img.raycastTarget = false;

        GameObject prefab = PrefabUtility.SaveAsPrefabAsset(go, prefabPath);
        Object.DestroyImmediate(go);
        Debug.Log("[SceneSetup] SplashEffect prefab created at " + prefabPath);
        return prefab;
    }

    // ==================================================================
    // 8. Manager objects
    // ==================================================================
    private static void SetupManagers(RectTransform boardContainer, GameObject splashPrefab)
    {
        // --- GameManager
        DestroyExisting("GameManager");
        GameObject gmGO = new GameObject("GameManager");
        gmGO.AddComponent<GameManager>();
        gmGO.AddComponent<WebGLBridge>();
        Undo.RegisterCreatedObjectUndo(gmGO, "Create GameManager");

        // --- AudioManager + SFXInitializer
        DestroyExisting("AudioManager");
        GameObject amGO = new GameObject("AudioManager");
        amGO.AddComponent<AudioManager>();
        amGO.AddComponent<SFXInitializer>();
        Undo.RegisterCreatedObjectUndo(amGO, "Create AudioManager");

        // --- AdManager
        DestroyExisting("AdManager");
        GameObject adGO = new GameObject("AdManager");
        adGO.AddComponent<AdManager>();
        Undo.RegisterCreatedObjectUndo(adGO, "Create AdManager");

        // --- IAPManager
        DestroyExisting("IAPManager");
        GameObject iapGO = new GameObject("IAPManager");
        iapGO.AddComponent<IAPManager>();
        Undo.RegisterCreatedObjectUndo(iapGO, "Create IAPManager");

        // --- TileAnimator
        DestroyExisting("TileAnimator");
        GameObject taGO = new GameObject("TileAnimator");
        taGO.AddComponent<TileAnimator>();
        Undo.RegisterCreatedObjectUndo(taGO, "Create TileAnimator");

        // --- MergeEffect
        DestroyExisting("MergeEffect");
        GameObject meGO = new GameObject("MergeEffect");
        MergeEffect me = meGO.AddComponent<MergeEffect>();
        Undo.RegisterCreatedObjectUndo(meGO, "Create MergeEffect");

        // Wire MergeEffect fields
        SerializedObject soME = new SerializedObject(me);
        soME.FindProperty("effectContainer").objectReferenceValue = boardContainer;
        soME.FindProperty("splashPrefab").objectReferenceValue    = splashPrefab;
        soME.ApplyModifiedPropertiesWithoutUndo();

        // --- GDPRConsentManager
        DestroyExisting("GDPRConsentManager");
        GameObject gdprGO = new GameObject("GDPRConsentManager");
        gdprGO.AddComponent<GDPRConsentManager>();
        Undo.RegisterCreatedObjectUndo(gdprGO, "Create GDPRConsentManager");

        // --- InputManager
        DestroyExisting("InputManager");
        GameObject imGO = new GameObject("InputManager");
        imGO.AddComponent<InputManager>();
        Undo.RegisterCreatedObjectUndo(imGO, "Create InputManager");

        // --- TestBridge (E2E 테스트용)
        DestroyExisting("TestBridge");
        GameObject tbGO = new GameObject("TestBridge");
        tbGO.AddComponent<TestBridge>();
        Undo.RegisterCreatedObjectUndo(tbGO, "Create TestBridge");

        // --- HexaTestBridge (애니메이션 테스트용)
        DestroyExisting("HexaTestBridge");
        GameObject htbGO = new GameObject("HexaTestBridge");
        htbGO.AddComponent<HexaTestBridge>();
        Undo.RegisterCreatedObjectUndo(htbGO, "Create HexaTestBridge");
    }

    // ==================================================================
    // 9. Controllers (BoardRenderer, GameplayController, ResponsiveLayout)
    // ==================================================================
    private static void SetupControllers(
        Canvas canvas,
        RectTransform boardContainer,
        GameObject hud,
        GameObject hexCellPrefab)
    {
        // ---- HexBoardRenderer on BoardContainer
        HexBoardRenderer boardRenderer = boardContainer.gameObject.GetComponent<HexBoardRenderer>();
        if (boardRenderer == null)
            boardRenderer = boardContainer.gameObject.AddComponent<HexBoardRenderer>();

        SerializedObject soBR = new SerializedObject(boardRenderer);
        soBR.FindProperty("hexCellPrefab").objectReferenceValue  = hexCellPrefab;
        soBR.FindProperty("boardContainer").objectReferenceValue = boardContainer;
        soBR.ApplyModifiedPropertiesWithoutUndo();

        // ---- GameplayController on Canvas
        GameplayController gc = canvas.gameObject.GetComponent<GameplayController>();
        if (gc == null)
            gc = canvas.gameObject.AddComponent<GameplayController>();

        HUDManager hudMgr = hud.GetComponent<HUDManager>();

        SerializedObject soGC = new SerializedObject(gc);
        soGC.FindProperty("boardRenderer").objectReferenceValue = boardRenderer;
        soGC.FindProperty("hudManager").objectReferenceValue    = hudMgr;
        soGC.ApplyModifiedPropertiesWithoutUndo();

        // ---- ResponsiveLayout on Canvas
        ResponsiveLayout rl = canvas.gameObject.GetComponent<ResponsiveLayout>();
        if (rl == null)
            rl = canvas.gameObject.AddComponent<ResponsiveLayout>();

        SerializedObject soRL = new SerializedObject(rl);
        soRL.FindProperty("boardContainer").objectReferenceValue = boardContainer;
        soRL.FindProperty("boardRenderer").objectReferenceValue  = boardRenderer;
        soRL.FindProperty("hudContainer").objectReferenceValue   = hud.GetComponent<RectTransform>();
        soRL.ApplyModifiedPropertiesWithoutUndo();
    }

    // ==================================================================
    // 10. TileColorConfig ScriptableObject
    // ==================================================================
    private static TileColorConfig CreateTileColorConfig()
    {
        string assetPath = "Assets/ScriptableObjects/TileColorConfig.asset";

        // Delete existing
        TileColorConfig existing = AssetDatabase.LoadAssetAtPath<TileColorConfig>(assetPath);
        if (existing != null)
        {
            AssetDatabase.DeleteAsset(assetPath);
        }

        TileColorConfig config = ScriptableObject.CreateInstance<TileColorConfig>();
        // Trigger Reset() to populate default entries by simulating it manually
        // (ScriptableObject.CreateInstance won't call Reset, so we replicate the data)
        config.defaultTextColor = Color.white;
        config.emptyColor = new Color(0.22f, 0.22f, 0.24f, 1f);
        config.entries = new TileColorConfig.TileColorEntry[]
        {
            MakeColorEntry(2,     "#FFD700", "#FFFFFF"),
            MakeColorEntry(4,     "#FF6B35", "#FFFFFF"),
            MakeColorEntry(8,     "#EC407A", "#FFFFFF"),
            MakeColorEntry(16,    "#880E4F", "#FFFFFF"),
            MakeColorEntry(32,    "#C2185B", "#FFFFFF"),
            MakeColorEntry(64,    "#8E24AA", "#FFFFFF"),
            MakeColorEntry(128,   "#4A148C", "#FFFFFF"),
            MakeColorEntry(256,   "#7C4DFF", "#FFFFFF"),
            MakeColorEntry(512,   "#1976D2", "#FFFFFF"),
            MakeColorEntry(1024,  "#00897B", "#FFFFFF"),
            MakeColorEntry(2048,  "#9ACD32", "#333333"),
            MakeColorEntry(4096,  "#4CAF50", "#FFFFFF"),
            MakeColorEntry(8192,  "#00695C", "#FFFFFF"),
            MakeColorEntry(16384, "#FFB300", "#333333"),
            MakeColorEntry(32768, "#E64A19", "#FFFFFF"),
            MakeColorEntry(65536, "#E91E63", "#FFFFFF"),
        };

        AssetDatabase.CreateAsset(config, assetPath);
        AssetDatabase.SaveAssets();
        Debug.Log("[SceneSetup] TileColorConfig asset created at " + assetPath);
        return config;
    }

    private static void WireTileColorConfig(TileColorConfig config)
    {
        GameManager gm = Object.FindObjectOfType<GameManager>();
        if (gm == null) return;

        SerializedObject soGM = new SerializedObject(gm);
        soGM.FindProperty("tileColorConfig").objectReferenceValue = config;
        soGM.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(gm);
    }

    // ==================================================================
    // 11. Screen objects (GameOver, Pause) + ScreenManager
    // ==================================================================
    private static void SetupScreens(RectTransform canvasRT)
    {
        // ---- GameOverScreen panel
        DestroyExistingChild("GameOverScreen", canvasRT);
        GameObject goScreen = CreateScreenPanel("GameOverScreen", canvasRT);
        GameOverScreen gos = goScreen.AddComponent<GameOverScreen>();

        // inner panel
        GameObject goPanel = CreateUIObject("Panel", goScreen.transform);
        StretchFull(goPanel.GetComponent<RectTransform>());
        Image goPanelImg = goPanel.AddComponent<Image>();
        goPanelImg.color = new Color(0f, 0f, 0f, 0.85f);

        Text goTitle = CreateTMPText("Title", goPanel.transform, "GAME OVER", 48f, White, FontStyle.Bold);
        RectTransform goTitleRT = goTitle.GetComponent<RectTransform>();
        SetAnchored(goTitleRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(600f, 60f), new Vector2(0f, 200f));

        Text goFinalScore = CreateTMPText("FinalScoreText", goPanel.transform, "0", 64f, Pink, FontStyle.Bold);
        RectTransform goFSRT = goFinalScore.GetComponent<RectTransform>();
        SetAnchored(goFSRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(400f, 80f), new Vector2(0f, 100f));

        Text goHiScore = CreateTMPText("HighScoreText", goPanel.transform, "0", 28f, Grey, FontStyle.Normal);
        RectTransform goHSRT = goHiScore.GetComponent<RectTransform>();
        SetAnchored(goHSRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 40f), new Vector2(0f, 40f));

        Text goNewRecord = CreateTMPText("NewRecordLabel", goPanel.transform, "NEW RECORD!", 32f,
                                                     new Color(1f, 0.84f, 0f, 1f), FontStyle.Bold);
        RectTransform goNRRT = goNewRecord.GetComponent<RectTransform>();
        SetAnchored(goNRRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(400f, 50f), new Vector2(0f, -10f));

        GameObject goRestartBtn = CreateButtonObject("RestartButton", goPanel.transform, new Vector2(300f, 80f));
        RectTransform goRestBtnRT = goRestartBtn.GetComponent<RectTransform>();
        SetAnchored(goRestBtnRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 80f), new Vector2(0f, -100f));
        goRestartBtn.GetComponent<Image>().color = Pink;
        Text restartLabel = CreateTMPText("Label", goRestartBtn.transform, "RESTART", 28f, White, FontStyle.Bold);
        StretchFull(restartLabel.GetComponent<RectTransform>());

        GameObject goWatchAdBtn = CreateButtonObject("WatchAdButton", goPanel.transform, new Vector2(300f, 80f));
        RectTransform goAdBtnRT = goWatchAdBtn.GetComponent<RectTransform>();
        SetAnchored(goAdBtnRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 80f), new Vector2(0f, -200f));
        goWatchAdBtn.GetComponent<Image>().color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text adBtnLabel = CreateTMPText("Label", goWatchAdBtn.transform, "WATCH AD", 24f, White, FontStyle.Normal);
        StretchFull(adBtnLabel.GetComponent<RectTransform>());

        CanvasGroup goCG = goScreen.GetComponent<CanvasGroup>();

        // Wire GameOverScreen
        SerializedObject soGOS = new SerializedObject(gos);
        soGOS.FindProperty("panel").objectReferenceValue          = goPanel;
        soGOS.FindProperty("finalScoreText").objectReferenceValue = goFinalScore;
        soGOS.FindProperty("highScoreText").objectReferenceValue  = goHiScore;
        soGOS.FindProperty("newRecordLabel").objectReferenceValue = goNewRecord;
        soGOS.FindProperty("restartButton").objectReferenceValue  = goRestartBtn.GetComponent<Button>();
        soGOS.FindProperty("watchAdButton").objectReferenceValue  = goWatchAdBtn.GetComponent<Button>();
        soGOS.FindProperty("canvasGroup").objectReferenceValue    = goCG;
        soGOS.ApplyModifiedPropertiesWithoutUndo();

        goScreen.SetActive(false);

        // ---- PauseScreen panel
        DestroyExistingChild("PauseScreen", canvasRT);
        GameObject pauseScreen = CreateScreenPanel("PauseScreen", canvasRT);
        PauseScreen ps = pauseScreen.AddComponent<PauseScreen>();

        GameObject pPanel = CreateUIObject("Panel", pauseScreen.transform);
        StretchFull(pPanel.GetComponent<RectTransform>());
        Image pPanelImg = pPanel.AddComponent<Image>();
        pPanelImg.color = new Color(0f, 0f, 0f, 0.85f);

        Text pTitle = CreateTMPText("Title", pPanel.transform, "PAUSED", 48f, White, FontStyle.Bold);
        RectTransform pTitleRT = pTitle.GetComponent<RectTransform>();
        SetAnchored(pTitleRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(400f, 60f), new Vector2(0f, 200f));

        Text pScoreText = CreateTMPText("CurrentScoreText", pPanel.transform, "0", 36f, Pink, FontStyle.Bold);
        RectTransform pScoreRT = pScoreText.GetComponent<RectTransform>();
        SetAnchored(pScoreRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 50f), new Vector2(0f, 120f));

        GameObject pResumeBtn = CreateButtonObject("ResumeButton", pPanel.transform, new Vector2(300f, 80f));
        RectTransform pResumeBtnRT = pResumeBtn.GetComponent<RectTransform>();
        SetAnchored(pResumeBtnRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 80f), new Vector2(0f, 20f));
        pResumeBtn.GetComponent<Image>().color = Pink;
        Text resumeLabel = CreateTMPText("Label", pResumeBtn.transform, "RESUME", 28f, White, FontStyle.Bold);
        StretchFull(resumeLabel.GetComponent<RectTransform>());

        GameObject pRestartBtn = CreateButtonObject("RestartButton", pPanel.transform, new Vector2(300f, 80f));
        RectTransform pRestartBtnRT = pRestartBtn.GetComponent<RectTransform>();
        SetAnchored(pRestartBtnRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(300f, 80f), new Vector2(0f, -80f));
        pRestartBtn.GetComponent<Image>().color = new Color(0.3f, 0.3f, 0.3f, 1f);
        Text pRestartLabel = CreateTMPText("Label", pRestartBtn.transform, "RESTART", 28f, White, FontStyle.Normal);
        StretchFull(pRestartLabel.GetComponent<RectTransform>());

        GameObject pSoundBtn = CreateButtonObject("SoundToggleButton", pPanel.transform, new Vector2(60f, 60f));
        RectTransform pSoundBtnRT = pSoundBtn.GetComponent<RectTransform>();
        SetAnchored(pSoundBtnRT, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f),
                    new Vector2(60f, 60f), new Vector2(0f, -180f));
        pSoundBtn.GetComponent<Image>().color = new Color(0.3f, 0.3f, 0.3f, 1f);

        // SoundToggleIcon is an Image child of SoundToggleButton
        GameObject pSoundIcon = CreateUIObject("SoundToggleIcon", pSoundBtn.transform);
        StretchFull(pSoundIcon.GetComponent<RectTransform>());
        Image pSoundIconImg = pSoundIcon.AddComponent<Image>();
        pSoundIconImg.color = White;
        pSoundIconImg.raycastTarget = false;

        // Wire PauseScreen
        SerializedObject soPS = new SerializedObject(ps);
        soPS.FindProperty("resumeButton").objectReferenceValue       = pResumeBtn.GetComponent<Button>();
        soPS.FindProperty("restartButton").objectReferenceValue      = pRestartBtn.GetComponent<Button>();
        soPS.FindProperty("soundToggleButton").objectReferenceValue  = pSoundBtn.GetComponent<Button>();
        soPS.FindProperty("soundToggleIcon").objectReferenceValue    = pSoundIconImg;
        soPS.FindProperty("currentScoreText").objectReferenceValue   = pScoreText;
        soPS.ApplyModifiedPropertiesWithoutUndo();

        pauseScreen.SetActive(false);

        // ---- ShopScreen panel
        DestroyExistingChild("ShopScreen", canvasRT);
        GameObject shopScreen = CreateScreenPanel("ShopScreen", canvasRT);
        shopScreen.AddComponent<ShopScreen>();
        GameObject shopPanel = CreateUIObject("Panel", shopScreen.transform);
        StretchFull(shopPanel.GetComponent<RectTransform>());
        Image shopPanelImg = shopPanel.AddComponent<Image>();
        shopPanelImg.color = new Color(0f, 0f, 0f, 0.9f);
        Text shopTitle = CreateTMPText("Title", shopPanel.transform, "SHOP", 48f, White, FontStyle.Bold);
        RectTransform shopTitleRT = shopTitle.GetComponent<RectTransform>();
        SetAnchored(shopTitleRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(400f, 60f), new Vector2(0f, -60f));
        shopScreen.SetActive(false);

        // ---- LeaderboardScreen panel
        DestroyExistingChild("LeaderboardScreen", canvasRT);
        GameObject lbScreen = CreateScreenPanel("LeaderboardScreen", canvasRT);
        lbScreen.AddComponent<LeaderboardScreen>();
        GameObject lbPanel = CreateUIObject("Panel", lbScreen.transform);
        StretchFull(lbPanel.GetComponent<RectTransform>());
        Image lbPanelImg = lbPanel.AddComponent<Image>();
        lbPanelImg.color = new Color(0f, 0f, 0f, 0.9f);
        Text lbTitle = CreateTMPText("Title", lbPanel.transform, "LEADERBOARD", 48f, White, FontStyle.Bold);
        RectTransform lbTitleRT = lbTitle.GetComponent<RectTransform>();
        SetAnchored(lbTitleRT, new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                    new Vector2(600f, 60f), new Vector2(0f, -60f));
        lbScreen.SetActive(false);

        // ---- ScreenManager on Canvas
        ScreenManager sm = canvasRT.gameObject.GetComponent<ScreenManager>();
        if (sm == null)
            sm = canvasRT.gameObject.AddComponent<ScreenManager>();

        SerializedObject soSM = new SerializedObject(sm);
        SerializedProperty screensProp = soSM.FindProperty("screens");
        screensProp.arraySize = 4;

        // Entry 0 : Pause
        SerializedProperty entry0 = screensProp.GetArrayElementAtIndex(0);
        entry0.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Pause;
        entry0.FindPropertyRelative("screenObject").objectReferenceValue = pauseScreen;

        // Entry 1 : Settings (GameOver 패널을 Settings 슬롯에 등록)
        SerializedProperty entry1 = screensProp.GetArrayElementAtIndex(1);
        entry1.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Settings;
        entry1.FindPropertyRelative("screenObject").objectReferenceValue = goScreen;

        // Entry 2 : Shop
        SerializedProperty entry2 = screensProp.GetArrayElementAtIndex(2);
        entry2.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Shop;
        entry2.FindPropertyRelative("screenObject").objectReferenceValue = shopScreen;

        // Entry 3 : Leaderboard
        SerializedProperty entry3 = screensProp.GetArrayElementAtIndex(3);
        entry3.FindPropertyRelative("type").enumValueIndex = (int)ScreenType.Leaderboard;
        entry3.FindPropertyRelative("screenObject").objectReferenceValue = lbScreen;

        soSM.FindProperty("initialScreen").enumValueIndex = (int)ScreenType.Gameplay;
        soSM.ApplyModifiedPropertiesWithoutUndo();
    }

    // ==================================================================
    // Helper: create a screen panel (stretch-full, CanvasGroup, inactive)
    // ==================================================================
    private static GameObject CreateScreenPanel(string name, RectTransform parent)
    {
        GameObject go = CreateUIObject(name, parent);
        StretchFull(go.GetComponent<RectTransform>());
        go.AddComponent<CanvasGroup>();
        return go;
    }

    // ==================================================================
    //  Helper utilities
    // ==================================================================

    private static void DestroyExisting(string name)
    {
        GameObject existing = GameObject.Find(name);
        if (existing != null)
        {
            Undo.DestroyObjectImmediate(existing);
        }
    }

    private static void DestroyExistingChild(string name, Transform parent)
    {
        Transform child = parent.Find(name);
        if (child != null)
        {
            Undo.DestroyObjectImmediate(child.gameObject);
        }
    }

    private static GameObject CreateUIObject(string name, Transform parent)
    {
        GameObject go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.AddComponent<RectTransform>();
        return go;
    }

    private static Text CreateTMPText(
        string name,
        Transform parent,
        string text,
        float fontSize,
        Color color,
        FontStyle style)
    {
        GameObject go = CreateUIObject(name, parent);
        Text txt = go.AddComponent<Text>();
        txt.text = text;
        txt.fontSize = (int)fontSize;
        txt.color = color;
        txt.fontStyle = style;
        txt.alignment = TextAnchor.MiddleCenter;
        txt.raycastTarget = false;
        txt.horizontalOverflow = HorizontalWrapMode.Overflow;
        txt.verticalOverflow = VerticalWrapMode.Overflow;
        txt.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        return txt;
    }

    private static GameObject CreateButtonObject(string name, Transform parent, Vector2 size)
    {
        GameObject go = CreateUIObject(name, parent);
        RectTransform rt = go.GetComponent<RectTransform>();
        rt.sizeDelta = size;

        Image img = go.AddComponent<Image>();
        img.color = White;
        img.raycastTarget = true;

        Button btn = go.AddComponent<Button>();
        btn.targetGraphic = img;

        return go;
    }

    private static void StretchFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    private static void SetAnchored(
        RectTransform rt,
        Vector2 anchorMin,
        Vector2 anchorMax,
        Vector2 pivot,
        Vector2 sizeDelta,
        Vector2 anchoredPosition)
    {
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.pivot = pivot;
        rt.sizeDelta = sizeDelta;
        rt.anchoredPosition = anchoredPosition;
    }

    private static Color HexColor(string hex)
    {
        ColorUtility.TryParseHtmlString(hex, out Color c);
        return c;
    }

    private static TileColorConfig.TileColorEntry MakeColorEntry(int value, string hexBg, string hexText)
    {
        ColorUtility.TryParseHtmlString(hexBg, out Color bg);
        ColorUtility.TryParseHtmlString(hexText, out Color txt);
        TileColorConfig.TileColorEntry entry = new TileColorConfig.TileColorEntry();
        entry.value = value;
        entry.color = bg;
        entry.textColor = txt;
        return entry;
    }

    private static void EnsureFolder(string path)
    {
        if (AssetDatabase.IsValidFolder(path)) return;

        string[] parts = path.Split('/');
        string current = parts[0]; // "Assets"
        for (int i = 1; i < parts.Length; i++)
        {
            string next = current + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(next))
            {
                AssetDatabase.CreateFolder(current, parts[i]);
            }
            current = next;
        }
    }
}
#endif
