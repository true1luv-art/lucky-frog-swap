import { useState, useEffect, useRef } from "react";

export const useShowScrollbar = (scrollableDivHeight: number) => {
  const [showScrollbar, setShowScrollbar] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollHeight = ref.current?.scrollHeight;
    if (scrollHeight && scrollHeight > scrollableDivHeight) {
      setShowScrollbar(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.current]);

  return { ref, showScrollbar };
};
