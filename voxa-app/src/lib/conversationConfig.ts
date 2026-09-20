// Single source of truth for the timing constants used by the continuous
// hands-free conversation loop (see useConversation.ts). Keep every magic
// number related to turn-taking here instead of scattering it across hooks.

/**
 * How long to wait, after the last speech-recognition result (interim or
 * final) with no further result, before we consider the speaker's turn
 * over and finalize the transcript. Long enough to survive a brief
 * mid-sentence pause, short enough that real silence ends the turn quickly.
 */
export const TURN_END_SILENCE_MS = 1000

/**
 * Safety delay after TTS playback ends before we resume listening for the
 * other speaker. Gives the device's own speaker a moment to fully stop
 * before the microphone (and speech recognition) is reactivated, on top of
 * the hard STT-suspension during playback (see anti-echo handling).
 */
export const POST_TTS_LISTEN_DELAY_MS = 400

/**
 * Best-effort UA sniff used ONLY to decide whether to proactively show a
 * "tap to keep listening" affordance. Web Speech API's `continuous` mode is
 * known to be unreliable on iOS Safari (it may stop after a short utterance
 * or not restart cleanly); we cannot verify real behavior on-device from
 * this environment, so we treat Safari on iOS as "continuous not trusted"
 * and surface a manual resume affordance instead of silently failing.
 */
export function isLikelyUnreliableContinuousSTT(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)
  return isIOS && isSafari
}
