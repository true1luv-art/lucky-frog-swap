import React from "react";

interface Props {
  percentage: number;
}

export const HealthBar: React.FC<Props> = ({ percentage }) => {
  if (percentage >= 50) {
    return <img src="/assets/ui/progress/blue_half.png" className="w-10" alt="half" />;
  }
  if (percentage >= 25) {
    return <img src="/assets/ui/progress/blue_almost.png" className="w-10" alt="almost" />;
  }
  return <img src="/assets/ui/progress/blue_empty.png" className="w-10" alt="empty" />;
};
