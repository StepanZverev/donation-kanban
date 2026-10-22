import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { DONATION_RULES_MAX_LENGTH } from '../../defaults'
import { useIntakeSettings } from '../../hooks/useIntakeSettings'
import { ToggleField } from '../ToggleField/ToggleField'
import styles from './IntakeSettingsFields.module.css'

// Настройки «какие донаты становятся карточками» в разделе «Приём донатов»:
// принимать ли заказы, минимальная сумма, анонимные донаты, свои правила для зрителей.
// Отсеянные донаты не теряются: они сразу лежат в истории с пометкой «Отклонено» и причиной.
export function IntakeSettingsFields() {
  const { settings, error, changeIntake } = useIntakeSettings()
  // Что сейчас написано в поле суммы. null — поле не редактируют, показываем сохранённое.
  const [minAmountDraft, setMinAmountDraft] = useState<string | null>(null)
  // Что сейчас написано в поле правил. null — поле не трогали, показываем сохранённое.
  const [rulesDraft, setRulesDraft] = useState<string | null>(null)

  if (!settings) {
    return error ? <p className={styles.error}>{error}</p> : null
  }

  const rules = rulesDraft ?? settings.rules
  const isRulesChanged = rules.trim() !== settings.rules

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <ToggleField
        label="Принимать заказы"
        description="Если выключить, донаты всё равно приходят, но сразу попадают в историю как отклонённые с причиной «Приём был закрыт». Переключатель есть и в меню аккаунта (клик по своему нику в шапке)."
        checked={settings.isOpen}
        onChange={(isOpen) => changeIntake({ isOpen })}
      />

      {/* Сумма сохраняется, когда уходишь из поля или нажимаешь Enter */}
      <label className={styles.field}>
        <span className={styles.text}>
          <span className={styles.label}>Минимальная сумма для карточки</span>
          <span className={styles.description}>
            Донаты меньше этой суммы сразу попадают в историю как отклонённые. 0 — без минимума.
          </span>
        </span>

        <span className={styles.amount}>
          <input
            autoComplete="off"
            type="number"
            min={0}
            step={10}
            className={styles.amountInput}
            value={minAmountDraft ?? String(settings.minAmount)}
            onFocus={(event) => setMinAmountDraft(event.target.value)}
            onChange={(event) => setMinAmountDraft(event.target.value)}
            onBlur={handleMinAmountBlur}
            onKeyDown={handleMinAmountKeyDown}
          />
          <span className={styles.currency}>₽</span>
        </span>
      </label>

      <ToggleField
        label="Игнорировать анонимные донаты"
        description="Донаты без ника сразу попадают в историю как отклонённые."
        checked={settings.ignoreAnonymous}
        onChange={(ignoreAnonymous) => changeIntake({ ignoreAnonymous })}
      />

      <form className={styles.rules} onSubmit={handleRulesSubmit}>
        <label className={styles.text} htmlFor="donation-rules">
          <span className={styles.label}>Свои правила доната</span>
          <span className={styles.description}>
            Зрители увидят этот текст в блоке «Как заказать».
          </span>
        </label>
        <textarea
          id="donation-rules"
          className={styles.rulesInput}
          rows={3}
          maxLength={DONATION_RULES_MAX_LENGTH}
          placeholder="Например: на этой неделе ивент — заказываем только песни"
          value={rules}
          onChange={(event) => setRulesDraft(event.target.value)}
        />
        <div className={styles.rulesButtons}>
          <button className={styles.primaryButton} type="submit" disabled={!isRulesChanged}>
            Сохранить
          </button>
          {settings.rules && (
            <button type="button" onClick={handleRulesClear}>
              Очистить
            </button>
          )}
          <span className={styles.counter}>
            {rules.length} / {DONATION_RULES_MAX_LENGTH}
          </span>
        </div>
      </form>
    </>
  )

  function handleRulesSubmit(event: FormEvent) {
    event.preventDefault()
    changeIntake({ rules: rules.trim() })
    setRulesDraft(null)
  }

  function handleRulesClear() {
    changeIntake({ rules: '' })
    setRulesDraft(null)
  }

  function handleMinAmountBlur() {
    const minAmount = Number(minAmountDraft)
    setMinAmountDraft(null)
    // Пустое поле, минус или не число — просто возвращаем сохранённую сумму
    if (minAmountDraft === '' || !Number.isFinite(minAmount) || minAmount < 0) {
      return
    }
    if (minAmount !== settings?.minAmount) {
      changeIntake({ minAmount })
    }
  }

  function handleMinAmountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // blur сохранит сумму (handleMinAmountBlur)
      event.currentTarget.blur()
    }
  }
}
