import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  format?: (value: number) => string
  duration?: number
  className?: string
}

export function AnimatedNumber({
  value,
  format = (v) => v.toLocaleString(),
  duration = 1,
  className,
}: AnimatedNumberProps) {
  const spring = useSpring(0, { duration: duration * 1000 })
  const display = useTransform(spring, (latest) => format(Math.round(latest)))
  const ref = useRef<HTMLSpanElement>(null)
  
  useEffect(() => {
    spring.set(value)
  }, [spring, value])
  
  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}
