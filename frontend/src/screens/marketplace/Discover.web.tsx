import React, { useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { EmptyState, Section } from "../../components";
import { StreamCardDesktop } from "../../components/live/StreamCardDesktop";
import { listCategories } from "../../api/catalog";
import { listLiveStreams } from "../../api/streams";
import { useAsync } from "../../api/use-async";
import { useApp } from "../../context";
import { spacing } from "../../theme";
import { CategoryRow } from "./shared";
import { DiscoverMobile } from "./DiscoverMobile";

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Discover page the app uses
// (`DiscoverMobile`) — web on a phone-width browser must look like the app. At/above it, this
// renders a wider grid (4-up instead of mobile's 3-up) and drops the in-page search bar and page
// title, since the desktop navbar (`MainTabNavigator.web.tsx`) already carries both.
const DESKTOP_BREAKPOINT = 768;

export function Discover() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <DiscoverMobile />;
  return <DesktopDiscover />;
}

function DesktopDiscover() {
  const app = useApp();
  const [picked, setPicked] = useState("All");

  const categoriesState = useAsync(listCategories, []);
  const categories = categoriesState.state.status === "ready" ? categoriesState.state.data : [];
  const topLevel = categories.filter((c) => c.parentId === null);

  const liveState = useAsync(() => listLiveStreams(), []);
  const liveSessions = liveState.state.status === "ready" ? liveState.state.data.items : [];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl }} showsVerticalScrollIndicator={false}>
      <Section title="Categories" action="All" onPress={() => setPicked("All")} />
      <CategoryRow categories={topLevel} value={picked} onChange={setPicked} />
      <Section title="Live Now" />
      {liveSessions.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {liveSessions.map((session) => (
            <StreamCardDesktop key={session.id} session={session} onPress={() => app.selectStream(session.id)} />
          ))}
        </View>
      ) : (
        <EmptyState title="Nothing live right now" detail="Check back soon." />
      )}
    </ScrollView>
  );
}
