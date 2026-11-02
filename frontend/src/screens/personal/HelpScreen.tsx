import React, { useEffect, useState } from "react";
import { AppText, EmptyState, MenuRow, Screen } from "../../components";
import { useApp } from "../../hooks";
import { listHelpArticles, type HelpArticleView } from "../../api/help";
import { describeApiError } from "../../api/describe-error";

// Real as of Phase 8 — admin-authored FAQ content (recommended over hardcoding, so staff can
// edit it without an app release). Was a mock "demo request" form before; the demo submission
// never sent anywhere, so it is gone rather than kept pointing at nothing.
export function HelpScreen({ inline = false }: { inline?: boolean }) {
  const app = useApp();
  const [articles, setArticles] = useState<HelpArticleView[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listHelpArticles()
      .then((page) => {
        if (!alive) return;
        setArticles(page.items);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(describeApiError(err));
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const byCategory = articles.reduce<Record<string, HelpArticleView[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <Screen title="Help & support" onBack={inline ? undefined : app.back}>
      <AppText size={24} bold>
        We’re here to help.
      </AppText>
      {status === "loading" ? (
        <AppText muted>Loading…</AppText>
      ) : status === "error" ? (
        <EmptyState title="Couldn't load help articles" detail={error} />
      ) : articles.length === 0 ? (
        <EmptyState title="No help articles yet" detail="Check back soon." />
      ) : (
        Object.entries(byCategory).map(([category, rows]) => (
          <React.Fragment key={category}>
            <AppText bold size={13} style={{ marginTop: 12, marginBottom: 4 }}>
              {category}
            </AppText>
            {rows.map((a) => (
              <React.Fragment key={a.id}>
                <MenuRow title={a.title} onPress={() => setOpenId(openId === a.id ? null : a.id)} />
                {openId === a.id ? <AppText muted>{a.body}</AppText> : null}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))
      )}
    </Screen>
  );
}
