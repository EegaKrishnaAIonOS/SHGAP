import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { cn } from "../../lib/cn";

/**
 * Renders one tool's structured output as a small card — for both the live
 * voice call (via `usePipecatConversation`'s `function_call` messages) and
 * the text-chat fallback (via its own `tool_results` field), which return
 * the same result shapes from the same `app/actions.py` handlers (T12).
 * Switches on the result's own shape rather than strictly on the tool name,
 * so it degrades gracefully if a handler's result shape changes.
 */
export function ActionResultCard({ result }: { result: unknown }) {
  const { t } = useTranslation();

  if (!result || typeof result !== "object") return null;
  const data = result as Record<string, unknown>;

  if (data.status === "created" && typeof data.product_name === "string") {
    return (
      <ActionCardShell tone="success">
        {t("voice.action.productRegistered", {
          name: data.product_name,
          category: data.category_name,
        })}
      </ActionCardShell>
    );
  }

  if (data.status === "found" && Array.isArray(data.products)) {
    return (
      <ActionCardShell tone="success">
        <ul className="flex flex-col gap-1">
          {data.products.map((p, i) => {
            const product = p as { name: string; price: number; stock: number };
            return (
              <li key={i}>
                {t("voice.action.priceLine", {
                  name: product.name,
                  price: product.price,
                  stock: product.stock,
                })}
              </li>
            );
          })}
        </ul>
      </ActionCardShell>
    );
  }

  if (data.status === "not_found") {
    return <ActionCardShell tone="neutral">{t("voice.action.priceNotFound")}</ActionCardShell>;
  }

  if (data.status === "found" && Array.isArray(data.chunks)) {
    return (
      <ActionCardShell tone="success">
        <ul className="flex flex-col gap-2">
          {data.chunks.map((c, i) => {
            const chunk = c as { scheme_name: string; content: string; source_title: string };
            return (
              <li key={i}>
                <p className="font-medium text-neutral-800">{chunk.scheme_name}</p>
                <p className="text-neutral-600">{chunk.content}</p>
                <p className="text-xs text-neutral-400">{chunk.source_title}</p>
              </li>
            );
          })}
        </ul>
      </ActionCardShell>
    );
  }

  if (data.error === "no_shg_registered") {
    return <ActionCardShell tone="warning">{t("voice.action.noShgRegistered")}</ActionCardShell>;
  }

  if (data.status === "no_match" || typeof data.error === "string") {
    const message =
      typeof data.message === "string" ? data.message : t("voice.action.genericError");
    return <ActionCardShell tone="warning">{message}</ActionCardShell>;
  }

  return null;
}

function ActionCardShell({
  tone,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <Card
      padded
      className={cn(
        "text-sm",
        tone === "success" && "border-success-500/40 bg-success-500/5",
        tone === "warning" && "border-danger-500/40 bg-danger-500/5",
        tone === "neutral" && "bg-neutral-50",
      )}
    >
      {children}
    </Card>
  );
}
