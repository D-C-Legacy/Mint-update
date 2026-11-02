import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';
import { AppText } from '../ui';
import { colors as c, spacing } from '../../theme';

const AnimatedG = Animated.createAnimatedComponent(G);

const WEDGE_COLORS = [c.brand, c.live, c.warning, c.success, c.urgent, c.textSecondary];
const SPIN_DURATION_MS = 3600;
const EXTRA_SPINS = 5;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function wedgePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export type PrizeWheelItem = { id: string; label: string };

// A real circular prize wheel for the seller's own "Spin the wheel" queue picker — seller-only,
// never shown to viewers (see spin-queue-wheel.usecase.ts's own header comment: a viewer-facing
// spin/landing animation was explicitly ruled out as a gambling-adjacent mechanic, pending its own
// legal review). The server already picked the winner by the time this spins (`targetId`); this is
// a real spin animation landing on that known answer, not a random draw of its own.
export function PrizeWheel({
  items,
  targetId,
  spinning,
  onFinish,
  size = 240,
}: {
  items: PrizeWheelItem[];
  targetId: string | null;
  spinning: boolean;
  onFinish: () => void;
  size?: number;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const accumulated = useRef(0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const wedgeAngle = items.length > 0 ? 360 / items.length : 360;

  useEffect(() => {
    if (!spinning || !targetId) return;
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (targetIndex < 0) return;
    const targetCenter = targetIndex * wedgeAngle + wedgeAngle / 2;
    const landingOffset = (360 - targetCenter) % 360;
    const current = accumulated.current;
    // Forward-only delta that lands the wheel's mod-360 angle on `landingOffset`, plus a few full
    // turns on top so it reads as a real spin rather than a small nudge.
    const delta = (((landingOffset - (current % 360)) % 360) + 360) % 360;
    const finalValue = current + delta + EXTRA_SPINS * 360;
    accumulated.current = finalValue;
    // `rotation` here is an SVG `<G>` prop, not a `transform` style — the native driver only
    // patches transform/opacity, so this animation has to run on the JS thread.
    Animated.timing(rotation, {
      toValue: finalValue,
      duration: SPIN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
    // items/wedgeAngle intentionally excluded — the candidate set is fixed for the duration of one
    // spin (the server already resolved the winner against it), re-running this on an unrelated
    // items reference change would restart the animation mid-spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, targetId]);

  return (
    <View style={{ alignItems: 'center', gap: spacing.md }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <AnimatedG origin={`${cx}, ${cy}`} rotation={rotation}>
            {items.map((item, i) => {
              const start = i * wedgeAngle;
              const end = start + wedgeAngle;
              const mid = start + wedgeAngle / 2;
              const labelPos = polarToCartesian(cx, cy, r * 0.62, mid);
              return (
                <G key={item.id}>
                  <Path
                    d={wedgePath(cx, cy, r, start, end)}
                    fill={WEDGE_COLORS[i % WEDGE_COLORS.length]}
                    stroke={c.canvas}
                    strokeWidth={2}
                  />
                  <SvgText
                    x={labelPos.x}
                    y={labelPos.y}
                    fill={c.canvas}
                    fontSize={11}
                    fontWeight="700"
                    textAnchor="middle"
                    rotation={mid}
                    origin={`${labelPos.x}, ${labelPos.y}`}
                  >
                    {item.label.length > 14 ? `${item.label.slice(0, 13)}…` : item.label}
                  </SvgText>
                </G>
              );
            })}
          </AnimatedG>
          <Circle cx={cx} cy={cy} r={r * 0.1} fill={c.canvas} stroke={c.ink} strokeWidth={2} />
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: -2,
            left: size / 2 - 10,
            width: 0,
            height: 0,
            borderLeftWidth: 10,
            borderRightWidth: 10,
            borderTopWidth: 16,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: c.ink,
          }}
        />
      </View>
      {items.length === 0 ? <AppText muted>No pending items to spin.</AppText> : null}
    </View>
  );
}
