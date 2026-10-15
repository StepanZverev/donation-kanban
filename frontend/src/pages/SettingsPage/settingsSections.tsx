import type { ReactNode } from 'react'
import { ColumnsSettings } from '../../components/ColumnsSettings/ColumnsSettings'
import { DonationsSettings } from '../../components/DonationsSettings/DonationsSettings'
import { PriorityLevelsSettings } from '../../components/PriorityLevelsSettings/PriorityLevelsSettings'
import { ThemeSettings } from '../../components/ThemeSettings/ThemeSettings'
import { ViewerSettings } from '../../components/ViewerSettings/ViewerSettings'

// Разделы настроек в том порядке, в каком они стоят в меню.
// path — адрес раздела после /settings/, element — что в нём показать.
// По этому списку App.tsx строит маршруты, а SettingsPage — меню.
export const SETTINGS_SECTIONS: { path: string; title: string; element: ReactNode }[] = [
  { path: 'columns', title: 'Колонки', element: <ColumnsSettings /> },
  { path: 'levels', title: 'Уровни приоритета', element: <PriorityLevelsSettings /> },
  { path: 'donations', title: 'Приём донатов', element: <DonationsSettings /> },
  { path: 'viewers', title: 'Для зрителей', element: <ViewerSettings /> },
  { path: 'appearance', title: 'Внешний вид', element: <ThemeSettings /> },
]
