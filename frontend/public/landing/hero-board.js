// Живая доска на первом экране лендинга (landing.html).
// По кругу показывает, как работает сервис:
//   1. приходит донат — в «Очереди» появляется карточка;
//   2. курсор-рука перетаскивает верхнюю карточку в «В работе»;
//   3. потом перетаскивает карточку из «В работе» в «Выполнено».
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
const STEP_PAUSE = 1400
// Сколько карточек помещается в колонку: лишние из «Выполнено» уходят
const MAX_CARDS = 4

// Курсор-рука (как у системного курсора «схватить»). Рисунок — иконка pan_tool из Material Icons
const HAND_SVG = `
  <svg viewBox="0 0 24 24" width="30" height="30">
    <path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z" />
  </svg>`

document.addEventListener('DOMContentLoaded', () => {
  const board = document.getElementById('hero-board')
  // Кто попросил в системе «поменьше анимации» — тому показываем доску без движения
  if (!board || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  const queue = board.querySelector('[data-column="queue"]')
  const work = board.querySelector('[data-column="work"]')
  const done = board.querySelector('[data-column="done"]')

  const hand = document.createElement('div')
  hand.className = 'board-hand'
  hand.innerHTML = HAND_SVG
  board.append(hand)
  // Где сейчас рука (от левого верхнего угла доски). Сначала — под доской справа
  let handX = board.offsetWidth * 0.8
  let handY = board.offsetHeight + 20
  placeHand(handX, handY)

  let nextDonation = 0
  updateCounts()
  runForever()

  async function runForever() {
    while (true) {
      highlightStep('donation')
      addDonation()
      await wait(STEP_PAUSE)

      highlightStep('work')
      await dragCard(queue.firstElementChild, work)
      await wait(STEP_PAUSE)

      highlightStep('done')
      await dragCard(work.lastElementChild, done)
      await wait(STEP_PAUSE)
    }
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
    card.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'none' }], {
      duration: 500,
      easing: 'ease-out',
    })
    // Подсветка «новый донат» гаснет через пару секунд
    setTimeout(() => card.classList.remove('new'), STEP_PAUSE * 2)
  }

  // Рука подходит к карточке, хватает её и тащит наверх другой колонки
  async function dragCard(card, column) {
    if (!card) return

    // 1. Подвести руку к карточке. Берём чуть правее середины, как мышкой
    const grabX = card.offsetWidth * 0.6
    const grabY = card.offsetHeight * 0.4
    await moveHand(card.offsetLeft + grabX, card.offsetTop + grabY, 600)

    // 2. Схватить: рука сжимается, карточка приподнимается
    hand.classList.add('grabbing')
    card.classList.add('dragged')
    await wait(200)

    // 3. Перенести. Карточка сразу переставляется в новую колонку, а анимация
    //    показывает, как она едет со старого места на новое — вместе с рукой
    const startX = card.offsetLeft
    const startY = card.offsetTop
    animateLayout(() => {
      column.prepend(card)
      if (column.children.length > MAX_CARDS) {
        column.lastElementChild.remove()
      }
    }, card)
    const dragTime = 900
    const dragEasing = 'cubic-bezier(0.45, 0, 0.25, 1)'
    card.animate(
      [
        { transform: `translate(${startX - card.offsetLeft}px, ${startY - card.offsetTop}px) rotate(3deg)` },
        { transform: 'rotate(3deg)' },
      ],
      { duration: dragTime, easing: dragEasing },
    )
    await moveHand(card.offsetLeft + grabX, card.offsetTop + grabY, dragTime, dragEasing)

    // 4. Отпустить: карточка ложится на место, рука разжимается и отходит в сторону
    card.classList.remove('dragged')
    card.animate([{ transform: 'rotate(3deg) scale(1.04)' }, { transform: 'none' }], { duration: 200 })
    hand.classList.remove('grabbing')
    await moveHand(handX + 30, handY + 40, 400)
  }

  function moveHand(x, y, duration, easing = 'ease-in-out') {
    const animation = hand.animate([{ transform: handPosition(handX, handY) }, { transform: handPosition(x, y) }], {
      duration,
      easing,
    })
    placeHand(x, y)
    return animation.finished
  }

  function placeHand(x, y) {
    handX = x
    handY = y
    hand.style.transform = handPosition(x, y)
  }

  function handPosition(x, y) {
    return `translate(${x}px, ${y}px)`
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

  // Плавная перестановка. Запоминаем, где стояли карточки, меняем доску, а потом каждую
  // карточку сдвигаем из старого места в новое. Карточку skip двигает сам dragCard.
  // offsetLeft/offsetTop считаются от .board (у неё position: relative) и не зависят от наклона доски.
  function animateLayout(change, skip) {
    const before = new Map()
    for (const card of board.querySelectorAll('.board-card')) {
      before.set(card, [card.offsetLeft, card.offsetTop])
    }

    change()
    updateCounts()

    for (const card of board.querySelectorAll('.board-card')) {
      const old = before.get(card)
      if (!old || card === skip) continue
      const dx = old[0] - card.offsetLeft
      const dy = old[1] - card.offsetTop
      if (dx || dy) {
        card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
    }
  }
})

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
