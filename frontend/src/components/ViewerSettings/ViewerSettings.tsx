import { useState, type FormEvent } from 'react'
import { getPublicPageUrl } from '../../api/viewer'
import { useViewerSettings } from '../../hooks/useViewerSettings'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import styles from './ViewerSettings.module.css'

// Раздел «Для зрителей» на странице настроек: ссылка, по которой зрители видят доску
// без входа, и ссылка на донат для кнопки «+» на их странице.
export function ViewerSettings() {
  const { settings, error, saveDonationUrl, createPublicLink, deletePublicLink } = useViewerSettings()
  // Что сейчас написано в поле ссылки на донат. null — поле не меняли, показываем сохранённое.
  const [donationUrlDraft, setDonationUrlDraft] = useState<string | null>(null)
  // Только что скопировали ссылку — на пару секунд пишем на кнопке «Скопировано»
  const [isCopied, setIsCopied] = useState(false)

  if (!settings) {
    return error ? <p className={styles.error}>{error}</p> : null
  }

  const publicUrl = settings.publicToken ? getPublicPageUrl(settings.publicToken) : null
  const donationUrl = donationUrlDraft ?? settings.donationUrl

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Для зрителей</h2>
      <p className={styles.hint}>
        Зрители смотрят твою доску по ссылке, без входа. Менять на ней ничего нельзя, только
        смотреть, и она обновляется сама.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.field}>
        <span className={styles.label}>Ссылка для зрителей</span>
        {publicUrl ? (
          <>
            <span className={styles.description}>
              Выложи её в описание канала или в чат. Новая ссылка заменит эту, и старая сразу
              перестанет работать.
            </span>
            <input className={styles.input} value={publicUrl} readOnly onFocus={handleUrlFocus} />
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryButton} onClick={handleCopyClick}>
                {isCopied ? 'Скопировано' : 'Скопировать'}
              </button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                Открыть
              </a>
              <span className={styles.spacer} />
              <ConfirmButton
                title="Сделать новую ссылку"
                question="Старая ссылка перестанет работать. Зрителям нужно будет дать новую."
                confirmLabel="Сделать новую"
                onConfirm={createPublicLink}
              >
                Новая ссылка
              </ConfirmButton>
              <ConfirmButton
                title="Выключить ссылку"
                question="Зрители больше не смогут смотреть доску по этой ссылке."
                confirmLabel="Выключить"
                onConfirm={deletePublicLink}
              >
                Выключить
              </ConfirmButton>
            </div>
          </>
        ) : (
          <>
            <span className={styles.description}>Сейчас выключена: доску видишь только ты.</span>
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryButton} onClick={createPublicLink}>
                Включить
              </button>
            </div>
          </>
        )}
      </div>

      <form className={styles.field} onSubmit={handleDonationUrlSubmit}>
        <label className={styles.label} htmlFor="donation-url">
          Ссылка на донат
        </label>
        <span className={styles.description}>
          Например, https://www.donationalerts.com/r/твой_ник. Тогда у зрителей появится кнопка «+
          Предложить задачу»: она откроет страницу доната, а донат сам станет карточкой. Оставь
          поле пустым, и кнопки не будет.
        </span>
        <div className={styles.buttons}>
          <input
            id="donation-url"
            className={styles.input}
            type="url"
            autoComplete="off"
            placeholder="https://www.donationalerts.com/r/…"
            value={donationUrl}
            onChange={(event) => setDonationUrlDraft(event.target.value)}
          />
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={donationUrlDraft === null || donationUrlDraft === settings.donationUrl}
          >
            Сохранить
          </button>
        </div>
      </form>
    </section>
  )

  // Клик по полю со ссылкой выделяет её целиком — удобно скопировать вручную
  function handleUrlFocus(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.select()
  }

  async function handleCopyClick() {
    if (!publicUrl) {
      return
    }
    await navigator.clipboard.writeText(publicUrl)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 2000)
  }

  async function handleDonationUrlSubmit(event: FormEvent<HTMLFormElement>) {
    // Без этого браузер перезагрузит страницу, отправляя форму
    event.preventDefault()
    if (donationUrlDraft === null) {
      return
    }
    const isSaved = await saveDonationUrl(donationUrlDraft.trim())
    // Не сохранилось — оставляем в поле то, что ввели, чтобы можно было исправить
    if (isSaved) {
      setDonationUrlDraft(null)
    }
  }
}
