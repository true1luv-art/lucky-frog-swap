import React from "react";
import classNames from "classnames";
import { getImageSrc } from "@/features/utils/getImageSrc";

const border = "/assets/ui/panel/white_border.png";

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export const Label: React.FC<Props> = ({ children, className }) => {
  return (
    <div
      className={classNames(
        "bg-silver-300 text-white text-shadow text-xs object-contain justify-center items-center flex",
        className
      )}
      style={{
        borderStyle: "solid",
        borderWidth: "5px",
        borderImage: `url(${getImageSrc(border)}) 30 stretch`,
        borderImageSlice: "25%",
        imageRendering: "pixelated",
        borderImageRepeat: "repeat",
        borderRadius: "15px",
      }}
    >
      {children}
    </div>
  );
};
