import { useState, type DragEvent } from 'react'
import { sendFakeDonation } from '../../api/dev'
import { useCards } from '../../hooks/useCards'
import { usePriorityLevels } from '../../hooks/usePriorityLevels'
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
    archiveCard,
    getMergeableCards,
    canMergeOnDrop,
    mergeAllInto,
    mergeOnDrop,
    unmergeCard,
    clearDone,
    undoableActions,
    undoAction,
    forgetAction,
  } = useCards()
  // Уровни приоритета из настроек: от них зависит цвет обводки карточек
  const { levels } = usePriorityLevels()
  const [form, setForm] = useState<FormState>(null)
  // Какую карточку сейчас тащат (null — никакую). Пока тащат, показываем зоны по краям доски,
  // а карточки, с которыми её можно объединить, готовы принять её.
  const [draggedCardId, setDraggedCardId] = useState<number | null>(null)
  const isDragging = draggedCardId !== null

  if (isLoading) {
    return <p>Загружаю карточки…</p>
  }

  return (
    // full-width: доске нужны боковые поля экрана под зоны «Удалить» и «Выполнено» (см. index.css)
    <div className={`${styles.page} full-width`}>
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
            allColumns={columns}
            cards={getColumnCards(column.id)}
            priorityLevels={levels}
            onAddClick={() => handleAddClick(column.id)}
            onEditCard={handleEditCard}
            onDeleteCard={handleDeleteCard}
            onFinishCard={handleFinishCard}
            onDropCard={moveCard}
            canMergeAll={(card) => getMergeableCards(card).length > 0}
            onMergeAll={mergeAllInto}
            onUnmerge={unmergeCard}
            canMergeOnDrop={canMergeDraggedOn}
            onMergeDrop={handleMergeDrop}
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

  // id карточки берём из «посылки», которую только что положила сама карточка (CardItem)
  function handleDragStart(event: DragEvent<HTMLElement>) {
    setDraggedCardId(Number(event.dataTransfer.getData('text/plain')) || null)
  }

  // Карточку отпустили (куда угодно) — прячем зоны.
  function handleDragEnd() {
    setDraggedCardId(null)
  }

  // Можно ли бросить перетаскиваемую карточку на card, чтобы объединить их
  function canMergeDraggedOn(card: Card) {
    return draggedCardId !== null && canMergeOnDrop(draggedCardId, card)
  }

  // Карточку бросили на другую карточку того же донатера — сливаем её в ту, на которую бросили
  function handleMergeDrop(card: Card) {
    if (draggedCardId !== null) {
      mergeOnDrop(draggedCardId, card)
    }
    setDraggedCardId(null)
  }

  // «Удалить» из меню карточки: в историю с пометкой «удалено», из любой колонки.
  function handleDeleteCard(card: Card) {
    archiveCard(card.id, 'deleted')
  }

  // Зелёная стрелка у карточки в «Выполнено»: в историю как выполненную.
  function handleFinishCard(card: Card) {
    archiveCard(card.id, 'done')
  }

  function handleDropToDelete(cardId: number) {
    setDraggedCardId(null)
    archiveCard(cardId, 'deleted')
  }

  function handleDropToDone(cardId: number) {
    setDraggedCardId(null)
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
