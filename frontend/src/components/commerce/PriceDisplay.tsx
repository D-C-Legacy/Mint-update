import React from "react";
import { AppText } from "../ui";
import { formatUSD } from "../../constants/currency";
export function PriceDisplay({
  value,
  ...props
}: Omit<React.ComponentProps<typeof AppText>, "children"> & { value: number }) {
  return (
    <AppText
      {...props}
      style={[{ fontVariant: ["tabular-nums"] }, props.style]}
    >
      {formatUSD(value)}
    </AppText>
  );
}
