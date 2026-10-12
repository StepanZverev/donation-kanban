import { useState } from 'react'
import { sendFakeDonation } from '../../api/dev'
import { useCards } from '../../hooks/useCards'
import type { Card, CardDraft } from '../../types/card'
import { CardFormDialog } from '../../components/CardFormDialog/CardFormDialog'
import { DonationAlertsStatus } from '../../components/DonationAlertsStatus/DonationAlertsStatus'
import { Column } from '../../components/Column/Column'
import { UndoToast } from '../../components/UndoToast/UndoToast'
import styles from './BoardPage.module.css'

// Какую форму сейчас показываем: создание в колонке, редактирование карточки или никакую.
type FormState =
  | { mode: 'create'; columnId: number }
  | { mode: 'edit'; card: Card }
  | null

export function BoardPage() {
  const {
    isLoading,
    error,
    columns,
    getColumnCards,
    addCard,
    editCard,
    moveCard,
    startCard,
    completeCard,
    removeCard,
    clearDone,
    lastAction,
    undoLastAction,
    forgetLastAction,
  } = useCards()
  const [form, setForm] = useState<FormState>(null)

  if (isLoading) {
    return <p>Загружаю карточки…</p>
  }

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <DonationAlertsStatus />
        {/* Карточка появится сама: бэкенд пришлёт обновление через WebSocket */}
        <button type="button" onClick={handleFakeDonationClick}>
          + Тестовый донат
        </button>
      </div>

      <div className={styles.board}>
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={getColumnCards(column.id)}
            onAddClick={() => handleAddClick(column.id)}
            onEditCard={handleEditCard}
            onStartCard={startCard}
            onCompleteCard={completeCard}
            onRemoveCard={removeCard}
            onDropCard={moveCard}
            onClearClick={clearDone}
          />
        ))}
      </div>

      {lastAction && (
        <UndoToast
          // key: новое действие — новая плашка, и её таймер начинается заново
          key={lastAction.cardIds.join(',')}
          message={lastAction.message}
          onUndo={undoLastAction}
          onClose={forgetLastAction}
        />
      )}

      {form && (
        <CardFormDialog
          heading={form.mode === 'create' ? 'Новая карточка' : 'Редактирование'}
          initialDraft={
            form.mode === 'edit'
              ? { title: form.card.title, description: form.card.description }
              : { title: '', description: '' }
          }
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </>
  )

  function handleAddClick(columnId: number) {
    setForm({ mode: 'create', columnId })
  }

  function handleEditCard(card: Card) {
    setForm({ mode: 'edit', card })
  }

  function handleFormSubmit(draft: CardDraft) {
    if (form?.mode === 'create') {
      addCard(draft, form.columnId)
    }
    if (form?.mode === 'edit') {
      editCard(form.card.id, draft)
    }
    setForm(null)
  }

  function handleFakeDonationClick() {
    sendFakeDonation().catch(() => window.alert('Не удалось создать тестовый донат'))
  }

  function handleFormClose() {
    setForm(null)
  }
}
