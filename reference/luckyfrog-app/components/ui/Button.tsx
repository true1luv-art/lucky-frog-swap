import React from "react";
import classNames from "classnames";
import { getImageSrc } from "@/features/utils/getImageSrc";

const border = "/assets/ui/panel/light_border.png";

interface Props {
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | undefined;
  children?: React.ReactNode;
}

export const Button: React.FC<Props> = ({ children, onClick, disabled, className, type }) => {
  return (
    <button
      className={classNames(
        "bg-brown-200 w-full p-1 shadow-sm text-white text-shadow object-contain justify-center items-center hover:bg-brown-300 cursor-pointer flex disabled:opacity-50",
        className
      )}
      type={type}
      disabled={disabled}
      onClick={onClick}
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
    </button>
  );
};
