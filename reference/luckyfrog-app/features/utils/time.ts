function getTimeUnits(time: number) {
  const seconds = Math.ceil(time % 60);
  const minutes = Math.floor((time / 60) % 60);
  const hours = Math.floor((time / 60 / 60) % 24);
  const days = Math.floor(time / 60 / 60 / 24);

  return [
    days && `${days}days`,
    hours && `${hours}hrs`,
    minutes && `${minutes}mins`,
    seconds && `${seconds}secs`,
  ].filter(Boolean);
}

export function secondsToString(
  seconds: number,
  options?: { length?: "short" | "medium" | "long" }
) {
  const length = options?.length ?? "short";
  const secondsCeil = Math.ceil(seconds);

  if (length === "medium") {
    return secondsToMidString(seconds);
  }

  if (length === "long") {
    return secondsToLongString(seconds);
  }

  if (secondsCeil < 60) {
    return `${secondsCeil}secs`;
  }

  if (secondsCeil === 60) {
    return `1min`;
  }

  if (seconds < 60 * 60) {
    return `${Math.ceil(seconds / 60)}mins`;
  }

  if (seconds === 60 * 60) {
    return "1hr";
  }

  if (seconds < 60 * 60 * 24) {
    return `${Math.ceil(seconds / 60 / 60)}hrs`;
  }

  if (seconds === 60 * 60 * 24) {
    return "1day";
  }

  return `${Math.ceil(seconds / 60 / 60 / 24)}days`;
}

export function secondsToMidString(time: number) {
  return getTimeUnits(time).slice(0, 2).join(" ");
}

export function secondsToLongString(time: number) {
  return getTimeUnits(time).join(" ");
}

export function getTimeLeft(createdAt: number, totalTime: number) {
  const millisecondsElapsed = Date.now() - createdAt;
  if (millisecondsElapsed > totalTime * 1000) {
    return 0;
  }

  return totalTime - millisecondsElapsed / 1000;
}
