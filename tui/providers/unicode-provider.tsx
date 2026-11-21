import * as React from "react";

import {
  isNoUnicode,
  UnicodeContext,
} from "@/hooks/use-unicode";
import type { UnicodeProviderProps } from "@/components/ui/types";

export type {
  UnicodeContextValue,
  UnicodeProviderProps,
} from "@/components/ui/types";

export const UnicodeProvider = ({
  children,
  unicode,
}: UnicodeProviderProps) => {
  const value = React.useMemo(
    () => ({ unicode: unicode ?? !isNoUnicode() }),
    [unicode]
  );

  return (
    <UnicodeContext.Provider value={value}>{children}</UnicodeContext.Provider>
  );
};
