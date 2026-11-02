export type Activity = {
  id: string;
  title: string;
  detail: string;
  kind: "bid" | "live" | "order" | "win" | "payment";
};
