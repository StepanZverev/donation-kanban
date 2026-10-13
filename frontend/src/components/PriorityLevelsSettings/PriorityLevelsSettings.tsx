import { useState } from 'react'
import { usePriorityLevels } from '../../hooks/usePriorityLevels'
import { formatMoney } from '../../utils/money'
import type { PriorityLevel } from '../../utils/priority'
import { TrashIcon } from '../Icons/Icons'
import styles from './PriorityLevelsSettings.module.css'

// Цвет нового уровня, пока стример не выбрал свой
const NEW_LEVEL_COLOR = '#8250df'

// Раздел «Уровни приоритета» на странице настроек.
export function PriorityLevelsSettings() {
  const { levels, saveLevels } = usePriorityLevels()

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Уровни приоритета</h2>
      <p className={styles.hint}>
        Цвет обводки карточки зависит от суммы доната. Уровень действует от своей суммы до суммы
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

// Таблица уровней. Правки копятся в черновике и уходят на сервер кнопкой «Сохранить».
function PriorityLevelsEditor(props: PriorityLevelsEditorProps) {
  const { levels, onSave } = props
  const [draft, setDraft] = useState(levels)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Есть ли несохранённые правки
  const isChanged = JSON.stringify(draft) !== JSON.stringify(levels)

  return (
    <>
      <div className={styles.table}>
        <div className={styles.headerRow}>
          <span>Цвет</span>
          <span>От суммы</span>
          <span>Название</span>
          <span>Как выглядит</span>
          <span />
        </div>

        {draft.map((level, index) => (
          <div key={index} className={styles.row}>
            <input
              type="color"
              className={styles.colorInput}
              value={level.color}
              onChange={(event) => handleChange(index, { color: event.target.value })}
              aria-label="Цвет уровня"
            />

            {/* Первый уровень всегда с 0, его сумму не меняем */}
            {index === 0 ? (
              <span className={styles.zero}>0</span>
            ) : (
              <input
                type="number"
                className={styles.input}
                min={1}
                value={level.minAmount}
                onChange={(event) => handleChange(index, { minAmount: Number(event.target.value) })}
                aria-label="От суммы"
              />
            )}

            <input
              className={styles.input}
              value={level.name}
              maxLength={30}
              onChange={(event) => handleChange(index, { name: event.target.value })}
              aria-label="Название уровня"
            />

            {/* Пример: так будет выглядеть сумма на карточке этого уровня */}
            <span className={styles.preview} style={{ backgroundColor: level.color }}>
              {formatMoney(level.minAmount, 'RUB')}
            </span>

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
