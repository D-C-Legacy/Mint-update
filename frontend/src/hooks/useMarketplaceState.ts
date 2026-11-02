import { useCallback, useState } from "react";
import { products, orders as initialOrders } from "../data";
import { scheduledShows } from "../data/shows";
import type { Order } from "../types";
import type { ScheduledShow } from "../types/show";
export function useMarketplaceState() {
  const [inventory, setInventory] = useState(products);
  const [orders, setOrders] = useState(initialOrders);
  const [shows, setShows] = useState(scheduledShows);
  const [saved, setSaved] = useState<string[]>([]),
    [following, setFollowing] = useState<string[]>([]);
  const toggleSave = useCallback(
    (id: string) =>
      setSaved((v) =>
        v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
      ),
    [],
  );
  const toggleFollow = useCallback(
    (id: string) =>
      setFollowing((v) =>
        v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
      ),
    [],
  );
  const scheduleShow = useCallback(
    (show: Omit<ScheduledShow, "id">) =>
      setShows((v) => [{ ...show, id: "show-" + Date.now() }, ...v]),
    [],
  );
  const addOrder = useCallback(
    (productId: string, amount: number, shipping: number) => {
      const id = "SF-" + Date.now().toString().slice(-6);
      const order: Order = {
        id,
        productId,
        status: "Processing",
        date: "Today",
        amount,
        shipping,
      };
      setOrders((v) => [order, ...v]);
      return id;
    },
    [],
  );
  return {
    inventory,
    setInventory,
    orders,
    shows,
    saved,
    following,
    toggleSave,
    toggleFollow,
    scheduleShow,
    addOrder,
  };
}
