// Закрытие окна <dialog> кликом по серому фону вокруг него — как «Отмена».
//
// Браузер считает фон частью самого <dialog>: клик по фону приходит в dialog,
// а клик внутри окна — в форму или поле. Поэтому «клик по фону» — это клик,
// цель которого сам dialog. У окон padding: 0, и форма занимает всё окно,
// так что клик внутри окна до dialog не доходит.
//
// Проверяем и нажатие кнопки мыши: если начали выделять текст в поле, а отпустили
// за окном, браузер тоже пришлёт клик в dialog, но закрывать окно тут не нужно.
//
// Использование: <dialog {...useBackdropClose(onClose)}>

import { useRef, type MouseEvent } from 'react'

export function useBackdropClose(onClose: () => void) {
  // Нажали ли кнопку мыши прямо на фоне
  const isPressedOnBackdrop = useRef(false)

  function onMouseDown(event: MouseEvent<HTMLDialogElement>) {
    isPressedOnBackdrop.current = event.target === event.currentTarget
  }

  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (isPressedOnBackdrop.current && event.target === event.currentTarget) {
      onClose()
    }
    isPressedOnBackdrop.current = false
  }

  return { onMouseDown, onClick }
}
