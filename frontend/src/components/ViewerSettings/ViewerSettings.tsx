import { useState, type FormEvent } from 'react'
import { getPublicPageUrl } from '../../api/viewer'
import { useViewerSettings } from '../../hooks/useViewerSettings'
import { LinkSetting } from '../LinkSetting/LinkSetting'
import styles from './ViewerSettings.module.css'

// Раздел «Для зрителей» на странице настроек: ссылка, по которой зрители видят доску
// без входа, и ссылка на донат для кнопки «+» на их странице.
export function ViewerSettings() {
  const { settings, error, saveDonationUrl, createPublicLink, deletePublicLink } = useViewerSettings()
  // Что сейчас написано в поле ссылки на донат (поле видно, пока ссылка не добавлена)
  const [donationUrlDraft, setDonationUrlDraft] = useState('')

  if (!settings) {
    return error ? <p className={styles.error}>{error}</p> : null
  }

  const publicUrl = settings.publicToken ? getPublicPageUrl(settings.publicToken) : null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Для зрителей</h2>
      <p className={styles.hint}>
        Зрители смотрят твою доску по ссылке, без входа. Менять на ней ничего нельзя, только
        смотреть, и она обновляется сама.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <LinkSetting
        label="Ссылка для зрителей"
        url={publicUrl}
        description="Выложи её в описание канала или в чат. Новая ссылка заменит эту, и старая сразу перестанет работать."
        newLinkQuestion="Старая ссылка перестанет работать. Зрителям нужно будет дать новую."
        deleteQuestion="Зрители больше не смогут смотреть доску по этой ссылке."
        onCreate={createPublicLink}
        onDelete={deletePublicLink}
      />

      <div className={styles.field}>
        <span className={styles.label}>Ссылка на донат</span>
        <span className={styles.description}>
          Например, https://www.donationalerts.com/r/твой_ник. Тогда у зрителей появится кнопка «+
          Предложить задачу»: она откроет страницу доната, а донат сам станет карточкой. Кнопка
          видна, только пока подключён DonationAlerts.
        </span>

        {/* Ссылка сохранена — показываем её и «Удалить». Нет — поле и «Добавить» */}
        {settings.donationUrl ? (
          <div className={styles.buttons}>
            <a className={styles.savedLink} href={settings.donationUrl} target="_blank" rel="noreferrer">
              {settings.donationUrl}
            </a>
            <button type="button" onClick={handleDonationUrlDelete}>
              Удалить
            </button>
          </div>
        ) : (
          <form className={styles.buttons} onSubmit={handleDonationUrlSubmit}>
            <input
              aria-label="Ссылка на донат"
              className={styles.input}
              type="url"
              autoComplete="off"
              placeholder="https://www.donationalerts.com/r/…"
              value={donationUrlDraft}
              onChange={(event) => setDonationUrlDraft(event.target.value)}
            />
            <button type="submit" className={styles.primaryButton} disabled={donationUrlDraft.trim() === ''}>
              Добавить
            </button>
          </form>
        )}
      </div>
    </section>
  )

  async function handleDonationUrlSubmit(event: FormEvent<HTMLFormElement>) {
    // Без этого браузер перезагрузит страницу, отправляя форму
    event.preventDefault()
    const isSaved = await saveDonationUrl(donationUrlDraft.trim())
    // Не сохранилось — оставляем в поле то, что ввели, чтобы можно было исправить
    if (isSaved) {
      setDonationUrlDraft('')
    }
  }

  // Пустая ссылка на бэкенде значит «ссылки нет»: кнопка «+» у зрителей пропадёт
  function handleDonationUrlDelete() {
    saveDonationUrl('')
  }
}
