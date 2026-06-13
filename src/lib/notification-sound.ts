'use client'

let audioContext: AudioContext | null = null

/**
 * Play a notification sound using the Web Audio API.
 * Creates a pleasant two-tone chime sound.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return

  try {
    // Create or reuse AudioContext
    if (!audioContext) {
      audioContext = new AudioContext()
    }

    // Resume context if suspended (required by some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    const now = audioContext.currentTime

    // First tone - higher pitch
    const oscillator1 = audioContext.createOscillator()
    const gainNode1 = audioContext.createGain()

    oscillator1.connect(gainNode1)
    gainNode1.connect(audioContext.destination)

    oscillator1.type = 'sine'
    oscillator1.frequency.setValueAtTime(880, now) // A5
    oscillator1.frequency.exponentialRampToValueAtTime(660, now + 0.1) // E5

    gainNode1.gain.setValueAtTime(0.3, now)
    gainNode1.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

    oscillator1.start(now)
    oscillator1.stop(now + 0.2)

    // Second tone - lower pitch, slightly delayed
    const oscillator2 = audioContext.createOscillator()
    const gainNode2 = audioContext.createGain()

    oscillator2.connect(gainNode2)
    gainNode2.connect(audioContext.destination)

    oscillator2.type = 'sine'
    oscillator2.frequency.setValueAtTime(660, now + 0.12) // E5
    oscillator2.frequency.exponentialRampToValueAtTime(440, now + 0.3) // A4

    gainNode2.gain.setValueAtTime(0.01, now)
    gainNode2.gain.setValueAtTime(0.25, now + 0.12)
    gainNode2.gain.exponentialRampToValueAtTime(0.01, now + 0.4)

    oscillator2.start(now + 0.12)
    oscillator2.stop(now + 0.4)
  } catch (err) {
    // Silently fail - sound is optional
    console.warn('[NotificationSound] Could not play notification sound:', err)
  }
}
