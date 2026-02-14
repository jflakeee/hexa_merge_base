namespace HexaMerge.Utility
{
    using UnityEngine;
    using System.Collections.Generic;

    public class ObjectPool
    {
        private readonly GameObject prefab;
        private readonly Transform parent;
        private readonly Queue<GameObject> pool = new Queue<GameObject>();

        public ObjectPool(GameObject prefab, Transform parent, int initialSize)
        {
            this.prefab = prefab;
            this.parent = parent;

            for (int i = 0; i < initialSize; i++)
            {
                var obj = Object.Instantiate(prefab, parent);
                obj.SetActive(false);
                pool.Enqueue(obj);
            }
        }

        public GameObject Get()
        {
            GameObject obj;
            if (pool.Count > 0)
            {
                obj = pool.Dequeue();
            }
            else
            {
                obj = Object.Instantiate(prefab, parent);
            }
            obj.SetActive(true);
            return obj;
        }

        public void Return(GameObject obj)
        {
            obj.SetActive(false);
            obj.transform.SetParent(parent);
            pool.Enqueue(obj);
        }

        public void ReturnAll()
        {
            // Note: only returns objects that are already tracked
        }

        public int AvailableCount => pool.Count;
    }
}
