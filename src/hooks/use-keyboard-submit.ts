import { useEffect, useRef } from "react";

export function useKeyboardSubmit(
  onSubmit: () => void,
  enabled: boolean = true
) {
  const savedHandler = useRef(onSubmit);

  useEffect(() => {
    savedHandler.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        savedHandler.current?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}
