import React from "react";
import { View } from "react-native";
import { AppText, Icon } from "../ui";
import type { Order } from "../../types";
import { colors, spacing } from "../../theme";
const steps = [
  "Order confirmed",
  "Preparing your find",
  "Shipped",
  "Delivered",
];
export function TrackingStatus({ status }: { status: Order["status"] }) {
  if (status === "Cancelled")
    return (
      <AppText muted>
        This order was cancelled. Nothing will be shipped.
      </AppText>
    );
  if (status === "Awaiting Payment")
    return (
      <AppText muted>
        Complete your mock payment to start the order journey.
      </AppText>
    );
  const completed = status === "Delivered" ? 3 : status === "Shipped" ? 2 : 1;
  return (
    <>
      {steps.map((step, index) => (
        <View
          key={step}
          style={{
            paddingVertical: spacing.md,
            flexDirection: "row",
            gap: spacing.md,
          }}
        >
          <Icon
            name={index <= completed ? "checkmark-circle" : "ellipse-outline"}
            color={index <= completed ? colors.success : colors.textSecondary}
          />
          <AppText muted={index > completed}>{step}</AppText>
        </View>
      ))}
    </>
  );
}
