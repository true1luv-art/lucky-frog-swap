import React, { useState, useEffect } from "react";
import classNames from "classnames";
import Decimal from "decimal.js-light";
import { getImageSrc } from "@/lib/utils/getImageSrc";
import { Label } from "@/components/ui/Label";

const darkBorder = "/assets/ui/panel/dark_border.png";
const selectBox = "/assets/ui/select/select_box.png";
const cancel = "/assets/icons/cancel.png";

export interface BoxProps {
  image?: string | { src: string };
  secondaryImage?: string | { src: string };
  isSelected?: boolean;
  count?: Decimal | number | string;
  onClick?: () => void;
  disabled?: boolean;
  locked?: boolean;
}

const shortenCount = (count: Decimal | number | string | undefined): string => {
  if (count === undefined || count === null) return "";
  const decimalCount = new Decimal(count);
  if (decimalCount.lessThan(1))
    return decimalCount.toDecimalPlaces(2, Decimal.ROUND_FLOOR).toString();
  if (decimalCount.lessThan(1000))
    return decimalCount.toDecimalPlaces(0, Decimal.ROUND_FLOOR).toString();
  const isThousand = decimalCount.lessThan(1e6);
  return `${decimalCount
    .div(isThousand ? 1000 : 1e6)
    .toDecimalPlaces(1, Decimal.ROUND_FLOOR)
    .toString()}${isThousand ? "k" : "m"}`;
};

export const Box: React.FC<BoxProps> = ({
  image,
  secondaryImage,
  isSelected,
  count,
  onClick,
  disabled,
  locked,
}) => {
  const [isHover, setIsHover] = useState(false);
  const [shortCount, setShortCount] = useState("");

  useEffect(() => setShortCount(shortenCount(count)), [count]);

  const canClick = !locked && !disabled;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <div
        className={classNames(
          "w-12 h-12 bg-brown-600 m-1.5 cursor-pointer flex items-center justify-center relative",
          {
            "bg-brown-600 cursor-not-allowed": disabled,
            "bg-brown-200": isSelected,
            "opacity-75": locked,
            "cursor-pointer": canClick,
          }
        )}
        onClick={canClick ? onClick : undefined}
        style={{
          borderStyle: "solid",
          borderWidth: "6px",
          borderImage: `url(${getImageSrc(darkBorder)}) 30 stretch`,
          borderImageSlice: "25%",
          imageRendering: "pixelated",
          borderImageRepeat: "repeat",
          borderRadius: "20px",
        }}
      >
        {secondaryImage ? (
          <div className="w-full flex">
            <img src={getImageSrc(image)} className="w-4/5 object-contain" alt="item" />
            <img
              src={getImageSrc(secondaryImage)}
              className="absolute right-0 bottom-1 w-1/2 h-1/2 object-contain"
              alt="crop"
            />
          </div>
        ) : (
          image && (
            <img
              src={getImageSrc(image)}
              className="h-full w-full object-contain"
              alt="item"
            />
          )
        )}

        {locked && (
          <img
            src={cancel}
            className="absolute w-6 -top-3 -right-3 px-0.5 z-20"
            alt="locked"
          />
        )}

        {!locked && count !== undefined && count !== null && new Decimal(count).greaterThan(0) && (
          <Label
            className={classNames("absolute -top-4 -right-3 px-0.5 text-xs z-10", {
              "z-20": isHover,
            })}
          >
            {isHover ? new Decimal(count).toString() : shortCount}
          </Label>
        )}
      </div>
      {(isSelected || isHover) && !locked && !disabled && (
        <img
          className="absolute w-14 h-14 top-0.5 left-0.5 pointer-events-none"
          src={selectBox}
          alt=""
        />
      )}
    </div>
  );
};
