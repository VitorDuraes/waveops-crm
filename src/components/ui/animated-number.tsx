"use client";
// src/components/ui/animated-number.tsx — numero que conta de 0 ate o valor ao entrar na viewport.
// Mesmo padrao do CountUp do ReactBits (motion useSpring + useInView), mas com formatador proprio
// para BRL/percentual/dias. O formatador vem do StatCard (client->client, serializavel nao se aplica).
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";

export function AnimatedNumber({
  value,
  format,
  duration = 1.6,
  className = "",
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const spring = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const reduceMotion = useReducedMotion();

  // Estado inicial: zero formatado (evita flash). Com reduced-motion, ja mostra o valor final.
  useEffect(() => {
    if (ref.current) ref.current.textContent = format(reduceMotion ? value : 0);
  }, [format, reduceMotion, value]);

  useEffect(() => {
    if (reduceMotion) return;
    if (isInView) motionValue.set(value);
  }, [reduceMotion, isInView, value, motionValue]);

  useEffect(() => {
    if (reduceMotion) return;
    const unsubscribe = spring.on("change", (latest: number) => {
      if (ref.current) ref.current.textContent = format(latest);
    });
    return () => unsubscribe();
  }, [reduceMotion, spring, format]);

  return <span ref={ref} className={className} />;
}
