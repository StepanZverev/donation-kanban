import { useState } from 'react'
import { useCards } from '../../hooks/useCards'
import { COLUMNS, type Card, type CardDraft, type CardStatus } from '../../types/card'
import { CardFormDialog } from '../CardFormDialog/CardFormDialog'
import { Column } from '../Column/Column'
import styles from './Board.module.css'

// Какую форму сейчас показываем: создание в колонке, редактирование карточки или никакую.
type FormState =
  | { mode: 'create'; status: CardStatus }
  | { mode: 'edit'; card: Card }
  | null

export function Board() {
  const { isLoading, error, getColumnCards, addCard, editCard, removeCard } = useCards()
  const [form, setForm] = useState<FormState>(null)

  function handleFormSubmit(draft: CardDraft) {
    if (form?.mode === 'create') {
      addCard(draft, form.status)
    }
    if (form?.mode === 'edit') {
      editCard(form.card.id, draft)
    }
    setForm(null)
  }

  if (isLoading) {
    return <p>Загружаю карточки…</p>
  }

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.board}>
        {COLUMNS.map((column) => (
          <Column
            key={column.status}
            title={column.title}
            cards={getColumnCards(column.status)}
            onAddClick={() => setForm({ mode: 'create', status: column.status })}
            onEditCard={(card) => setForm({ mode: 'edit', card })}
            onRemoveCard={(card) => removeCard(card.id)}
          />
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
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
