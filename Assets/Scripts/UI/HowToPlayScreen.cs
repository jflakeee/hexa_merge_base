namespace HexaMerge.UI
{
    using HexaMerge.Audio;
    using UnityEngine;
    using UnityEngine.UI;

    public class HowToPlayScreen : MonoBehaviour
    {
        [SerializeField] private Button gotItButton;

        private void OnEnable()
        {
            if (gotItButton != null)
                gotItButton.onClick.AddListener(OnGotItClicked);
        }

        private void OnDisable()
        {
            if (gotItButton != null)
                gotItButton.onClick.RemoveListener(OnGotItClicked);
        }

        private void OnGotItClicked()
        {
            if (AudioManager.Instance != null)
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);

            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.Gameplay);
        }
    }
}
