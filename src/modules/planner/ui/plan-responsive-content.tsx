"use client";

import { useEffect, useState } from "react";

import styles from "./plan.module.css";

export const PlanResponsiveContent = ({ desktop, mobile }: { desktop: React.ReactNode; mobile: React.ReactNode }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return <div className={isMobile ? styles.mobilePlanContent : styles.desktopPlanContent}>{isMobile ? mobile : desktop}</div>;
};
