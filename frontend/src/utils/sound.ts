// Звук нового доната. Рисуем его сами через Web Audio API (встроен в браузер),
// поэтому звуковой файл не нужен: две мягкие ноты, вторая чуть выше — «динь-дон».
//
// Включён ли звук, хранится в браузере (localStorage), как и тема:
// на одном компьютере звук нужен, на телефоне модератора — нет.

const STORAGE_KEY = 'donation-sound'

// Ноты в герцах и сколько звучит каждая, в секундах.
// Ноты средние (ре и соль второй октавы): высокие звучат резко.
const NOTES = [
  { frequency: 587.3, start: 0, duration: 0.5 },
  { frequency: 784, start: 0.14, duration: 0.7 },
]
// Громкость от 0 до 1. Тихо, чтобы не перебивать стрим.
const VOLUME = 0.07
// За сколько секунд нота плавно набирает громкость. Чем дольше, тем мягче начало.
const FADE_IN_SECONDS = 0.03

// Звук по умолчанию выключен: запись есть, только если его включили
export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function saveSoundEnabled(enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, 'on')
    } else {
      localStorage.removeItem(STORAGE_KEY)
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

    // Громкость плавно нарастает и плавно затухает, чтобы не было щелчков
    const noteStart = startTime + note.start
    gain.gain.setValueAtTime(0, noteStart)
    gain.gain.linearRampToValueAtTime(VOLUME, noteStart + FADE_IN_SECONDS)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration)

    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + note.duration)
  }
}
