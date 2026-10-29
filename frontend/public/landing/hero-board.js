// Живая доска на первом экране лендинга (landing.html).
// По кругу показывает, как работает сервис:
//   1. приходит донат — в «Очереди» появляется карточка;
//   2. стример берёт верхнюю карточку в работу;
//   3. карточка из «В работе» уходит в «Выполнено».
// Вместе с этим подсвечиваются шаги под заголовком (.flow li).

// Донаты, которые по очереди «приходят» на доску: ник, сумма, уровень (цвет), текст
const DONATIONS = [
  ['Nyasha', 300, 'mid', 'Нарисуй кота в Paint'],
  ['MegaBoss', 1500, 'top', 'Говори голосом робота 10 минут'],
  ['Кот_Борис', 50, 'low', 'Передай привет маме'],
  ['Аня', 600, 'high', 'Сыграй на гитаре'],
  ['Тёма', 250, 'mid', 'Покрутись на стуле'],
]

// Пауза между шагами, в миллисекундах
const STEP_PAUSE = 1800
// Сколько карточек помещается в колонку: лишние из «Выполнено» уходят
const MAX_CARDS = 4

document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('hero-board')
  // Кто попросил в системе «поменьше анимации» — тому показываем доску без движения
  if (!board || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  const queue = board.querySelector('[data-column="queue"]')
  const work = board.querySelector('[data-column="work"]')
  const done = board.querySelector('[data-column="done"]')

  let nextDonation = 0
  let step = 0
  updateCounts()
  setInterval(runStep, STEP_PAUSE)

  function runStep() {
    if (step === 0) {
      addDonation()
      highlightStep('donation')
    } else if (step === 1) {
      moveCard(queue.firstElementChild, work)
      highlightStep('work')
    } else {
      moveCard(work.lastElementChild, done)
      highlightStep('done')
    }
    step = (step + 1) % 3
  }

  // Новый донат встаёт в «Очередь» по сумме: чем больше, тем выше
  function addDonation() {
    const [nick, amount, level, text] = DONATIONS[nextDonation]
    nextDonation = (nextDonation + 1) % DONATIONS.length

    const card = document.createElement('div')
    card.className = `board-card level-${level} new`
    card.dataset.amount = amount
    card.innerHTML = `<b>${nick}</b><span class="sum">${amount.toLocaleString('ru-RU')} ₽</span><p>${text}</p>`

    const below = [...queue.children].find((other) => readAmount(other) < amount)
    animateLayout(() => queue.insertBefore(card, below ?? null))
    // Подсветка «новый донат» гаснет через пару секунд
    setTimeout(() => card.classList.remove('new'), STEP_PAUSE * 1.5)
  }

  // Переносит карточку наверх другой колонки
  function moveCard(card, column) {
    if (!card) return
    animateLayout(() => {
      column.prepend(card)
      if (column.children.length > MAX_CARDS) {
        column.lastElementChild.remove()
      }
    })
  }

  function highlightStep(name) {
    for (const item of document.querySelectorAll('.flow li')) {
      item.classList.toggle('active', item.dataset.step === name)
    }
  }

  function updateCounts() {
    for (const column of board.querySelectorAll('.board-column')) {
      column.querySelector('.board-count').textContent = column.querySelector('.board-cards').children.length
    }
  }

  // Сумма карточки. У карточек из HTML её нет в data-amount — берём из текста «1 000 ₽»
  function readAmount(card) {
    return Number(card.dataset.amount ?? card.querySelector('.sum').textContent.replace(/\D/g, ''))
  }

  // Плавное перемещение. Запоминаем, где стояли карточки, меняем доску, а потом
  // каждую карточку сдвигаем из старого места в новое. Новые карточки просто проявляются.
  // offsetLeft/offsetTop считаются от .board (у неё position: relative) и не зависят от наклона доски.
  function animateLayout(change) {
    const before = new Map()
    for (const card of board.querySelectorAll('.board-card')) {
      before.set(card, [card.offsetLeft, card.offsetTop])
    }

    change()
    updateCounts()

    for (const card of board.querySelectorAll('.board-card')) {
      const old = before.get(card)
      if (!old) {
        card.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'none' }], {
          duration: 500,
          easing: 'ease-out',
        })
        continue
      }
      const dx = old[0] - card.offsetLeft
      const dy = old[1] - card.offsetTop
      if (dx || dy) {
        card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 700,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
    }
  }
})
