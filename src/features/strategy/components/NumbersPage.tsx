"use client";

import { useMemo, useState } from "react";
import { Box, Button } from "@mui/material";
import { PageHeader, Status, SkeletonCard } from "@/components/ui";
import {
  LayersIcon,
  PlusIcon,
  GitCompareIcon,
  RefreshIcon,
} from "@/components/icons/icons";
import type { StrategyNumbers, StrategyVersion } from "../types/strategy";
import { useStrategyNumbers } from "../hooks/useStrategyNumbers";
import { StrategyCard } from "./StrategyCard";
import { StrategyFormDialog, type StrategyFormResult } from "./StrategyFormDialog";
import { VersionCreateDialog } from "./VersionCreateDialog";
import { VersionFormDialog } from "./VersionFormDialog";
import { VersionCompareDialog } from "./VersionCompareDialog";

export function NumbersPage() {
  const store = useStrategyNumbers();
  const { strategies, status } = store;

  const [openForm, setOpenForm] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formTarget, setFormTarget] = useState<StrategyNumbers | null>(null);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openVersionCreate, setOpenVersionCreate] = useState<string | null>(null);
  const [editVersionTarget, setEditVersionTarget] = useState<{ strategy: StrategyNumbers; version: StrategyVersion } | null>(null);

  const [compareStrategyId, setCompareStrategyId] = useState<string | null>(null);

  const compareableCount = useMemo(
    () => strategies.filter((s) => s.versions.length >= 2).length,
    [strategies]
  );
  const compareStrategy = useMemo(
    () => strategies.find((s) => s.id === compareStrategyId) ?? null,
    [strategies, compareStrategyId]
  );

  const openCreate = () => {
    setFormMode("create");
    setFormTarget(null);
    setOpenForm(true);
  };
  const openEdit = (s: StrategyNumbers) => {
    setFormMode("edit");
    setFormTarget(s);
    setOpenForm(true);
  };
  const openCompare = (s?: StrategyNumbers) => {
    const target = s ?? strategies.find((x) => x.versions.length >= 2);
    if (target) setCompareStrategyId(target.id);
  };

  const handleFormSubmit = (result: StrategyFormResult) => {
    if (formMode === "create") {
      store.createStrategy(result.meta, { versionLabel: result.versionLabel, defaults: result.defaults });
    } else if (formTarget) {
      store.updateStrategyMeta(formTarget.id, result.meta);
    }
  };

  const hasLocalData = strategies.length > 0;

  if (status === "loading" && !hasLocalData) {
    return (
      <div>
        <PageHeader eyebrow="Strategy Numbers" icon={<LayersIcon className="h-5 w-5" />} title="أرقام الاستراتيجية" />
        <div className="mt-4 space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Strategy Numbers"
        icon={<LayersIcon className="h-5 w-5" />}
        title="أرقام الاستراتيجية"
        description="إصدارات كاملة من أرقام المخاطر والتداول والتنفيذ. كل نسخة لقطة مستقلة — تعديل نسخة لا يمس غيرها والنسخة النشطة هي مصدر الحاسبة."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Status
              label={
                status === "saved"
                  ? "محفوظ"
                  : status === "saving"
                    ? "جارٍ الحفظ…"
                    : status === "error"
                      ? "خطأ في المزامنة"
                      : "محلي"
              }
              tone={status === "saved" || status === "local" ? "good" : status === "error" ? "down" : "warn"}
              pulse={status === "loading" || status === "saving"}
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<GitCompareIcon className="h-4 w-4" />}
              disabled={!compareableCount}
              onClick={() => openCompare()}
            >
              مقارنة النسخ
            </Button>
            <Button size="small" variant="contained" startIcon={<PlusIcon className="h-4 w-4" />} onClick={openCreate}>
              إنشاء استراتيجية
            </Button>
          </div>
        }
      />

      {hasLocalData ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {strategies.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              open={openCardId === s.id}
              onToggleOpen={() => setOpenCardId((cur) => (cur === s.id ? null : s.id))}
              onEditMeta={() => openEdit(s)}
              onDuplicate={() => store.duplicateStrategy(s.id)}
              onDelete={() => store.deleteStrategy(s.id)}
              onCompare={() => openCompare(s)}
              onCreateVersion={() => setOpenVersionCreate(s.id)}
              onSetActiveVersion={(versionId) => store.setActiveVersion(s.id, versionId)}
              onEditVersion={(version) => setEditVersionTarget({ strategy: s, version })}
              onDeleteVersion={(versionId) => store.deleteVersion(s.id, versionId)}
            />
          ))}
        </Box>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-card border border-line bg-surface-1/40 p-10 text-center">
          <LayersIcon className="h-10 w-10 text-muted" />
          <div>
            <h2 className="text-base font-bold text-zinc-100">لا توجد استراتيجيات بعد</h2>
            <p className="mt-1 text-xs text-muted">
              أنشئ أول استراتيجية لتبدأ جمع أرقام التداول في نسخ مستقلة.
            </p>
          </div>
          <Button size="small" variant="contained" startIcon={<PlusIcon className="h-4 w-4" />} onClick={openCreate}>
            إنشاء استراتيجية
          </Button>
        </div>
      )}

      {!hasLocalData && status === "error" ? (
        <>
          <p className="text-2xs text-muted">تعذّت مزامنة البيانات البعيدة، البيانات العرضية محلية.</p>
          <Button size="small" startIcon={<RefreshIcon className="h-4 w-4" />} onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </>
      ) : null}

      <StrategyFormDialog
        key={formTarget?.id ?? "create-form"}
        open={openForm}
        mode={formMode}
        initial={formTarget}
        onClose={() => setOpenForm(false)}
        onSubmit={handleFormSubmit}
      />

      {openVersionCreate ? (
        <VersionCreateDialog
          open
          versions={strategies.find((s) => s.id === openVersionCreate)?.versions ?? []}
          onClose={() => setOpenVersionCreate(null)}
          onSubmit={(mode, sourceVersionId, versionLabel) => {
            store.createVersion(openVersionCreate, { mode, sourceVersionId: sourceVersionId ?? undefined, versionLabel });
            setOpenVersionCreate(null);
          }}
        />
      ) : null}

      <VersionFormDialog
        key={editVersionTarget?.version.id ?? "edit-version"}
        open={Boolean(editVersionTarget)}
        version={editVersionTarget?.version ?? null}
        strategyName={editVersionTarget?.strategy.name ?? ""}
        onClose={() => setEditVersionTarget(null)}
        onSubmit={(patch) => {
          if (editVersionTarget) {
            store.editVersion(editVersionTarget.strategy.id, editVersionTarget.version.id, patch);
          }
        }}
      />

      {compareStrategy ? (
        <VersionCompareDialog
          open
          versions={compareStrategy.versions}
          activeVersionId={compareStrategy.activeVersionId}
          onClose={() => setCompareStrategyId(null)}
        />
      ) : null}
    </div>
  );
}