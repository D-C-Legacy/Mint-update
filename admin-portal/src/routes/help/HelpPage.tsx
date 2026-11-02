import { useEffect, useState } from 'react';
import {
  listHelpArticles,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
  type HelpArticle,
} from '../../api/help';
import { ApiError } from '../../lib/api-client';
import { Section } from '../../components/Section';
import { inputStyle, textareaStyle, secondaryButtonStyle, dangerButtonStyle, primaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const EMPTY_FORM = { category: '', title: '', body: '', sortOrder: 0 };

export function HelpPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const page = await listHelpArticles();
      setArticles(page.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load help articles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitCreate() {
    if (!form.category.trim() || !form.title.trim() || !form.body.trim()) return;
    setBusyId('new');
    try {
      await createHelpArticle({
        category: form.category.trim(),
        title: form.title.trim(),
        body: form.body.trim(),
        sortOrder: form.sortOrder,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create article.');
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublished(article: HelpArticle) {
    setBusyId(article.id);
    try {
      const updated = await updateHelpArticle(article.id, { isPublished: !article.isPublished });
      setArticles((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update article.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(article: HelpArticle) {
    setBusyId(article.id);
    try {
      await deleteHelpArticle(article.id);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete article.');
    } finally {
      setBusyId(null);
    }
  }

  const byCategory = articles.reduce<Record<string, HelpArticle[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Help content</h1>
      <p style={{ fontSize: typography.meta, color: colors.textSecondary, margin: 0 }}>
        Published articles show up in the app's Help &amp; support screen (GET /v1/help/articles, public).
      </p>

      {error && <div style={{ color: colors.urgent, fontSize: typography.body }}>{error}</div>}

      <Section title="New article">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <input
            placeholder="Category (e.g. Orders, Selling, Account)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={inputStyle}
          />
          <textarea
            placeholder="Answer"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={3}
            style={textareaStyle}
          />
          <button
            onClick={submitCreate}
            disabled={busyId === 'new' || !form.category.trim() || !form.title.trim() || !form.body.trim()}
            style={{ ...primaryButtonStyle, alignSelf: 'flex-start' }}
          >
            Add article
          </button>
        </div>
      </Section>

      {Object.entries(byCategory).map(([category, rows]) => (
        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <div style={{ fontWeight: 600, fontSize: typography.body }}>{category}</div>
          {rows.map((article) => (
            <div
              key={article.id}
              style={{
                background: colors.canvas,
                border: `1px solid ${colors.line}`,
                borderRadius: radii.cardLarge,
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.xs,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 600 }}>{article.title}</div>
                <span style={{ fontSize: typography.meta, color: article.isPublished ? colors.success : colors.textSecondary }}>
                  {article.isPublished ? 'Published' : 'Unpublished'}
                </span>
              </div>
              <div style={{ fontSize: typography.body, color: colors.text }}>{article.body}</div>
              <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.xs }}>
                <button onClick={() => togglePublished(article)} disabled={busyId === article.id} style={secondaryButtonStyle}>
                  {article.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => remove(article)} disabled={busyId === article.id} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {articles.length === 0 && !loading && (
        <div style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>No help articles yet.</div>
      )}
    </div>
  );
}
