"use client";

import { useEffect, useState } from "react";

import { getWarehouses } from "@/repositories/warehouse.repository";
import type { Warehouse } from "@/types/warehouse";

const STORAGE_KEY_PREFIX = "octopus-selected-warehouse-";

export function useWarehouseSelection(businessId: string | undefined) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  useEffect(() => {
    if (!businessId) return;

    getWarehouses(businessId).then((all) => {
      const active = all.filter((w) => w.active);

      setWarehouses(active);

      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + businessId);
      const storedIsValid = active.some((w) => w.id === stored);

      if (stored && storedIsValid) {
        setSelectedWarehouseId(stored);
      } else {
        const fallback = active.find((w) => w.is_default) ?? active[0];
        setSelectedWarehouseId(fallback?.id ?? "");
      }
    });
  }, [businessId]);

  function selectWarehouse(id: string) {
    setSelectedWarehouseId(id);

    if (businessId) {
      localStorage.setItem(STORAGE_KEY_PREFIX + businessId, id);
    }
  }

  return { warehouses, selectedWarehouseId, selectWarehouse };
}
