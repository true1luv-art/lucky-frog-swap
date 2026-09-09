import React from "react";
import classNames from "clsx";
import { getImageSrc } from "@/features/utils/getImageSrc";

const darkBorder = "/assets/ui/panel/dark_border.png";
const lightBorder = "/assets/ui/panel/light_border.png";

interface Props {
  className?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  title?: string;
  children?: React.ReactNode;
}

export const Panel: React.FC<Props> = ({ children, className, style, onClick }) => {
  return (
    <OuterPanel className={className} style={style} onClick={onClick}>
      <InnerPanel>{children}</InnerPanel>
    </OuterPanel>
  );
};

export const InnerPanel: React.FC<Props> = ({ children, className, style, onClick, onMouseEnter, onMouseLeave, title }) => {
  return (
    <div
      className={classNames("bg-brown-300 p-1", className)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title}
      style={{
        borderStyle: "solid",
        borderWidth: "6px",
        borderImage: `url(${getImageSrc(lightBorder)}) 30 stretch`,
        borderImageSlice: "25%",
        imageRendering: "pixelated",
        borderImageRepeat: "repeat",
        borderRadius: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const OuterPanel: React.FC<Props> = ({ children, className, style, onClick, onMouseEnter, onMouseLeave, title }) => {
  return (
    <div
      className={classNames(
        "bg-brown-600 p-0.5 text-white shadow-lg font-body text-shadow text-xs sm:text-sm",
        className
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={title}
      style={{
        borderStyle: "solid",
        borderWidth: "6px",
        borderImage: `url(${getImageSrc(darkBorder)}) 30 stretch`,
        borderImageSlice: "25%",
        imageRendering: "pixelated",
        borderImageRepeat: "repeat",
        borderRadius: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
