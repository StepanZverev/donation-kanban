import { useState } from 'react'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import styles from './LinkSetting.module.css'

type LinkSettingProps = {
  // Название блока, например «Ссылка для зрителей»
  label: string
  // Сама ссылка. null — ссылки нет, показываем кнопку «Сделать ссылку»
  url: string | null
  // Пояснение под названием, когда ссылка есть и когда её нет
  description: string
  emptyDescription: string
  // Секретная ссылка (например, приглашение модератора) по умолчанию скрыта,
  // чтобы стример случайно не показал её на стриме. Скопировать можно и не показывая.
  isSecret?: boolean
  // Что написать в окошках подтверждения «Новая ссылка» и «Удалить»
  newLinkQuestion: string
  deleteQuestion: string
  onCreate: () => void
  onDelete: () => void
}

// Блок настройки со ссылкой: поле со ссылкой, «Скопировать», «Новая ссылка» и «Удалить».
// Одинаково выглядит у ссылки для зрителей и у приглашения модератора.
export function LinkSetting({
  label,
  url,
  description,
  emptyDescription,
  isSecret = false,
  newLinkQuestion,
  deleteQuestion,
  onCreate,
  onDelete,
}: LinkSettingProps) {
  // Только что скопировали ссылку — на пару секунд пишем на кнопке «Скопировано»
  const [isCopied, setIsCopied] = useState(false)
  // Показана ли секретная ссылка. Обычные ссылки видны всегда.
  const [isShown, setIsShown] = useState(false)

  if (url === null) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>{label}</span>
        <span className={styles.description}>{emptyDescription}</span>
        <div className={styles.buttons}>
          <button type="button" className={styles.primaryButton} onClick={onCreate}>
            Сделать ссылку
          </button>
        </div>
      </div>
    )
  }

  const isHidden = isSecret && !isShown

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.description}>{description}</span>
      <input
        className={styles.input}
        value={isHidden ? hideSecretPart(url) : url}
        readOnly
        onFocus={(event) => !isHidden && event.currentTarget.select()}
      />
      <div className={styles.buttons}>
        <button type="button" className={styles.primaryButton} onClick={handleCopyClick}>
          {isCopied ? 'Скопировано' : 'Скопировать'}
        </button>
        {isSecret && (
          <button type="button" onClick={handleShowClick}>
            {isShown ? 'Скрыть' : 'Показать'}
          </button>
        )}
        <span className={styles.spacer} />
        <ConfirmButton
          title="Сделать новую ссылку"
          question={newLinkQuestion}
          confirmLabel="Сделать новую"
          onConfirm={onCreate}
        >
          Новая ссылка
        </ConfirmButton>
        <ConfirmButton title="Удалить ссылку" question={deleteQuestion} confirmLabel="Удалить" onConfirm={onDelete}>
          Удалить
        </ConfirmButton>
      </div>
    </div>
  )

  function handleShowClick() {
    setIsShown(!isShown)
  }

  async function handleCopyClick() {
    if (!url) {
      return
    }
    await navigator.clipboard.writeText(url)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 2000)
  }
}

// Прячет секретную часть ссылки (всё после последнего «/»): начало адреса не секрет
function hideSecretPart(url: string) {
  return url.replace(/[^/]+$/, '•'.repeat(16))
}
