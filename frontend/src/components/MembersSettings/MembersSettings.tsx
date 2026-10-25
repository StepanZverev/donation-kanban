import { getInvitePageUrl, type BoardMember } from '../../api/boards'
import { useMembers } from '../../hooks/useMembers'
import { LinkSetting } from '../LinkSetting/LinkSetting'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import { SettingField } from '../SettingField/SettingField'
import { SettingsSection } from '../SettingsSection/SettingsSection'
import styles from './MembersSettings.module.css'

// Раздел «Модераторы» на странице настроек: ссылка-приглашение и список тех,
// кто помогает вести доску. Модераторы двигают, правят и убирают карточки,
// а настройки, колонки и сброс доски остаются только у хозяина.
export function MembersSettings() {
  const { members, inviteToken, isLoading, error, createInviteLink, deleteInviteLink, removeMember } =
    useMembers()

  if (isLoading) {
    return null
  }

  const inviteUrl = inviteToken ? getInvitePageUrl(inviteToken) : null

  return (
    <SettingsSection
      title="Модераторы"
      hint="Модераторы помогают вести доску: двигают, правят и убирают карточки. Настройки, колонки и сброс доски остаются только у тебя."
      error={error}
    >
      <LinkSetting
        label="Ссылка-приглашение"
        url={inviteUrl}
        description="Отправь её модератору лично: любой, кто откроет ссылку, сможет стать модератором."
        isSecret
        newLinkQuestion="Старая ссылка перестанет работать. Те, кто уже стал модератором, останутся."
        deleteQuestion="Ссылка перестанет работать, и все модераторы потеряют доступ к доске."
        onCreate={createInviteLink}
        onDelete={deleteInviteLink}
      />

      {/* Список появляется, когда по ссылке пришёл первый модератор */}
      {members.length > 0 && (
        <SettingField layout="column" label="Модераторы">
          {members.map((member) => (
            <div key={member.userId} className={styles.member}>
              <span className={styles.memberName}>
                {getMemberTitle(member)}
                <span className={styles.memberNote}> · {getMemberNote(member)}</span>
              </span>
              <ConfirmButton
                title="Убрать модератора"
                question="Доска пропадёт у него из списка. Позвать обратно можно новой ссылкой."
                confirmLabel="Убрать"
                onConfirm={() => removeMember(member.userId)}
              >
                Убрать
              </ConfirmButton>
            </div>
          ))}
        </SettingField>
      )}
    </SettingsSection>
  )
}

// Как показать модератора в списке: как он представился, иначе имя из DonationAlerts, иначе «Гость»
function getMemberTitle(member: BoardMember) {
  return member.nickname ?? member.name ?? 'Гость'
}

// Подпись после имени: вошёл ли он через DonationAlerts и под каким именем
function getMemberNote(member: BoardMember) {
  if (member.isGuest) {
    return 'без входа через DonationAlerts'
  }
  if (member.nickname && member.name && member.nickname !== member.name) {
    return `в DonationAlerts — ${member.name}`
  }
  return 'вошёл через DonationAlerts'
}
