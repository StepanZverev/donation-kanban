import { useState, type CSSProperties } from 'react'
import { NEW_LEVEL_COLOR, PRIORITY_LEVEL_NAME_MAX_LENGTH, STREAMER_CURRENCY } from '../../defaults'
import { usePriorityLevels } from '../../hooks/usePriorityLevels'
import { formatMoney } from '../../utils/money'
import type { PriorityLevel } from '../../utils/priority'
import { TrashIcon } from '../Icons/Icons'
import styles from './PriorityLevelsSettings.module.css'

// Раздел «Уровни приоритета» на странице настроек.
export function PriorityLevelsSettings() {
  const { levels, saveLevels } = usePriorityLevels()

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Уровни приоритета</h2>
      <p className={styles.hint}>
        Цвет полоски и суммы на карточке зависит от суммы доната. Уровень действует от своей суммы до суммы
        следующего уровня. Первый уровень всегда начинается с 0.
      </p>

      {/* key: когда уровни на сервере поменялись (сохранили здесь или в другой вкладке),
          редактор создаётся заново и показывает свежие уровни */}
      <PriorityLevelsEditor key={JSON.stringify(levels)} levels={levels} onSave={saveLevels} />
    </section>
  )
}

type PriorityLevelsEditorProps = {
  levels: PriorityLevel[]
  onSave: (levels: PriorityLevel[]) => Promise<void>
}

// Список уровней. Правки копятся в черновике и уходят на сервер кнопкой «Сохранить».
function PriorityLevelsEditor(props: PriorityLevelsEditorProps) {
  const { levels, onSave } = props
  const [draft, setDraft] = useState(levels)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Номер только что добавленного уровня: в его название сразу ставим курсор
  const [newLevelIndex, setNewLevelIndex] = useState<number | null>(null)

  // Есть ли несохранённые правки
  const isChanged = JSON.stringify(draft) !== JSON.stringify(levels)

  return (
    <>
      {/* Каждый уровень нарисован как карточка доната этого уровня:
          полоска слева и сумма его цветом. Так сразу видно, как будет выглядеть доска. */}
      <div className={styles.list}>
        {draft.map((level, index) => (
          <div
            key={index}
            className={styles.card}
            // CSS-переменная с цветом уровня, её используют .card и .amount
            style={{ '--level-color': level.color } as CSSProperties}
          >
            <div className={styles.top}>
              {/* autoComplete="off" во всех полях приложения: иначе Chrome принимает их
                  за адрес или номер машины и предлагает «сохранить данные» */}
              <input
                autoComplete="off"
                // У нового уровня выделяем название целиком: можно сразу печатать своё
                ref={index === newLevelIndex ? selectText : undefined}
                className={styles.nameInput}
                value={level.name}
                maxLength={PRIORITY_LEVEL_NAME_MAX_LENGTH}
                onChange={(event) => handleChange(index, { name: event.target.value })}
                aria-label="Название уровня"
              />
              {/* Пример: так будет выглядеть сумма на карточке этого уровня */}
              <span className={styles.amount}>{formatMoney(level.minAmount, STREAMER_CURRENCY)}</span>
            </div>

            <div className={styles.bottom}>
              {/* Встроенный в браузер выбор цвета: по клику открывается палитра */}
              <label className={styles.field}>
                Цвет
                <input
                  type="color"
                  className={styles.colorInput}
                  value={level.color}
                  onChange={(event) => handleChange(index, { color: event.target.value })}
                />
              </label>

              <label className={styles.field}>
                От суммы
                {/* Первый уровень всегда с 0, его сумму не меняем */}
                {index === 0 ? (
                  <span className={styles.zero}>0 ₽, всегда</span>
                ) : (
                  <input
                    autoComplete="off"
                    type="number"
                    className={styles.amountInput}
                    min={1}
                    value={level.minAmount}
                    onChange={(event) => handleChange(index, { minAmount: Number(event.target.value) })}
                  />
                )}
              </label>

              <button
                type="button"
                className={styles.iconButton}
                title={index === 0 ? 'Первый уровень удалить нельзя' : 'Удалить уровень'}
                aria-label="Удалить уровень"
                disabled={index === 0}
                onClick={() => handleRemove(index)}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.addButton} onClick={handleAdd}>
        + Добавить уровень
      </button>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.footer}>
        <button type="button" className={styles.saveButton} disabled={!isChanged || isSaving} onClick={handleSave}>
          {isSaving ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <button type="button" disabled={!isChanged || isSaving} onClick={handleReset}>
          Отменить правки
        </button>
      </div>
    </>
  )

  // Меняет одно поле у одного уровня в черновике
  function handleChange(index: number, changes: Partial<PriorityLevel>) {
    setDraft(draft.map((level, levelIndex) => (levelIndex === index ? { ...level, ...changes } : level)))
  }

  function handleRemove(index: number) {
    setDraft(draft.filter((_, levelIndex) => levelIndex !== index))
  }

  // Новый уровень на 100 больше самого большого
  function handleAdd() {
    const biggestAmount = Math.max(...draft.map((level) => level.minAmount))
    setDraft([...draft, { minAmount: biggestAmount + 100, name: 'Новый уровень', color: NEW_LEVEL_COLOR }])
    setNewLevelIndex(draft.length)
  }

  function handleReset() {
    setDraft(levels)
    setError(null)
  }

  // После удачного сохранения уровни на сервере поменяются, и редактор создастся заново
  // (см. key выше), поэтому здесь сбрасывать ничего не нужно.
  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить')
      setIsSaving(false)
    }
  }
}

// Ставит курсор в поле и выделяет весь текст. React вызывает её, когда поле появилось на странице.
function selectText(input: HTMLInputElement | null) {
  input?.select()
}
