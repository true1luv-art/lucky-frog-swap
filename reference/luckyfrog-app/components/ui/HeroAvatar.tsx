"use client";

import React, { useState } from "react";
import classNames from "classnames";
const darkBorder = "/assets/ui/panel/dark_border.png";

// §C4 — No player level (§5.13). The level badge was removed; avatar is cosmetic only.
interface HeroAvatarProps {
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** unused, kept for API parity */
  emoji?: string;
  /**
   * Optional image override — when set it replaces the generated identicon avatar.
   */
  imageUrl?: string | null;
}

const sizeConfig = {
  sm: { container: "w-10 h-10", fallbackText: "text-lg" },
  md: { container: "w-14 h-14", fallbackText: "text-xl" },
  lg: { container: "w-20 h-20", fallbackText: "text-3xl" },
};

export const HeroAvatar: React.FC<HeroAvatarProps> = ({
  name = "Hero",
  size = "md",
  className,
  imageUrl,
}) => {
  const [imageError, setImageError] = useState(false);
  const avatarUrl = imageUrl || `https://images.hive.blog/u/${name.toLowerCase().trim()}/avatar`;
  const config = sizeConfig[size];

  return (
    <div className={classNames("relative inline-block", className)}>
      <div
        className={classNames(
          "bg-brown-600 flex items-center justify-center overflow-hidden",
          config.container
        )}
        style={{
          borderStyle: "solid",
          borderWidth: "4px",
          borderImage: `url(${darkBorder}) 30 stretch`,
          borderImageSlice: "25%",
          imageRendering: "pixelated",
          borderImageRepeat: "repeat",
          borderRadius: "8px",
        }}
      >
        {!imageError ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            style={{ imageRendering: imageUrl ? "pixelated" : "auto" }}
            onError={() => setImageError(true)}
          />
        ) : (
          <span className={classNames("text-white text-shadow", config.fallbackText)}>
            ?
          </span>
        )}
      </div>
    </div>
  );
};

export default HeroAvatar;
