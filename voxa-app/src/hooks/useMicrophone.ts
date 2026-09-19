import { useCallback, useRef, useState } from 'react'
import { AudioService } from '../services/audioService'

export function useMicrophone() {
  const serviceRef = useRef<AudioService | null>(null)
  const [amplitude, setAmplitude] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rafRef = useRef<number | null>(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const service = new AudioService()
      await service.start()
      serviceRef.current = service
      const loop = () => {
        setAmplitude(service.getAmplitude())
        rafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch (e) {
      setError('mic-denied')
    }
  }, [])

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    serviceRef.current?.stop()
    serviceRef.current = null
    setAmplitude(0)
  }, [])

  return { amplitude, error, start, stop }
}
