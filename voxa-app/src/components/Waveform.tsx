import { useEffect, useRef } from 'react'

interface WaveformProps {
  amplitude: number // 0..1
  active: boolean
  color?: string
}

// Minimal animated waveform drawn on canvas, driven by real mic amplitude
// when `active` is true. Idle state shows a gentle flat line.
export default function Waveform({ amplitude, active, color = '#7dd3c0' }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<number[]>(new Array(48).fill(0))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const draw = () => {
      const history = historyRef.current
      history.shift()
      history.push(active ? amplitude : 0.03)

      ctx.clearRect(0, 0, width, height)
      const barWidth = width / history.length
      const midY = height / 2

      history.forEach((val, i) => {
        const barHeight = Math.max(2, val * height * 0.9)
        const x = i * barWidth
        ctx.fillStyle = color
        ctx.globalAlpha = 0.35 + (i / history.length) * 0.65
        ctx.fillRect(x, midY - barHeight / 2, barWidth - 2, barHeight)
      })
      ctx.globalAlpha = 1
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [amplitude, active, color])

  return <canvas ref={canvasRef} className="w-full h-16" />
}
