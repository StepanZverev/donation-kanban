import { useDeleteAccount } from '../../hooks/useDeleteAccount'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import { SettingField } from '../SettingField/SettingField'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './AccountSettings.module.css'

// Раздел «Аккаунт» на странице настроек: политика конфиденциальности и удаление всех данных
export function AccountSettings() {
  const { removeAccount, error } = useDeleteAccount()

  return (
    <SettingsSection title="Аккаунт">
      <SettingField
        layout="row"
        label="Удалить аккаунт и все данные"
        description={
          <>
            Насовсем удалятся доска, карточки и история, подключение DonationAlerts, модераторы и твоё модераторство
            на чужих досках. Вернуть ничего не получится. Как мы храним данные — в{' '}
            <a className={styles.link} href="/privacy.html" target="_blank" rel="noreferrer">
              политике конфиденциальности
            </a>
            .{error && <span className={styles.error}> {error}</span>}
          </>
        }
      >
        <ConfirmButton
          className={styles.button}
          title="Удалить аккаунт"
          question="Удалить аккаунт, доску и всю историю насовсем?"
          confirmLabel="Удалить всё"
          onConfirm={removeAccount}
        >
          Удалить аккаунт
        </ConfirmButton>
      </SettingField>
    </SettingsSection>
  )
}
