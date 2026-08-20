"use client";

import { useRef, type InputHTMLAttributes, type PointerEvent } from "react";
import { requiresRecordWallTimeDisambiguation } from "@/shared/time/zoned-date-time";
import styles from "./records.module.css";

type NativePickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

type NativePickerFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & Readonly<{
  label: string;
  type: "date" | "datetime-local";
}>;

/**
 * Focuses a native date/time input and asks supporting browsers to show its
 * picker. The input remains a native control, so keyboard and assistive
 * technology interactions keep their platform behavior.
 */
export const focusAndOpenNativePicker = (input: HTMLInputElement | null): void => {
  if (!input || input.disabled) {
    return;
  }

  input.focus({ preventScroll: true });

  try {
    (input as NativePickerInput).showPicker?.();
  } catch {
    // Some browsers expose showPicker but only permit it for a direct gesture.
    // Focusing the native input remains the accessible fallback in that case.
  }
};

export const NativePickerField = ({ label, type, ...inputProps }: NativePickerFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openFromField = (event: PointerEvent<HTMLLabelElement>) => {
    if (event.button !== 0) {
      return;
    }

    focusAndOpenNativePicker(inputRef.current);
  };

  return (
    <label className={`${styles.fieldLabel} ${styles.nativePickerField}`} onPointerDown={openFromField}>
      <span>{label}</span>
      <input {...inputProps} ref={inputRef} type={type} />
    </label>
  );
};

type RepeatedWallTimeChoiceProps = Readonly<{
  label: string;
  name: string;
  value: string;
  wallTime: string;
  timezone: string;
  onChange: (value: string) => void;
}>;

/** Displays an occurrence selector only where a timezone really repeats a wall time. */
export const RepeatedWallTimeChoice = ({
  label,
  name,
  value,
  wallTime,
  timezone,
  onChange,
}: RepeatedWallTimeChoiceProps) => {
  if (!requiresRecordWallTimeDisambiguation(wallTime, timezone)) {
    return null;
  }

  return (
    <label className={styles.fieldLabel}>
      {label}
      <select name={name} value={value === "later" ? "later" : "earlier"} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="earlier">첫 번째 시각</option>
        <option value="later">두 번째 시각</option>
      </select>
    </label>
  );
};
