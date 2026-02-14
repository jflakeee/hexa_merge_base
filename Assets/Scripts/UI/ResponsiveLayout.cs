namespace HexaMerge.UI
{
    using UnityEngine;

    public enum LayoutMode { Mobile, Tablet, Desktop }

    public class ResponsiveLayout : MonoBehaviour
    {
        [Header("Breakpoints (width in pixels)")]
        [SerializeField] private int tabletBreakpoint = 768;
        [SerializeField] private int desktopBreakpoint = 1024;

        [Header("References")]
        [SerializeField] private RectTransform boardContainer;
        [SerializeField] private RectTransform hudContainer;
        [SerializeField] private HexBoardRenderer boardRenderer;

        [Header("Board Scale per Layout")]
        [SerializeField] private float mobileBoardScale = 0.85f;
        [SerializeField] private float tabletBoardScale = 0.7f;
        [SerializeField] private float desktopBoardScale = 0.5f;

        public LayoutMode CurrentLayout { get; private set; }

        private int lastScreenWidth;

        private void Start()
        {
            UpdateLayout();
        }

        private void Update()
        {
            if (Screen.width != lastScreenWidth)
            {
                lastScreenWidth = Screen.width;
                UpdateLayout();
            }
        }

        public void UpdateLayout()
        {
            int width = Screen.width;

            if (width >= desktopBreakpoint)
                CurrentLayout = LayoutMode.Desktop;
            else if (width >= tabletBreakpoint)
                CurrentLayout = LayoutMode.Tablet;
            else
                CurrentLayout = LayoutMode.Mobile;

            ApplyLayout();
        }

        private void ApplyLayout()
        {
            float scale;
            switch (CurrentLayout)
            {
                case LayoutMode.Desktop:
                    scale = desktopBoardScale;
                    break;
                case LayoutMode.Tablet:
                    scale = tabletBoardScale;
                    break;
                default:
                    scale = mobileBoardScale;
                    break;
            }

            if (boardContainer != null)
                boardContainer.localScale = Vector3.one * scale;

            if (boardRenderer != null)
                boardRenderer.AutoFitToContainer();
        }
    }
}
