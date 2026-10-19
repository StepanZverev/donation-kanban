import type { PublicBoard } from '../../api/viewer'
import { useRulesCollapsed } from '../../hooks/useRulesCollapsed'
import { formatMoney } from '../../utils/money'
import { ChevronDownIcon, InfoIcon } from '../Icons/Icons'
import styles from './OrderRules.module.css'

type OrderRulesProps = {
  board: PublicBoard
}

// Блок «Как заказать» на странице зрителя. Пункты собираются из настроек приёма стримера:
// минимальная сумма, анонимы, слияние донатов, свои правила стримера, уровни приоритета.
// Зритель может свернуть блок в одну строку, выбор запоминается (см. useRulesCollapsed).
export function OrderRules(props: OrderRulesProps) {
  const { board } = props
  const { isCollapsed, toggleCollapsed } = useRulesCollapsed()
  const minAmount = board.minAmount > 0 ? formatMoney(board.minAmount, null) : null
  // Самый нижний уровень (от 0) не показываем: «чем больше донат» начинается со следующего
  const levels = board.priorityLevels.filter((level) => level.minAmount > 0)
  // Короткая сводка для свёрнутого блока
  const summary = minAmount
    ? `Донат от ${minAmount}, задача в сообщении к донату`
    : 'Задача в сообщении к донату'

  return (
    <section className={`${styles.rules} ${isCollapsed ? styles.collapsed : ''}`}>
      <button className={styles.toggle} type="button" onClick={handleToggleClick} aria-expanded={!isCollapsed}>
        <span className={styles.title}>Как заказать</span>
        {isCollapsed && <span className={styles.summary}>{summary}</span>}
        <span className={styles.toggleAction}>
          <span className={styles.toggleText}>{isCollapsed ? 'Показать' : 'Свернуть'}</span>
          <ChevronDownIcon />
        </span>
      </button>

      {!isCollapsed && (
        <>
          {/* Без ссылки на донат кнопки нет — объясняем, куда донатить */}
          {!board.donationUrl && (
            <p className={styles.noLink}>
              <InfoIcon />
              <span>
                Заказы делаются донатом через <b>DonationAlerts</b>. Стример ещё не добавил ссылку на свою
                страницу доната, поэтому кнопки пока нет.
              </span>
            </p>
          )}

          <ul className={styles.list}>
            {minAmount && (
              <li>
                <span className={styles.icon}>₽</span> Донат <b>от {minAmount}</b>
              </li>
            )}
            <li>
              <span className={styles.icon}>✎</span> Задачу пиши <b>в сообщении к донату</b>
            </li>
            {board.ignoreAnonymous && (
              <li>
                <span className={styles.icon}>@</span> Укажи ник: <b>анонимные не попадают</b> на доску
              </li>
            )}
            {board.autoMerge && (
              <li>
                <span className={`${styles.icon} ${styles.plus}`}>+</span> Несколько донатов от тебя{' '}
                <b>складываются в одну карточку</b>
              </li>
            )}
          </ul>

          {/* Правила, которые стример написал сам (например, на ивент) */}
          {board.rules && (
            <div className={styles.ownRules}>
              <span className={styles.ownRulesTitle}>От стримера</span>
              <p className={styles.ownRulesText}>{board.rules}</p>
            </div>
          )}

          {levels.length > 0 && (
            <div className={styles.levels}>
              Чем больше донат, тем заметнее карточка:
              {levels.map((level) => (
                <span key={level.minAmount} className={styles.level}>
                  <i className={styles.levelColor} style={{ backgroundColor: level.color }} />
                  от {formatMoney(level.minAmount, null)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )

  function handleToggleClick() {
    toggleCollapsed()
  }
}
