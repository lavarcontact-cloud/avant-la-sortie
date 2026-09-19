// Thin wrapper around getUserMedia + Web Audio API analyser, used to drive
// the live waveform visualization from real microphone amplitude data.
export class AudioService {
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private dataArray: Uint8Array | null = null

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 256
    this.source = this.audioCtx.createMediaStreamSource(this.stream)
    this.source.connect(this.analyser)
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
  }

  /** Returns a 0..1 amplitude snapshot for the current frame. */
  getAmplitude(): number {
    if (!this.analyser || !this.dataArray) return 0
    this.analyser.getByteTimeDomainData(this.dataArray as Uint8Array<ArrayBuffer>)
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      const centered = (this.dataArray[i] - 128) / 128
      sum += centered * centered
    }
    return Math.min(1, Math.sqrt(sum / this.dataArray.length) * 3)
  }

  /** Returns the raw frequency bins, for a bar-style waveform. */
  getFrequencyBins(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0)
    const bins = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(bins)
    return bins
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.audioCtx?.close().catch(() => {})
    this.stream = null
    this.source = null
    this.analyser = null
    this.audioCtx = null
    this.dataArray = null
  }
}
