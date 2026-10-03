"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function LiveCounter({
  value,
  className,
  slow = false,
}: {
  value: number;
  className?: string;
  slow?: boolean;
}) {
  const spring = useSpring(
    value,
    slow ? { stiffness: 22, damping: 28, mass: 1.15 } : { stiffness: 80, damping: 20, mass: 0.7 },
  );
  const display = useTransform(spring, (latest) => Math.round(latest).toLocaleString("en-IN"));
  const [text, setText] = useState(() => Math.round(value).toLocaleString("en-IN"));

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    return unsubscribe;
  }, [display]);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span className={className}>
      {text}
    </motion.span>
  );
}
