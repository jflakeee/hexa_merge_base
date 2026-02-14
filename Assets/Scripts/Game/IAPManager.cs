namespace HexaMerge.Game
{
    using UnityEngine;
    using System;
    using System.Collections.Generic;

    /// <summary>
    /// 인앱 결제(IAP) 관리.
    /// 실제 Unity IAP 연동 전 스텁 구현.
    /// </summary>
    public enum IAPProduct
    {
        RemoveAds,
        GemPack_Small,
        GemPack_Large,
        UndoPack
    }

    [System.Serializable]
    public struct IAPProductInfo
    {
        public IAPProduct product;
        public string productId;
        public string displayName;
        public string price;
        public bool isConsumable;
    }

    public class IAPManager : MonoBehaviour
    {
        public static IAPManager Instance { get; private set; }

        [SerializeField] private IAPProductInfo[] products;

        public event Action<IAPProduct> OnPurchaseSuccess;
        public event Action<IAPProduct, string> OnPurchaseFailed;

        public bool IsInitialized { get; private set; }

        private Dictionary<IAPProduct, IAPProductInfo> productLookup;

        private const string PURCHASE_PREFIX = "IAP_Purchased_";

        // Mock 상태 (테스트용)
        private string mockPurchaseResult = "success";
        private string lastPurchaseProductId = "";
        private bool lastPurchaseSuccess;
        private string lastPurchaseFailureReason = "";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            EnsureProductsInitialized();
            BuildProductLookup();
        }

        private void Start()
        {
            InitializeStore();
            RestorePurchases();
            LoadLastPurchaseResult();
        }

        /// <summary>
        /// 런타임에 products 배열이 null이면 기본값으로 초기화합니다.
        /// Inspector에서 설정되지 않은 경우(WebGL 빌드 등)에 대한 폴백.
        /// </summary>
        private void EnsureProductsInitialized()
        {
            if (products != null && products.Length > 0) return;

            products = new IAPProductInfo[]
            {
                new IAPProductInfo
                {
                    product = IAPProduct.RemoveAds,
                    productId = "com.hexamerge.removeads",
                    displayName = "Remove Ads",
                    price = "$2.99",
                    isConsumable = false
                },
                new IAPProductInfo
                {
                    product = IAPProduct.GemPack_Small,
                    productId = "com.hexamerge.gems.small",
                    displayName = "Small Gem Pack",
                    price = "$0.99",
                    isConsumable = true
                },
                new IAPProductInfo
                {
                    product = IAPProduct.GemPack_Large,
                    productId = "com.hexamerge.gems.large",
                    displayName = "Large Gem Pack",
                    price = "$4.99",
                    isConsumable = true
                },
                new IAPProductInfo
                {
                    product = IAPProduct.UndoPack,
                    productId = "com.hexamerge.undopack",
                    displayName = "Undo Pack (x5)",
                    price = "$1.99",
                    isConsumable = true
                }
            };

            Debug.Log("[IAPManager] Products initialized from defaults (runtime fallback).");
        }

        private void BuildProductLookup()
        {
            productLookup = new Dictionary<IAPProduct, IAPProductInfo>();

            if (products == null) return;

            for (int i = 0; i < products.Length; i++)
            {
                if (!productLookup.ContainsKey(products[i].product))
                {
                    productLookup[products[i].product] = products[i];
                }
            }
        }

        private void InitializeStore()
        {
            // 스텁: 실제 Unity IAP 초기화 대신 즉시 완료 처리
            IsInitialized = true;
            Debug.Log("[IAPManager] Store initialized (stub). Products: " +
                (products != null ? products.Length : 0));
        }

        /// <summary>
        /// 구매를 요청합니다.
        /// </summary>
        public void Purchase(IAPProduct product)
        {
            if (!IsInitialized)
            {
                Debug.LogWarning("[IAPManager] Store not initialized.");
                lastPurchaseProductId = product.ToString();
                lastPurchaseSuccess = false;
                lastPurchaseFailureReason = "Store not initialized";
                SaveLastPurchaseResult();
                OnPurchaseFailed?.Invoke(product, "Store not initialized");
                SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                    product.ToString() + "\",\"isSuccess\":false,\"failureReason\":\"Store not initialized\"}");
                return;
            }

            if (!productLookup.ContainsKey(product))
            {
                Debug.LogWarning("[IAPManager] Unknown product: " + product);
                lastPurchaseProductId = product.ToString();
                lastPurchaseSuccess = false;
                lastPurchaseFailureReason = "Unknown product";
                SaveLastPurchaseResult();
                OnPurchaseFailed?.Invoke(product, "Unknown product");
                SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                    product.ToString() + "\",\"isSuccess\":false,\"failureReason\":\"Unknown product\"}");
                return;
            }

            // 비소모성 상품 중복 구매 방지
            IAPProductInfo info = productLookup[product];
            if (!info.isConsumable && HasPurchased(product))
            {
                Debug.Log("[IAPManager] Already purchased: " + product);
                lastPurchaseProductId = product.ToString();
                lastPurchaseSuccess = false;
                lastPurchaseFailureReason = "Already purchased";
                SaveLastPurchaseResult();
                OnPurchaseFailed?.Invoke(product, "Already purchased");
                SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                    product.ToString() + "\",\"isSuccess\":false,\"failureReason\":\"Already purchased\"}");
                return;
            }

            // Mock 결과에 따른 분기
            if (mockPurchaseResult == "cancel")
            {
                lastPurchaseProductId = product.ToString();
                lastPurchaseSuccess = false;
                lastPurchaseFailureReason = "User cancelled";
                SaveLastPurchaseResult();
                OnPurchaseFailed?.Invoke(product, "User cancelled");
                SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                    product.ToString() + "\",\"isSuccess\":false,\"failureReason\":\"User cancelled\"}");
                return;
            }

            if (mockPurchaseResult != "success")
            {
                lastPurchaseProductId = product.ToString();
                lastPurchaseSuccess = false;
                lastPurchaseFailureReason = mockPurchaseResult;
                SaveLastPurchaseResult();
                OnPurchaseFailed?.Invoke(product, mockPurchaseResult);
                SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                    product.ToString() + "\",\"isSuccess\":false,\"failureReason\":\"" + mockPurchaseResult + "\"}");
                return;
            }

            SimulatePurchaseInternal(product);
        }

        /// <summary>
        /// 비소모성 구매를 복원합니다 (iOS 요구사항).
        /// </summary>
        public void RestorePurchases()
        {
            Debug.Log("[IAPManager] Restoring purchases (stub)...");

            // 비소모성 상품만 복원
            if (products == null) return;

            for (int i = 0; i < products.Length; i++)
            {
                if (!products[i].isConsumable && LoadPurchase(products[i].product))
                {
                    Debug.Log("[IAPManager] Restored: " + products[i].product);
                    ProcessPurchase(products[i].product);
                }
            }

            SendIAPEvent("{\"event\":\"purchasesRestored\"}");
        }

        /// <summary>
        /// 상품 정보를 반환합니다. 없으면 null을 반환합니다.
        /// </summary>
        public IAPProductInfo? GetProductInfo(IAPProduct product)
        {
            if (productLookup != null && productLookup.ContainsKey(product))
            {
                return productLookup[product];
            }
            return null;
        }

        /// <summary>
        /// 비소모성 상품의 구매 여부를 확인합니다.
        /// </summary>
        public bool HasPurchased(IAPProduct product)
        {
            return LoadPurchase(product);
        }

        /// <summary>
        /// 스텁: 실제 결제 없이 구매 시뮬레이션.
        /// </summary>
        private void SimulatePurchaseInternal(IAPProduct product)
        {
            IAPProductInfo info = productLookup[product];
            Debug.Log("[IAPManager] Simulating purchase: " + info.displayName +
                " (" + info.price + ")");

            // 시뮬레이션: 항상 성공 처리
            if (!info.isConsumable)
            {
                SavePurchase(product);
            }

            ProcessPurchase(product);

            lastPurchaseProductId = product.ToString();
            lastPurchaseSuccess = true;
            lastPurchaseFailureReason = "";
            SaveLastPurchaseResult();

            Debug.Log("[IAPManager] Purchase complete: " + product);
            OnPurchaseSuccess?.Invoke(product);

            SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                product.ToString() + "\",\"isSuccess\":true,\"failureReason\":\"\"}");
        }

        /// <summary>
        /// 구매 성공 후 실제 보상을 적용합니다.
        /// </summary>
        private void ProcessPurchase(IAPProduct product)
        {
            switch (product)
            {
                case IAPProduct.RemoveAds:
                    if (AdManager.Instance != null)
                        AdManager.Instance.RemoveAds();
                    Debug.Log("[IAPManager] Processed: Remove Ads");
                    break;

                case IAPProduct.GemPack_Small:
                    Debug.Log("[IAPManager] Processed: Small Gem Pack (+100 gems)");
                    break;

                case IAPProduct.GemPack_Large:
                    Debug.Log("[IAPManager] Processed: Large Gem Pack (+500 gems)");
                    break;

                case IAPProduct.UndoPack:
                    Debug.Log("[IAPManager] Processed: Undo Pack (+5 undos)");
                    break;

                default:
                    Debug.LogWarning("[IAPManager] Unhandled product: " + product);
                    break;
            }
        }

        private void SavePurchase(IAPProduct product)
        {
            PlayerPrefs.SetInt(PURCHASE_PREFIX + product.ToString(), 1);
            PlayerPrefs.Save();
        }

        private bool LoadPurchase(IAPProduct product)
        {
            return PlayerPrefs.GetInt(PURCHASE_PREFIX + product.ToString(), 0) == 1;
        }

        /// <summary>
        /// WebGLBridge를 통해 IAP 이벤트를 JS로 전송합니다.
        /// </summary>
        private void SendIAPEvent(string json)
        {
            WebGLBridge.SendToJS(json);
        }

        /// <summary>
        /// Inspector에서 컴포넌트 추가 시 기본 상품 목록을 정의합니다.
        /// </summary>
        private void Reset()
        {
            EnsureProductsInitialized();
        }

        #region SendMessage Bridge Methods (Playwright 테스트용)

        /// <summary>IAP 상태를 JS에 전송 (WebGLBridge SendMessageToJS 경유)</summary>
        public void JS_GetIAPState(string callbackId)
        {
            EnsureProductsInitialized();

            string productsJson = "[";
            bool first = true;

            // purchasedNonConsumables 수집
            string purchasedNCJson = "[";
            bool firstNC = true;

            if (products != null)
            {
                for (int i = 0; i < products.Length; i++)
                {
                    if (!first) productsJson += ",";
                    var p = products[i];
                    string typeStr = p.isConsumable ? "consumable" : "non-consumable";
                    productsJson += "{" +
                        "\"productId\":\"" + p.product.ToString() + "\"," +
                        "\"displayName\":\"" + p.displayName + "\"," +
                        "\"type\":\"" + typeStr + "\"," +
                        "\"price\":\"" + p.price + "\"," +
                        "\"isConsumable\":" + (p.isConsumable ? "true" : "false") + "," +
                        "\"isAvailable\":true," +
                        "\"purchased\":" + (HasPurchased(p.product) ? "true" : "false") +
                    "}";
                    first = false;

                    // 비소모성 중 구매된 항목
                    if (!p.isConsumable && HasPurchased(p.product))
                    {
                        if (!firstNC) purchasedNCJson += ",";
                        purchasedNCJson += "\"" + p.product.ToString() + "\"";
                        firstNC = false;
                    }
                }
            }
            productsJson += "]";
            purchasedNCJson += "]";

            bool isAdsRemoved = AdManager.Instance != null && AdManager.Instance.AdsRemoved;

            // lastPurchaseResult
            string lastPurchaseJson = "null";
            if (!string.IsNullOrEmpty(lastPurchaseProductId))
            {
                lastPurchaseJson = "{" +
                    "\"productId\":\"" + lastPurchaseProductId + "\"," +
                    "\"isSuccess\":" + (lastPurchaseSuccess ? "true" : "false") + "," +
                    "\"failureReason\":\"" + lastPurchaseFailureReason + "\"" +
                "}";
            }

            string json = "{" +
                "\"callbackId\":\"" + callbackId + "\"," +
                "\"isInitialized\":" + (IsInitialized ? "true" : "false") + "," +
                "\"isAdsRemoved\":" + (isAdsRemoved ? "true" : "false") + "," +
                "\"products\":" + productsJson + "," +
                "\"purchasedNonConsumables\":" + purchasedNCJson + "," +
                "\"lastPurchaseResult\":" + lastPurchaseJson +
            "}";

            WebGLBridge.SendToJS(json);
            Debug.Log("[IAPManager] JS_GetIAPState: " + json);
        }

        /// <summary>문자열 기반 구매 (SendMessage 호환) - enum 이름으로 호출</summary>
        public void PurchaseProduct(string productId)
        {
            foreach (IAPProduct p in System.Enum.GetValues(typeof(IAPProduct)))
            {
                if (p.ToString() == productId)
                {
                    Purchase(p);
                    return;
                }
            }
            Debug.LogWarning("[IAPManager] Unknown productId: " + productId);
            SendIAPEvent("{\"event\":\"purchaseComplete\",\"productId\":\"" +
                productId + "\",\"isSuccess\":false,\"failureReason\":\"Unknown product\"}");
        }

        /// <summary>레거시 호환용 - PurchaseProduct와 동일</summary>
        public void SimulatePurchase(string productId)
        {
            PurchaseProduct(productId);
        }

        /// <summary>구매 복원 (SendMessage 래퍼) - comma-separated product IDs를 받아 비소비형만 복원</summary>
        public void SimulateRestorePurchases(string productIds)
        {
            EnsureProductsInitialized();

            List<string> restoredList = new List<string>();

            if (!string.IsNullOrEmpty(productIds))
            {
                string[] ids = productIds.Split(',');
                for (int i = 0; i < ids.Length; i++)
                {
                    string id = ids[i].Trim();
                    if (string.IsNullOrEmpty(id)) continue;

                    // enum 파싱 시도
                    bool parsed = false;
                    IAPProduct parsedProduct = IAPProduct.RemoveAds;
                    foreach (IAPProduct p in System.Enum.GetValues(typeof(IAPProduct)))
                    {
                        if (p.ToString() == id)
                        {
                            parsedProduct = p;
                            parsed = true;
                            break;
                        }
                    }

                    if (!parsed) continue;

                    // 비소비형인지 확인
                    if (productLookup == null || !productLookup.ContainsKey(parsedProduct)) continue;
                    IAPProductInfo info = productLookup[parsedProduct];
                    if (info.isConsumable) continue;

                    // 복원 처리
                    SavePurchase(parsedProduct);
                    ProcessPurchase(parsedProduct);
                    restoredList.Add(id);
                    Debug.Log("[IAPManager] Restored: " + id);
                }
            }

            // restoredProducts JSON 배열 생성
            string restoredJson = "[";
            for (int i = 0; i < restoredList.Count; i++)
            {
                if (i > 0) restoredJson += ",";
                restoredJson += "\"" + restoredList[i] + "\"";
            }
            restoredJson += "]";

            SendIAPEvent("{\"event\":\"restoreComplete\",\"restoredProducts\":" + restoredJson + "}");
        }

        /// <summary>Mock 구매 결과 설정 (success/cancel/network_error/product_unavailable/payment_declined)</summary>
        public void SetMockPurchaseResult(string result)
        {
            mockPurchaseResult = result;
            Debug.Log("[IAPManager] Mock purchase result set to: " + result);
        }

        /// <summary>모든 구매 기록 초기화 (테스트용)</summary>
        public void ResetAllPurchases(string _unused)
        {
            if (products != null)
            {
                for (int i = 0; i < products.Length; i++)
                {
                    PlayerPrefs.DeleteKey(PURCHASE_PREFIX + products[i].product.ToString());
                }
            }
            PlayerPrefs.Save();

            // mock 상태 리셋
            lastPurchaseProductId = "";
            lastPurchaseSuccess = false;
            lastPurchaseFailureReason = "";
            mockPurchaseResult = "success";

            // AdManager 광고 제거 상태도 되돌리기
            if (AdManager.Instance != null)
            {
                AdManager.Instance.SetAdsRemoved("false");
            }

            Debug.Log("[IAPManager] All purchases reset.");
        }

        #endregion

        private void SaveLastPurchaseResult()
        {
            PlayerPrefs.SetString("IAP_LastPurchaseProductId", lastPurchaseProductId);
            PlayerPrefs.SetInt("IAP_LastPurchaseSuccess", lastPurchaseSuccess ? 1 : 0);
            PlayerPrefs.SetString("IAP_LastPurchaseFailureReason", lastPurchaseFailureReason);
            PlayerPrefs.Save();
        }

        private void LoadLastPurchaseResult()
        {
            if (PlayerPrefs.HasKey("IAP_LastPurchaseProductId"))
            {
                lastPurchaseProductId = PlayerPrefs.GetString("IAP_LastPurchaseProductId", "");
                lastPurchaseSuccess = PlayerPrefs.GetInt("IAP_LastPurchaseSuccess", 0) == 1;
                lastPurchaseFailureReason = PlayerPrefs.GetString("IAP_LastPurchaseFailureReason", "");
            }
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }
    }
}
