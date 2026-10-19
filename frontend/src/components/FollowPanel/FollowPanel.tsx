import type { PublicBoard } from '../../api/viewer'
import type { PublicCard } from '../../types/card'
import { getAmountToTop, getFollowState, type FollowState } from '../../utils/follow'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import { CloseIcon, EyeIcon, InfoIcon } from '../Icons/Icons'
import styles from './FollowPanel.module.css'

// Сколько мест показываем чипами, остальные — «ещё N»
const MAX_PLACES = 5

type FollowPanelProps = {
  board: PublicBoard
  followedName: string
  getColumnCards: (columnId: number) => PublicCard[]
  onUnfollow: () => void
  // Прокрутить к карточке и подсветить её
  onShowCard: (cardId: number) => void
}

// Плашка «Ты следишь за …» на странице зрителя: где сейчас карточки этого ника.
export function FollowPanel(props: FollowPanelProps) {
  const { board, followedName, getColumnCards, onUnfollow, onShowCard } = props
  const state = getFollowState(board, followedName, getColumnCards)
  const panelClass = { work: styles.work, done: styles.work, none: styles.none, queue: '' }[state.kind]

  return (
    <section className={`${styles.panel} ${panelClass}`}>
      <p className={styles.label}>
        <EyeIcon />
        <span>Ты следишь за {followedName}</span>
      </p>
      <button className={styles.unfollow} type="button" onClick={handleUnfollowClick}>
        <CloseIcon />
        Не следить
      </button>
      <PanelBody state={state} followedName={followedName} isAutoMerge={board.autoMerge} onShowCard={onShowCard} />
    </section>
  )

  function handleUnfollowClick() {
    onUnfollow()
  }
}

type PanelBodyProps = {
  state: FollowState
  followedName: string
  isAutoMerge: boolean
  onShowCard: (cardId: number) => void
}

function PanelBody(props: PanelBodyProps) {
  const { state, followedName, isAutoMerge, onShowCard } = props

  if (state.kind === 'none') {
    return (
      <>
        <p className={styles.main}>Карточки на доске нет</p>
        <p className={styles.sub}>
          Её убрали, или донат ещё не пришёл. Как придёт донат от {followedName}, карточка появится здесь.
        </p>
      </>
    )
  }

  if (state.kind === 'work' || state.kind === 'done') {
    return (
      <>
        <p className={styles.main}>
          {state.kind === 'work' ? `В колонке «${state.column.title}»` : 'Выполнено ✓'}
        </p>
        <p className={styles.sub}>
          {state.kind === 'work' ? <>Сумма {getAmount(state.card)} · </> : <>Стример сделал задачу · </>}
          <ShowCardLink cardId={state.card.id} onShowCard={onShowCard} />
        </p>
      </>
    )
  }

  const { places, queueSize, topCard } = state
  const best = places[0]
  // Донат добавится к этой карточке, только если слияние включено и карточка у ника одна
  // (иначе бэкенд сольёт донат в самую старую из них, а не обязательно в эту)
  const canReachTop = isAutoMerge && places.length === 1 && best.place > 1
  // Без слияния новый донат станет отдельной карточкой — пишем об этом, если есть куда расти
  const showNoMergeNote = !isAutoMerge && (places.length > 1 || best.place > 1)

  return (
    <>
      {places.length === 1 ? (
        <>
          <p className={styles.main}>
            <span className={styles.number}>{best.place}-е</span> место в очереди из {queueSize}
          </p>
          <p className={styles.sub}>
            Сумма {getAmount(best.card)} · <ShowCardLink cardId={best.card.id} onShowCard={onShowCard} />
          </p>
        </>
      ) : (
        <>
          <p className={styles.main}>
            {places.length} {pluralize(places.length, ['карточка', 'карточки', 'карточек'])} в очереди из{' '}
            {queueSize}
          </p>
          <p className={styles.sub}>
            Лучшая — <b>{best.place}-е</b> место · <ShowCardLink cardId={best.card.id} onShowCard={onShowCard} />
          </p>
          <div className={styles.places}>
            {places.slice(0, MAX_PLACES).map((item) => (
              <button
                key={item.card.id}
                className={`${styles.place} ${item === best ? styles.bestPlace : ''}`}
                type="button"
                onClick={() => onShowCard(item.card.id)}
              >
                {item.place}-е
              </button>
            ))}
            {places.length > MAX_PLACES && (
              <span className={styles.morePlaces}>ещё {places.length - MAX_PLACES}</span>
            )}
          </div>
        </>
      )}

      {canReachTop && (
        <p className={styles.toTop}>
          До 1-го места <b>+{formatMoney(getAmountToTop(best.card, topCard), null)}</b>
          <span className={styles.toTopHint}>· добавится к этой карточке</span>
        </p>
      )}

      {showNoMergeNote && (
        <p className={styles.note}>
          <InfoIcon />
          <span>
            Донаты не объединяются: новый донат станет отдельной карточкой,{' '}
            {places.length > 1 ? 'а эти останутся на своих местах.' : 'а эта останется на своём месте.'}
          </span>
        </p>
      )}
    </>
  )
}

type ShowCardLinkProps = {
  cardId: number
  onShowCard: (cardId: number) => void
}

function ShowCardLink(props: ShowCardLinkProps) {
  const { cardId, onShowCard } = props

  return (
    <button className={styles.showCard} type="button" onClick={handleClick}>
      Показать на доске
    </button>
  )

  function handleClick() {
    onShowCard(cardId)
  }
}

// Сумма карточки, как её видит зритель: в валюте доната
function getAmount(card: PublicCard) {
  return card.amount === null ? '—' : formatMoney(card.amount, card.currency)
}
