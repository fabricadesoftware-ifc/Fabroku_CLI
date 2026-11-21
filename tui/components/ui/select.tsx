import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { useInteraction } from "@/hooks/use-interaction";
import { useTheme } from "@/hooks/use-theme";
import { useUnicode } from "@/hooks/use-unicode";
import { resolveTerminalSymbol } from "@/lib/terminal-symbols";

export interface SelectOption<T = string> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  onChange?: (value: T) => void;
  onSubmit?: (value: T) => void;
  label?: string;
  cursor?: string;
  cursorColor?: string;
  id?: string;
  autoFocus?: boolean;
  isActive?: boolean;
  disabled?: boolean;
  /** Fabroku: chamado quando a opção destacada muda (setas). */
  onHighlight?: (value: T) => void;
  /** Fabroku: mostra no máximo N opções, com rolagem. */
  maxVisible?: number;
  "aria-label"?: string;
}

export const Select = <T = string,>({
  options,
  value: controlledValue,
  defaultValue,
  onValueChange,
  onChange,
  onSubmit,
  label,
  cursor,
  cursorColor,
  id,
  autoFocus = false,
  isActive = true,
  disabled = false,
  onHighlight,
  maxVisible,
  "aria-label": ariaLabel,
}: SelectProps<T>) => {
  const theme = useTheme();
  const unicode = useUnicode();
  const resolvedCursor = cursor ?? resolveTerminalSymbol(unicode, "›", ">");
  const selectedIndicator = resolveTerminalSymbol(unicode, "✓", "*");
  const firstEnabledIndex = Math.max(
    0,
    options.findIndex((option) => !option.disabled)
  );
  // Fabroku: começa na opção já escolhida (não na primeira).
  const initialIndex = options.findIndex(
    (o) => o.value === (controlledValue ?? defaultValue) && !o.disabled
  );
  const [activeIndex, setActiveIndex] = useState(
    initialIndex === -1 ? firstEnabledIndex : initialIndex
  );
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlledValue ?? internalValue;

  // Fabroku: avisa qual opção está destacada (prévia ao vivo do tema).
  useEffect(() => {
    const opt = options[activeIndex];
    if (opt) onHighlight?.(opt.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Fabroku: janela de rolagem para listas longas.
  const windowSize = maxVisible ?? options.length;
  const windowStart = Math.min(
    Math.max(0, activeIndex - Math.floor(windowSize / 2)),
    Math.max(0, options.length - windowSize)
  );
  const visible = options.slice(windowStart, windowStart + windowSize);

  const resolvedCursorColor = cursorColor ?? theme.colors.primary;

  const { isFocused } = useInteraction(
    (input, key) => {
      if (key.upArrow) {
        setActiveIndex((i) => {
          let next = i - 1;
          while (next >= 0 && options[next]?.disabled) {
            next -= 1;
          }
          return next < 0 ? i : next;
        });
      } else if (key.downArrow) {
        setActiveIndex((i) => {
          let next = i + 1;
          while (next < options.length && options[next]?.disabled) {
            next += 1;
          }
          return next >= options.length ? i : next;
        });
      } else if (key.home) {
        setActiveIndex(firstEnabledIndex);
      } else if (key.end) {
        const lastEnabledIndex = options.findLastIndex(
          (option) => !option.disabled
        );
        if (lastEnabledIndex !== -1) {
          setActiveIndex(lastEnabledIndex);
        }
      } else if (key.return) {
        const opt = options[activeIndex];
        if (opt && !opt.disabled) {
          if (controlledValue === undefined) {
            setInternalValue(opt.value);
          }
          (onValueChange ?? onChange)?.(opt.value);
          onSubmit?.(opt.value);
        }
      }
    },
    { autoFocus, disabled, id, isActive }
  );

  return (
    <Box aria-role="listbox" aria-state={{ disabled }} flexDirection="column">
      {label && (
        <Text aria-label={ariaLabel ?? label} bold>
          {label}
        </Text>
      )}
      {windowStart > 0 && (
        <Text dimColor>{`  ${resolveTerminalSymbol(unicode, "↑", "^")} ${windowStart} acima`}</Text>
      )}
      {visible.map((opt, visibleIdx) => {
        const idx = windowStart + visibleIdx;
        const isActive = idx === activeIndex;
        const isSelected =
          selectedValue !== undefined && opt.value === selectedValue;

        let optColor: string;
        if (opt.disabled) {
          optColor = theme.colors.mutedForeground;
        } else if (isActive) {
          optColor = resolvedCursorColor;
        } else {
          optColor = theme.colors.foreground;
        }

        return (
          <Box
            key={idx}
            aria-label={opt.hint ? `${opt.label}: ${opt.hint}` : opt.label}
            aria-role="option"
            aria-state={{ disabled: opt.disabled, selected: isSelected }}
            gap={1}
          >
            <Text
              aria-hidden
              color={isActive ? resolvedCursorColor : undefined}
            >
              {isActive ? resolvedCursor : " "}
            </Text>
            {isSelected && (
              <Text aria-hidden color={theme.colors.primary}>
                {selectedIndicator}
              </Text>
            )}
            <Text
              aria-hidden
              color={optColor}
              bold={isActive || isSelected}
              dimColor={opt.disabled}
            >
              {opt.label}
            </Text>
            {opt.hint && (
              <Text aria-hidden color={theme.colors.mutedForeground} dimColor>
                {opt.hint}
              </Text>
            )}
          </Box>
        );
      })}
      {windowStart + visible.length < options.length && (
        <Text dimColor>{`  ${resolveTerminalSymbol(unicode, "↓", "v")} ${options.length - windowStart - visible.length} abaixo`}</Text>
      )}
    </Box>
  );
};
