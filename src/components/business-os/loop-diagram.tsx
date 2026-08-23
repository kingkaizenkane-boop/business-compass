import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { LOOP_STAGES, type LoopStageId } from "@/lib/business-os";

/**
 * The core loop, rendered as a single continuous circuit.
 * `current` marks where a business sits today; earlier stages read as complete.
 */
export function LoopDiagram({
  current,
  variant = "full",
  className,
}: {
  current?: LoopStageId;
  variant?: "full" | "compact";
  className?: string;
}) {
  const currentIndex = current ? LOOP_STAGES.find((s) => s.id === current)?.index ?? 0 : 0;

  return (
    <ol
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border bg-border",
        variant === "full"
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-9",
        className,
      )}
    >
      {LOOP_STAGES.map((stage) => {
        const done = currentIndex > stage.index;
        const active = currentIndex === stage.index;

        return (
          <motion.li
            key={stage.id}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: stage.index * 0.03 }}
            aria-current={active ? "step" : undefined}
            className={cn(
              "bg-card p-4",
              variant === "full" && "p-6",
              active && "bg-accent",
              done && "bg-surface",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "numeric text-xs",
                  active ? "text-primary" : done ? "text-positive" : "text-muted-foreground",
                )}
              >
                {String(stage.index).padStart(2, "0")}
              </span>
              {active ? (
                <span className="eyebrow text-primary">Here now</span>
              ) : done ? (
                <span className="eyebrow text-positive">Done</span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 font-medium leading-snug text-foreground",
                variant === "full" ? "text-base" : "text-[0.8125rem]",
              )}
            >
              {stage.label}
            </p>
            {variant === "full" ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stage.summary}</p>
            ) : null}
          </motion.li>
        );
      })}
    </ol>
  );
}
