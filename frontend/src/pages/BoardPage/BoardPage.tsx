import { useState } from 'react'
import { sendFakeDonation } from '../../api/dev'
import { useCards } from '../../hooks/useCards'
import type { Card, CardDraft } from '../../types/card'
import { CardFormDialog } from '../../components/CardFormDialog/CardFormDialog'
import { DonationAlertsStatus } from '../../components/DonationAlertsStatus/DonationAlertsStatus'
import { Column } from '../../components/Column/Column'
import { DropZone } from '../../components/DropZone/DropZone'
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
    archiveCard,
    clearDone,
    undoableActions,
    undoAction,
    forgetAction,
  } = useCards()
  const [form, setForm] = useState<FormState>(null)
  // Тащат ли сейчас какую-нибудь карточку: тогда показываем зоны по краям доски.
  const [isDragging, setIsDragging] = useState(false)

  if (isLoading) {
    return <p>Загружаю карточки…</p>
  }

  return (
    <div className={styles.page}>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.toolbar}>
        <DonationAlertsStatus />
        {/* Карточка появится сама: бэкенд пришлёт обновление через WebSocket */}
        <button type="button" onClick={handleFakeDonationClick}>
          + Тестовый донат
        </button>
      </div>

      {/* События перетаскивания всплывают от карточек и колонок до доски,
          поэтому здесь удобно следить, тащат ли что-то прямо сейчас. */}
      <div
        className={styles.board}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrop={handleDragEnd}
      >
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

      {/* Зоны у левого и правого края экрана: бросил карточку — она ушла в историю */}
      <DropZone kind="delete" isVisible={isDragging} onDropCard={handleDropToDelete} />
      <DropZone kind="done" isVisible={isDragging} onDropCard={handleDropToDone} />

      {/* Плашки «Отменить» стопкой внизу экрана, самая новая — снизу */}
      <div className={styles.toasts}>
        {undoableActions.map((action) => (
          <UndoToast key={action.id} action={action} onUndo={undoAction} onClose={forgetAction} />
        ))}
      </div>

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
    </div>
  )

  function handleDragStart() {
    setIsDragging(true)
  }

  // Карточку отпустили (куда угодно) — прячем зоны.
  function handleDragEnd() {
    setIsDragging(false)
  }

  function handleDropToDelete(cardId: number) {
    setIsDragging(false)
    archiveCard(cardId, 'deleted')
  }

  function handleDropToDone(cardId: number) {
    setIsDragging(false)
    archiveCard(cardId, 'done')
  }

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
