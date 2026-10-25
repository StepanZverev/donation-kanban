import { STREAMER_CURRENCY } from '../../defaults'
import { useStreamTotal } from '../../hooks/useStreamTotal'
import { formatMoney } from '../../utils/money'
import { pluralize } from '../../utils/time'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import { SettingField } from '../SettingField/SettingField'
import styles from './ResetBoardSettings.module.css'

// «Сбросить доску» в разделе «Приём донатов»: конец стрима, начинаем с чистого листа.
// Сумма за стрим обнуляется, все карточки уходят в историю.
export function ResetBoardSettings() {
  const { streamTotal, resetBoard } = useStreamTotal()

  if (!streamTotal) {
    return null
  }

  const { total, boardCardCount } = streamTotal
  const cardsWord = pluralize(boardCardCount, ['карточка', 'карточки', 'карточек'])

  return (
    <SettingField
      layout="row"
      label="Сбросить доску"
      description={
        <>
          Сумма за стрим ({formatMoney(total, STREAMER_CURRENCY)}) обнулится, а все карточки уйдут с доски в
          историю: из «Выполнено» — как выполненные, остальные — как удалённые. Сейчас на доске{' '}
          {boardCardCount} {cardsWord}.
        </>
      }
    >
      <ConfirmButton
        className={styles.button}
        title="Сбросить доску"
        question={
          boardCardCount > 0
            ? `Сумма обнулится, а ${boardCardCount} ${cardsWord} ${pluralize(boardCardCount, ['уйдёт', 'уйдут', 'уйдут'])} с доски в историю.`
            : 'Сумма за стрим обнулится.'
        }
        confirmLabel="Сбросить"
        onConfirm={resetBoard}
      >
        Сбросить
      </ConfirmButton>
    </SettingField>
  )
}
