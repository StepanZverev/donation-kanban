import { useRef, useState, type DragEvent } from 'react'
import { useCards } from '../../hooks/useCards'
import { useHighlightSince } from '../../hooks/useHighlightSince'
import { usePriorityLevels } from '../../hooks/usePriorityLevels'
import type { Card, CardDraft } from '../../types/card'
import { getEditableText } from '../../utils/donor'
import { CardFormDialog } from '../../components/CardFormDialog/CardFormDialog'
import { Column } from '../../components/Column/Column'
import { DropZone } from '../../components/DropZone/DropZone'
import { RejectDialog } from '../../components/RejectDialog/RejectDialog'
import { UndoToast } from '../../components/UndoToast/UndoToast'
import styles from './BoardPage.module.css'

// Насколько близко к краю экрана (в пикселях) должен был быть курсор, чтобы карточка,
// которую отпустили за краем окна, ушла в зону «Удалить» или «Выполнено»
const SCREEN_EDGE_PX = 12

// Какую форму сейчас показываем: создание в колонке, редактирование карточки или никакую.
type FormState =
  | { mode: 'create'; columnId: number }
  | { mode: 'edit'; card: Card }
  | null

type BoardPageProps = {
  // До какого времени донаты на доске уже видели (см. useNewDonations).
  // Пришедшие позже мигнут подсветкой, когда откроешь доску.
  seenAt: string | null
}

export function BoardPage({ seenAt }: BoardPageProps) {
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
    clearQueue,
    undoableActions,
    undoAction,
    forgetAction,
  } = useCards()
  // Уровни приоритета из настроек: от них зависит цвет полоски и суммы на карточках
  const { levels } = usePriorityLevels()
  // Донаты новее этого времени пришли, пока доска была закрыта. null — подсвечивать нечего.
  const highlightSince = useHighlightSince(seenAt)
  const [form, setForm] = useState<FormState>(null)
  // Какую карточку сейчас отклоняют (открыто окно с причиной), null — никакую
  const [rejectingCard, setRejectingCard] = useState<Card | null>(null)
  // Какую карточку сейчас тащат (null — никакую). Пока тащат, показываем зоны по краям доски,
  // а карточки, с которыми её можно объединить, готовы принять её.
  const [draggedCardId, setDraggedCardId] = useState<number | null>(null)
  const isDragging = draggedCardId !== null
  // Где по горизонтали курсор был в последний раз, пока тащили карточку.
  // useRef — потому что значение меняется много раз в секунду и перерисовка не нужна.
  const lastDragX = useRef<number | null>(null)

  if (isLoading) {
    return <p>Загружаю карточки…</p>
  }

  return (
    // full-width: доске нужны боковые поля экрана под зоны «Удалить» и «Выполнено» (см. index.css)
    <div className={`${styles.page} full-width`} onDragOver={handleDragMove}>
      {error && <p className={styles.error}>{error}</p>}

      {/* События перетаскивания всплывают от карточек и колонок до доски,
          поэтому здесь удобно следить, тащат ли что-то прямо сейчас. */}
      <div
        className={styles.board}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
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
            onRejectCard={setRejectingCard}
            onDropCard={moveCard}
            canMergeAll={(card) => getMergeableCards(card).length > 0}
            onMergeAll={mergeAllInto}
            onUnmerge={unmergeCard}
            canMergeOnDrop={canMergeDraggedOn}
            onMergeDrop={handleMergeDrop}
            onClearClick={column.kind === 'incoming' ? clearQueue : clearDone}
            isNewCard={isNewCard}
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

      {rejectingCard && (
        <RejectDialog
          card={rejectingCard}
          onSubmit={handleRejectSubmit}
          onClose={() => setRejectingCard(null)}
        />
      )}

      {form && (
        <CardFormDialog
          heading={form.mode === 'create' ? 'Новая карточка' : 'Редактирование'}
          initialDraft={
            form.mode === 'edit'
              ? {
                  donorName: form.card.donorName ?? '',
                  text: getEditableText(form.card),
                  amount: form.card.amount,
                }
              : { donorName: '', text: '', amount: null }
          }
          currency={form.mode === 'edit' ? form.card.currency : null}
          onSubmit={handleFormSubmit}
          onClose={handleFormClose}
        />
      )}
    </div>
  )

  // id карточки берём из «посылки», которую только что положила сама карточка (CardItem)
  // У объединённой карточки считаем по самому свежему донату в ней
  function isNewCard(card: Card) {
    const lastDonationAt = card.lastDonationAt ?? card.createdAt
    return highlightSince !== null && card.source === 'donationalerts' && lastDonationAt > highlightSince
  }

  function handleDragStart(event: DragEvent<HTMLElement>) {
    setDraggedCardId(Number(event.dataTransfer.getData('text/plain')) || null)
  }

  // Запоминаем, где курсор, пока тащат карточку (нужно в handleDragEnd)
  function handleDragMove(event: DragEvent<HTMLElement>) {
    lastDragX.current = event.clientX
  }

  // Карточку бросили куда-то на доске — прячем зоны.
  function handleDrop() {
    setDraggedCardId(null)
  }

  // Перетаскивание закончилось. Если карточку никуда не бросили (dropEffect === 'none'),
  // но курсор перед этим был у самого края экрана, значит её утащили за край окна:
  // на крайнем пикселе браузер иногда уже не считает курсор над зоной. Делаем то же,
  // что сделала бы зона у этого края.
  function handleDragEnd(event: DragEvent<HTMLElement>) {
    const cardId = draggedCardId
    const x = lastDragX.current
    setDraggedCardId(null)
    lastDragX.current = null

    if (cardId === null || x === null || event.dataTransfer.dropEffect !== 'none') {
      return
    }
    if (x <= SCREEN_EDGE_PX) {
      archiveCard(cardId, 'deleted')
    } else if (x >= window.innerWidth - 1 - SCREEN_EDGE_PX) {
      archiveCard(cardId, 'done')
    }
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

  // В окне «Отклонить донат» нажали «Отклонить»: в историю с пометкой и причиной
  function handleRejectSubmit(reason: string) {
    if (rejectingCard) {
      archiveCard(rejectingCard.id, 'rejected', reason)
    }
    setRejectingCard(null)
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


  function handleFormClose() {
    setForm(null)
  }
}
