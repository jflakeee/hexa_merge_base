namespace HexaMerge.UI
{
    using HexaMerge.Game;
    using UnityEngine;
    using UnityEngine.UI;

    /// <summary>
    /// 상점 화면. IAP 상품 목록을 표시하고 구매를 처리합니다.
    /// </summary>
    public class ShopScreen : MonoBehaviour
    {
        [System.Serializable]
        public struct ShopItemUI
        {
            public IAPProduct product;
            public Button buyButton;
            public Text nameText;
            public Text priceText;
            public GameObject purchasedBadge;
        }

        [SerializeField] private ShopItemUI[] items;
        [SerializeField] private Button closeButton;
        [SerializeField] private Button restoreButton;

        private void OnEnable()
        {
            if (IAPManager.Instance != null)
            {
                IAPManager.Instance.OnPurchaseSuccess += OnPurchaseSuccess;
            }

            if (closeButton != null)
                closeButton.onClick.AddListener(OnCloseClicked);
            if (restoreButton != null)
                restoreButton.onClick.AddListener(OnRestoreClicked);

            if (items != null)
            {
                for (int i = 0; i < items.Length; i++)
                {
                    if (items[i].buyButton != null)
                    {
                        IAPProduct product = items[i].product;
                        items[i].buyButton.onClick.AddListener(() => OnBuyClicked(product));
                    }
                }
            }

            RefreshUI();
        }

        private void OnDisable()
        {
            if (IAPManager.Instance != null)
            {
                IAPManager.Instance.OnPurchaseSuccess -= OnPurchaseSuccess;
            }

            if (closeButton != null)
                closeButton.onClick.RemoveListener(OnCloseClicked);
            if (restoreButton != null)
                restoreButton.onClick.RemoveListener(OnRestoreClicked);

            if (items != null)
            {
                for (int i = 0; i < items.Length; i++)
                {
                    if (items[i].buyButton != null)
                        items[i].buyButton.onClick.RemoveAllListeners();
                }
            }
        }

        /// <summary>
        /// 각 상점 아이템의 이름, 가격, 구매 상태를 갱신합니다.
        /// </summary>
        private void RefreshUI()
        {
            if (items == null || IAPManager.Instance == null) return;

            for (int i = 0; i < items.Length; i++)
            {
                IAPProductInfo? info = IAPManager.Instance.GetProductInfo(items[i].product);
                if (!info.HasValue) continue;

                IAPProductInfo productInfo = info.Value;
                bool alreadyPurchased = !productInfo.isConsumable &&
                    IAPManager.Instance.HasPurchased(items[i].product);

                if (items[i].nameText != null)
                    items[i].nameText.text = productInfo.displayName;

                if (items[i].priceText != null)
                    items[i].priceText.text = alreadyPurchased ? "---" : productInfo.price;

                if (items[i].purchasedBadge != null)
                    items[i].purchasedBadge.SetActive(alreadyPurchased);

                if (items[i].buyButton != null)
                    items[i].buyButton.interactable = !alreadyPurchased;
            }
        }

        private void OnBuyClicked(IAPProduct product)
        {
            if (IAPManager.Instance == null)
            {
                Debug.LogWarning("[ShopScreen] IAPManager not available.");
                return;
            }

            Debug.Log("[ShopScreen] Buy clicked: " + product);
            IAPManager.Instance.Purchase(product);
        }

        private void OnPurchaseSuccess(IAPProduct product)
        {
            Debug.Log("[ShopScreen] Purchase success: " + product);
            RefreshUI();
        }

        private void OnCloseClicked()
        {
            if (ScreenManager.Instance != null)
                ScreenManager.Instance.GoBack();
        }

        private void OnRestoreClicked()
        {
            if (IAPManager.Instance != null)
            {
                Debug.Log("[ShopScreen] Restore purchases requested.");
                IAPManager.Instance.RestorePurchases();
                RefreshUI();
            }
        }
    }
}
