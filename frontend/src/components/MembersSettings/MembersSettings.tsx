import { useState } from 'react'
import { getInvitePageUrl, type BoardMember } from '../../api/boards'
import { useMembers } from '../../hooks/useMembers'
import { ConfirmButton } from '../ConfirmButton/ConfirmButton'
import styles from './MembersSettings.module.css'

// Раздел «Модераторы» на странице настроек: ссылка-приглашение и список тех,
// кто помогает вести доску. Модераторы двигают, правят и убирают карточки,
// а настройки, колонки и сброс доски остаются только у хозяина.
export function MembersSettings() {
  const { members, inviteToken, isLoading, error, createInviteLink, deleteInviteLink, removeMember } =
    useMembers()
  // Только что скопировали ссылку — на пару секунд пишем на кнопке «Скопировано»
  const [isCopied, setIsCopied] = useState(false)

  if (isLoading) {
    return null
  }

  const inviteUrl = inviteToken ? getInvitePageUrl(inviteToken) : null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Модераторы</h2>
      <p className={styles.hint}>
        Модераторы помогают вести доску: двигают, правят и убирают карточки. Настройки, колонки и
        сброс доски остаются только у тебя.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.field}>
        <span className={styles.label}>Ссылка-приглашение</span>
        {inviteUrl ? (
          <>
            <span className={styles.description}>
              Отправь её модератору лично: любой, кто откроет ссылку, сможет стать модератором.
              Новая ссылка заменит эту, а уже принятые приглашения останутся.
            </span>
            <input className={styles.input} value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryButton} onClick={handleCopyClick}>
                {isCopied ? 'Скопировано' : 'Скопировать'}
              </button>
              <span className={styles.spacer} />
              <ConfirmButton
                title="Сделать новую ссылку"
                question="Старая ссылка перестанет работать. Те, кто уже стал модератором, останутся."
                confirmLabel="Сделать новую"
                onConfirm={createInviteLink}
              >
                Новая ссылка
              </ConfirmButton>
              <ConfirmButton
                title="Удалить ссылку"
                question="Ссылка перестанет работать, и все модераторы потеряют доступ к доске."
                confirmLabel="Удалить"
                onConfirm={deleteInviteLink}
              >
                Удалить
              </ConfirmButton>
            </div>
          </>
        ) : (
          <>
            <span className={styles.description}>Ссылки нет: позвать модератора нельзя.</span>
            <div className={styles.buttons}>
              <button type="button" className={styles.primaryButton} onClick={createInviteLink}>
                Сделать ссылку
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Кто модератор</span>
        {members.length === 0 && <span className={styles.description}>Пока никого.</span>}
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
      </div>
    </section>
  )

  async function handleCopyClick() {
    if (!inviteUrl) {
      return
    }
    await navigator.clipboard.writeText(inviteUrl)
    setIsCopied(true)
    window.setTimeout(() => setIsCopied(false), 2000)
  }
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
