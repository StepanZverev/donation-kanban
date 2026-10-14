import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

type SkeletonProps = {
  // Размеры серого прямоугольника, например '60%' или 18 (пиксели)
  width?: CSSProperties['width']
  height?: CSSProperties['height']
}

// Серая «заглушка» на месте того, что ещё грузится. Мягко переливается,
// чтобы было видно, что страница не зависла.
export function Skeleton(props: SkeletonProps) {
  const { width = '100%', height = 14 } = props
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />
}
