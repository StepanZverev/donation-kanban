import { useEffect, useRef, type ReactNode } from 'react'
import { useBackdropClose } from '../../hooks/useBackdropClose'
import styles from './Modal.module.css'

type ModalProps = {
  heading: string
  // Ширина окна в пикселях. На узком экране окно сужается до ширины экрана.
  width: number
  onClose: () => void
  // Содержимое под заголовком: обычно форма с полями и кнопками
  children: ReactNode
}

// Модальное окно на встроенном в браузер теге <dialog>: заголовок и содержимое под ним.
// Закрывается клавишей Esc и кликом по серому фону вокруг окна — как «Отмена».
// Родитель показывает компонент, только пока окно открыто: {isOpen && <Modal …>}.
export function Modal(props: ModalProps) {
  const { heading, width, onClose, children } = props
  const dialogRef = useRef<HTMLDialogElement>(null)
  const backdropClose = useBackdropClose(onClose)

  // showModal() открывает окно поверх страницы и затемняет фон
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    // onClose срабатывает и при нажатии Esc
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      style={{ maxWidth: width }}
      onClose={onClose}
      {...backdropClose}
    >
      <div className={styles.content}>
        <h2 className={styles.heading}>{heading}</h2>
        {children}
      </div>
    </dialog>
  )
}
