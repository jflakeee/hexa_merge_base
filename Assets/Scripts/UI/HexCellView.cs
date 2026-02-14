namespace HexaMerge.UI
{
    using HexaMerge.Core;
    using HexaMerge.Game;
    using UnityEngine;
    using UnityEngine.UI;
    using TMPro;
    using System;

    public class HexCellView : MonoBehaviour
    {
        [SerializeField] private Image hexBackground;
        [SerializeField] private TextMeshProUGUI valueText;
        [SerializeField] private GameObject crownIcon;
        [SerializeField] private Button button;
        private TileColorConfig colorConfig;

        public HexCoord Coord { get; private set; }
        public RectTransform RectTransform => (RectTransform)transform;

        private Action<HexCoord> onTapCallback;

        public void Initialize(HexCoord coord, Action<HexCoord> onTap, TileColorConfig config = null)
        {
            Coord = coord;
            onTapCallback = onTap;
            colorConfig = config ?? (GameManager.Instance != null ? GameManager.Instance.ColorConfig : null);

            if (button != null)
                button.onClick.AddListener(() => onTapCallback?.Invoke(Coord));

            ShowEmpty();
        }

        public void UpdateView(int value, bool hasCrown)
        {
            if (value <= 0)
            {
                ShowEmpty();
                return;
            }

            UpdateColors(value);
            UpdateText(value);
            UpdateCrown(hasCrown);
        }

        private void UpdateColors(int value)
        {
            if (colorConfig == null) return;

            hexBackground.color = colorConfig.GetColor(value);
            valueText.color = colorConfig.GetTextColor(value);
        }

        private void UpdateText(int value)
        {
            valueText.text = TileHelper.FormatValue(value);
            valueText.gameObject.SetActive(true);

            float fontSize;
            if (value < 10) fontSize = 36f;
            else if (value < 100) fontSize = 32f;
            else if (value < 1000) fontSize = 26f;
            else if (value < 10000) fontSize = 22f;
            else fontSize = 18f;
            valueText.fontSize = fontSize;
        }

        private void UpdateCrown(bool show)
        {
            if (crownIcon != null)
                crownIcon.SetActive(show);
        }

        private void ShowEmpty()
        {
            if (colorConfig != null)
                hexBackground.color = colorConfig.emptyColor;

            valueText.text = string.Empty;
            valueText.gameObject.SetActive(false);

            if (crownIcon != null)
                crownIcon.SetActive(false);
        }
    }
}
