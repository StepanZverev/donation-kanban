import { useState, type CSSProperties } from 'react'
import { getErrorDetail } from '../../api/request'
import { NEW_LEVEL_COLOR, PRIORITY_LEVEL_NAME_MAX_LENGTH, STREAMER_CURRENCY } from '../../defaults'
import { usePriorityLevels } from '../../hooks/usePriorityLevels'
import { formatMoney } from '../../utils/money'
import type { PriorityLevel } from '../../utils/priority'
import { TrashIcon } from '../Icons/Icons'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './PriorityLevelsSettings.module.css'

// Раздел «Уровни приоритета» на странице настроек.
export function PriorityLevelsSettings() {
  const { levels, saveLevels } = usePriorityLevels()

  return (
    <SettingsSection
      title="Уровни приоритета"
      hint="Цвет полоски и суммы на карточке зависит от суммы доната. Уровень действует от своей суммы до суммы следующего уровня. Первый уровень всегда начинается с 0."
    >

      {/* key: когда уровни на сервере поменялись (сохранили здесь или в другой вкладке),
          редактор создаётся заново и показывает свежие уровни */}
      <PriorityLevelsEditor key={JSON.stringify(levels)} levels={levels} onSave={saveLevels} />
    </SettingsSection>
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
      {/* Один уровень — одна строка, как список колонок на телефоне:
          цвет, название, с какой суммы и образец карточки этого уровня */}
      <ol className={styles.list}>
        {draft.map((level, index) => (
          <li
            key={index}
            className={styles.row}
            // CSS-переменная с цветом уровня, её использует образец карточки
            style={{ '--level-color': level.color } as CSSProperties}
          >
            {/* Квадратик цвета. Поверх него лежит прозрачный выбор цвета браузера:
                по клику открывается палитра, можно выбрать любой цвет */}
            <label className={styles.colorSwatch} title="Цвет уровня">
              <input
                type="color"
                className={styles.colorInput}
                value={level.color}
                onChange={(event) => handleChange(index, { color: event.target.value })}
                aria-label="Цвет уровня"
              />
            </label>

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

            {/* Первый уровень всегда с 0, его сумму не меняем */}
            {index === 0 ? (
              <span className={styles.zero}>от {formatMoney(0, STREAMER_CURRENCY)}</span>
            ) : (
              // «₽» стоит внутри рамки поля, справа от числа
              <label className={styles.amountBox}>
                <input
                  autoComplete="off"
                  type="number"
                  className={styles.amountInput}
                  min={1}
                  value={level.minAmount}
                  onChange={(event) => handleChange(index, { minAmount: Number(event.target.value) })}
                  aria-label="С какой суммы"
                />
                ₽
              </label>
            )}

            {/* Образец: так выглядит карточка этого уровня на доске */}
            <div className={styles.sample} aria-hidden="true">
              <span className={styles.sampleName}>Донатер</span>
              <span className={styles.sampleAmount}>{formatMoney(level.minAmount, STREAMER_CURRENCY)}</span>
            </div>

            {/* Первый уровень удалить нельзя: вместо корзины пустое место того же размера */}
            {index === 0 ? (
              <span className={styles.iconPlaceholder} />
            ) : (
              <button
                type="button"
                className={styles.iconButton}
                title="Удалить уровень"
                aria-label="Удалить уровень"
                onClick={() => handleRemove(index)}
              >
                <TrashIcon />
              </button>
            )}
          </li>
        ))}

        <li>
          <button type="button" className={styles.addButton} onClick={handleAdd}>
            + Добавить уровень
          </button>
        </li>
      </ol>

      {error && <p className="error-message">{error}</p>}

      <div className={styles.footer}>
        <button type="button" className="primary-button" disabled={!isChanged || isSaving} onClick={handleSave}>
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
      // Бэкенд обычно объясняет, что не так: например, нет уровня от 0
      setError(`Не удалось сохранить: ${getErrorDetail(saveError) ?? 'проверь суммы, названия и цвета'}`)
      setIsSaving(false)
    }
  }
}

// Ставит курсор в поле и выделяет весь текст. React вызывает её, когда поле появилось на странице.
function selectText(input: HTMLInputElement | null) {
  input?.select()
}
