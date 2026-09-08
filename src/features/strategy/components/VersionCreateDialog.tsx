"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  FormHelperText,
} from "@mui/material";
import type { StrategyVersion } from "../types/strategy";
import { nextVersionLabel } from "../lib/versioning";

export function VersionCreateDialog({
  open,
  versions,
  onClose,
  onSubmit,
}: {
  open: boolean;
  versions: StrategyVersion[];
  onClose: () => void;
  onSubmit: (mode: "blank" | "duplicate", sourceVersionId: string | null, versionLabel: string) => void;
}) {
  const [mode, setMode] = useState<"blank" | "duplicate">("duplicate");
  const [label, setLabel] = useState(() => nextVersionLabel(versions));

  const latest = versions[versions.length - 1];

  const submit = () => {
    onSubmit(
      mode,
      mode === "duplicate" ? (latest?.id ?? null) : null,
      label.trim() || nextVersionLabel(versions)
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { backgroundImage: "none" } } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800, pb: 1 }}>نسخة جديدة</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <RadioGroup
            value={mode}
            onChange={(e) => setMode(e.target.value as "blank" | "duplicate")}
          >
            <FormControlLabel
              value="duplicate"
              control={<Radio size="small" />}
              label={
                <Box sx={{ fontSize: 13 }}>
                  تكرار النسخة الحالية {latest ? `(${latest.version})` : ""}
                  <Box component="span" sx={{ display: "block", fontSize: 11, color: "text.secondary" }}>
                    تبدأ من قيم النسخة الحالية ثم تعدّلها بلا تأثير عليها.
                  </Box>
                </Box>
              }
            />
            <FormControlLabel
              value="blank"
              control={<Radio size="small" />}
              label={
                <Box sx={{ fontSize: 13 }}>
                  نسخة فارغة
                  <Box component="span" sx={{ display: "block", fontSize: 11, color: "text.secondary" }}>
                    تبدأ من الإعدادات الافتراضية ثم تعدّلها بالكامل.
                  </Box>
                </Box>
              }
            />
          </RadioGroup>

          <TextField
            label="تسمية النسخة"
            size="small"
            dir="ltr"
            helperText={`الإصدار التلقائي التالي: ${nextVersionLabel(versions)}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <FormHelperText sx={{ fontSize: 11 }}>
            النسخة الجديدة ستصبح النسخة النشطة تلقائيًا.
          </FormHelperText>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button size="small" onClick={onClose}>
          إلغاء
        </Button>
        <Button size="small" variant="contained" onClick={submit}>
          إنشاء النسخة
        </Button>
      </DialogActions>
    </Dialog>
  );
}