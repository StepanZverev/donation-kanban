#!/bin/sh
# Ночные бэкапы базы. Работает в отдельном контейнере (сервис backup в docker-compose.yml).
# Каждую ночь в 04:00 по Москве делает копию базы в папку deploy/backups на сервере
# и хранит последние 14 копий. Как восстановить базу из копии — в deploy/README.md.
set -e

while true; do
  # Сколько секунд осталось до ближайших 04:00
  next=$(date -d '04:00' +%s)
  if [ "$next" -le "$(date +%s)" ]; then
    next=$(date -d 'tomorrow 04:00' +%s)
  fi
  sleep $((next - $(date +%s)))

  file="/backups/donation_kanban-$(date +%Y-%m-%d).dump"
  # -Fc — сжатый формат, из которого pg_restore умеет восстанавливать
  if pg_dump -h postgres -U donation_kanban -Fc donation_kanban > "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "Бэкап готов: $file"
  else
    rm -f "$file.tmp"
    echo "Бэкап не удался"
  fi

  # Оставляем 14 самых свежих копий, остальные удаляем
  ls -1t /backups/*.dump | tail -n +15 | xargs -r rm --
done
