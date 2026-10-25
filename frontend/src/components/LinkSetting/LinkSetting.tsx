import { useState } from 'react'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from '../Icons/Icons'
import { SettingField } from '../SettingField/SettingField'
import styles from './LinkSetting.module.css'

type LinkSettingProps = {
  // Название блока, например «Ссылка для зрителей»
  label: string
  // Сама ссылка. null — ссылки нет, видна одна кнопка «Сделать ссылку»
  url: string | null
  // Пояснение под названием
  description: string
  // Секретная ссылка (например, приглашение модератора) по умолчанию скрыта,
  // чтобы стример случайно не показал её на стриме. Скопировать можно и не показывая.
  isSecret?: boolean
  // Что написать в окошках подтверждения «Новая ссылка» и «Удалить»
  newLinkQuestion: string
  deleteQuestion: string
  onCreate: () => void
  onDelete: () => void
}

// Блок настройки со ссылкой: поле со ссылкой (справа в нём иконки «Показать» и «Скопировать»),
// под ним «Новая ссылка» и «Удалить».
// Одинаково выглядит у ссылки для зрителей и у приглашения модератора.
export function LinkSetting({
  label,
  url,
  description,
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
      <div className={styles.empty}>
        <button type="button" className="primary-button" onClick={onCreate}>
          Сделать ссылку
        </button>
      </div>
    )
  }

  const isHidden = isSecret && !isShown

  return (
    <SettingField layout="column" label={label} description={description}>
      {/* Поле и иконки внутри одной рамки: рамку рисует .inputBox, у самого поля её нет */}
      <div className={styles.inputBox}>
        <input
          className={styles.input}
          value={isHidden ? hideSecretPart(url) : url}
          readOnly
          onFocus={(event) => !isHidden && event.currentTarget.select()}
        />
        {isSecret && (
          <button
            type="button"
            className={styles.iconButton}
            title={isShown ? 'Скрыть ссылку' : 'Показать ссылку'}
            aria-label={isShown ? 'Скрыть ссылку' : 'Показать ссылку'}
            onClick={handleShowClick}
          >
            {isShown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          title={isCopied ? 'Скопировано' : 'Скопировать ссылку'}
          aria-label={isCopied ? 'Скопировано' : 'Скопировать ссылку'}
          onClick={handleCopyClick}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      <div className={styles.buttons}>
        <span className={styles.spacer} />
        <ConfirmButton
          title="Сделать новую ссылку"
          question={newLinkQuestion}
          confirmLabel="Сделать новую"
          onConfirm={onCreate}
        >
          Новая ссылка
        </ConfirmButton>
        <ConfirmButton
          title="Удалить ссылку"
          question={deleteQuestion}
          confirmLabel="Удалить"
          onConfirm={onDelete}
        >
          Удалить
        </ConfirmButton>
      </div>
    </SettingField>
  )

  function handleShowClick() {
    setIsShown(!isShown)
  }

  async function handleCopyClick() {
    if (!url) {
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setIsCopied(true)
      window.setTimeout(() => setIsCopied(false), 2000)
    } catch {
      // Браузер не дал скопировать (так бывает на сайте без https) — показываем ссылку,
      // чтобы её можно было выделить и скопировать руками
      setIsShown(true)
    }
  }
}

// Прячет секретную часть ссылки (всё после последнего «/»): начало адреса не секрет
function hideSecretPart(url: string) {
  return url.replace(/[^/]+$/, '•'.repeat(16))
}
