import * as tokens from "../../theme";
import { Card } from "../../components/ui/Card";
import { SHOW_STEPS } from "../../constants/categories";
import { validateShowStep } from "../../utils/show";

import React, { useState } from "react";
import { View } from "react-native";
import {
  AppText,
  Badge,
  Button,
  Field,
  MenuRow,
  Screen,
  s,
} from "../../components";
import { products } from "../../data";
import { colors as c, formatUSD } from "../../theme";
import { useApp } from "../../context";
// The wizard body is also reused inside the seller portal's "Schedule show" pane
// (`SellerPortal.web.tsx`, desktop web): there the pane passes `onDone` that returns to the
// dashboard pane instead of navigating back.
export function CreateShow() {
  const app = useApp();
  return (
    <Screen title="Create show" onBack={app.back}>
      <CreateShowContent onDone={app.back} />
    </Screen>
  );
}

export function CreateShowContent({ onDone }: { onDone?: () => void }) {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("Friday night finds");
  const [description, setDescription] = useState(
    "The best of the collection. Come hang out.",
  );
  const [selected, setSelected] = useState(["jordan"]);
  const [duration, setDuration] = useState("30");
  const [increment, setIncrement] = useState("50");
  const [shipping, setShipping] = useState("12");
  const [date, setDate] = useState("2026-10-02");
  const [time, setTime] = useState("19:00");
  const steps = SHOW_STEPS;
  return (
    <>
      <AppText muted size={13}>
        STEP {step + 1} OF 6 · {steps[step]}
      </AppText>
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          marginVertical: tokens.spacing.xl,
        }}
      >
        {steps.map((v, i) => (
          <View
            key={v}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              backgroundColor: i <= step ? c.brand : c.line,
            }}
          />
        ))}
      </View>
      <AppText size={26} bold style={{ marginBottom: tokens.spacing.xl }}>
        {steps[step]}
      </AppText>
      {step === 0 ? (
        <>
          <Field label="Show title" value={title} onChange={setTitle} />
          <Field
            label="Description"
            value={description}
            onChange={setDescription}
            multiline
          />
        </>
      ) : step === 1 ? (
        app.inventory
          .filter((p) => p.quantity > 0)
          .map((p) => (
            <MenuRow
              key={p.id}
              title={(selected.includes(p.id) ? "✓ " : "") + p.name}
              detail={formatUSD(p.price)}
              onPress={() =>
                setSelected((v) =>
                  v.includes(p.id) ? v.filter((x) => x !== p.id) : [...v, p.id],
                )
              }
            />
          ))
      ) : step === 2 ? (
        <>
          <Field
            label="Auction duration (seconds)"
            value={duration}
            onChange={setDuration}
            keyboardType="numeric"
          />
          <Field
            label="Bid increment (USD)"
            value={increment}
            onChange={setIncrement}
            keyboardType="numeric"
          />
          <AppText muted>
            Countdowns extend with late bids in this preview.
          </AppText>
        </>
      ) : step === 3 ? (
        <>
          <Field
            label="Flat shipping rate (USD)"
            value={shipping}
            onChange={setShipping}
            keyboardType="numeric"
          />
          <AppText muted>United States · 3–5 business days</AppText>
        </>
      ) : step === 4 ? (
        <>
          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} />
          <Field
            label="Time (24-hour, local)"
            value={time}
            onChange={setTime}
          />
        </>
      ) : (
        <Card style={[{ gap: tokens.spacing.md }]}>
          <Badge label="UPCOMING" />
          <AppText size={26} bold>
            {title}
          </AppText>
          <AppText>{description}</AppText>
          <AppText muted>
            {date} · {time} · {selected.length} products
          </AppText>
          <AppText>
            {duration}s auctions · {formatUSD(Number(increment))} increments
          </AppText>
          <AppText>{formatUSD(Number(shipping))} shipping</AppText>
        </Card>
      )}
      <View style={{ gap: tokens.spacing.md, marginTop: tokens.spacing.xxl }}>
        <Button
          label={step === 5 ? "Schedule show" : "Continue"}
          disabled={
            (step === 0 && !title.trim()) || (step === 1 && !selected.length)
          }
          onPress={() => {
            const error = validateShowStep(step, {
              duration,
              increment,
              shipping,
              date,
              time,
            });
            if (error) {
              app.toast(error);
              return;
            }
            if (step < 5) setStep((v) => v + 1);
            else {
              app.scheduleShow({
                title,
                description,
                productIds: selected,
                duration: Number(duration),
                increment: Number(increment),
                shipping: Number(shipping),
                date,
                time,
              });
              app.toast("Your mock show is scheduled");
              onDone?.();
            }
          }}
        />
        {step > 0 && (
          <Button
            secondary
            label="Previous step"
            onPress={() => setStep((v) => v - 1)}
          />
        )}
      </View>
    </>
  );
}
