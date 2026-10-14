// Звук нового доната. Рисуем его сами через Web Audio API (встроен в браузер),
// поэтому звуковой файл не нужен: две короткие ноты, вторая выше — «дзынь».
//
// Включён ли звук, хранится в браузере (localStorage), как и тема:
// на одном компьютере звук нужен, на телефоне модератора — нет.

const STORAGE_KEY = 'donation-sound'

// Ноты в герцах и сколько звучит каждая, в секундах
const NOTES = [
  { frequency: 880, start: 0, duration: 0.18 },
  { frequency: 1318.5, start: 0.12, duration: 0.32 },
]
// Громкость от 0 до 1. Негромко, чтобы не перебивать стрим.
const VOLUME = 0.2

// Звук по умолчанию включён: запись есть, только если его выключили
export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSoundEnabled(enabled: boolean) {
  try {
    if (enabled) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, 'off')
    }
  } catch {
    // Браузер не даёт сохранить (например, приватное окно) — настройка проживёт до перезагрузки
  }
}

// Один «звуковой движок» на всё приложение. Браузер разрешает звук только после того,
// как человек хоть раз кликнул по странице, — до этого play молча ничего не сделает.
let audioContext: AudioContext | null = null

export function playDonationSound() {
  audioContext ??= new AudioContext()
  const startTime = audioContext.currentTime

  for (const note of NOTES) {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = note.frequency

    // Громкость быстро нарастает и плавно затухает, чтобы не было щелчков
    const noteStart = startTime + note.start
    gain.gain.setValueAtTime(0, noteStart)
    gain.gain.linearRampToValueAtTime(VOLUME, noteStart + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration)

    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + note.duration)
  }
}
