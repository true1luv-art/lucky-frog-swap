import React from "react";
import { secondsToString } from "@/features/utils/time";

interface Props {
  percentage: number;
  seconds: number;
}

export const Bar: React.FC<Props> = ({ percentage }) => {
  if (percentage >= 100) {
    return <img src="/assets/ui/progress/full.png" className="w-10" alt="full" />;
  }
  if (percentage >= 75) {
    return <img src="/assets/ui/progress/almost.png" className="w-10" alt="almost" />;
  }
  if (percentage >= 50) {
    return <img src="/assets/ui/progress/half.png" className="w-10" alt="half" />;
  }
  if (percentage >= 25) {
    return <img src="/assets/ui/progress/quarter.png" className="w-10" alt="quarter" />;
  }
  return <img src="/assets/ui/progress/start.png" className="w-10" alt="start" />;
};

export const ProgressBar: React.FC<Props> = ({ percentage, seconds }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      {seconds > 0 && (
        <span className="text-shadow text-xxs text-white -mb-0.5">
          {secondsToString(seconds)}
        </span>
      )}
      <Bar percentage={percentage} seconds={seconds} />
    </div>
  );
};
