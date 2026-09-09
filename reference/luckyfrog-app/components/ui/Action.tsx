import React from "react";
import { InnerPanel } from "@/components/ui/Panel";
import classNames from "classnames";

interface Props {
  text: string;
  icon: string | { src: string };
  onClick: () => void;
  className: string;
}

export const Action: React.FC<Props> = ({ text, icon, onClick, className }) => {
  const iconSrc = typeof icon === "string" ? icon : icon?.src;
  return (
    <div
      onClick={onClick}
      className={classNames("cursor-pointer", className)}
      data-html2canvas-ignore="false"
    >
      <div className="absolute w-10 h-10 -left-2 -top-1 flex items-center justify-center">
        <img src="/assets/icons/disc.png" className="w-full absolute inset-0" alt="" />
        <img src={iconSrc} className="w-2/3 z-10" alt="" />
      </div>
      <InnerPanel className="text-white text-shadow text-xs w-fit whitespace-nowrap">
        <span className="pl-7 pr-2">{text}</span>
      </InnerPanel>
    </div>
  );
};
