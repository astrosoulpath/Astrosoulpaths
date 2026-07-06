import { useEffect, useState } from "react";

export function useOtpCooldown(initialSeconds = 30) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft]);

  const startCooldown = () => {
    setSecondsLeft(initialSeconds);
  };

  return {
    secondsLeft,
    isCoolingDown: secondsLeft > 0,
    startCooldown,
  };
}
