import { MERGE_SEPARATOR } from '../../defaults'
import styles from './CardText.module.css'

// Тексты объединённых донатов разделены отдельной строкой с MERGE_SEPARATOR.
const MERGE_LINE = `\n${MERGE_SEPARATOR}\n`

type CardTextProps = {
  text: string
}

// Текст карточки: у объединённой — тексты донатов по отдельности, между ними пунктир.
// Одинаково у стримера (CardItem) и у зрителя (ViewerCard).
export function CardText({ text }: CardTextProps) {
  return text.split(MERGE_LINE).map((part, index) => (
    // Индекс как key подходит: части не переставляются, только дописываются в конец
    <span key={index}>
      {index > 0 && <span className={styles.separator} />}
      {part}
    </span>
  ))
}
