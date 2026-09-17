"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function LiveCounter({ value, className }: { value: number; className?: string }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20, mass: 0.7 });
  const display = useTransform(spring, (latest) => Math.round(latest).toLocaleString("en-IN"));
  const [text, setText] = useState("0");

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    return unsubscribe;
  }, [display]);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span layout className={className}>
      {text}
    </motion.span>
  );
}
