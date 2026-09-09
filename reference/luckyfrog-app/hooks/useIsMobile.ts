"use client";

import { useEffect, useState } from "react";
import { detectMobile } from "@/features/utils/detect-mobile";

export { detectMobile };

export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobile());
  }, []);

  return [isMobile];
};
