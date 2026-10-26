#!/bin/bash
# Первая настройка нового сервера (Ubuntu 22.04 или 24.04). Запускается один раз, от root:
#
#   curl -fsSL https://raw.githubusercontent.com/StepanZverev/donation-kanban/main/deploy/setup-server.sh | bash
#
# Что делает:
# 1. Обновляет систему, ставит git, Docker и файрвол.
# 2. Открывает наружу только порты 22 (SSH), 80 и 443 (сайт).
# 3. Создаёт пользователя deploy, под которым работает сайт и заходит автодеплой.
# 4. Выключает вход по паролю: на сервер можно зайти только по SSH-ключу.
# 5. Скачивает проект в /home/deploy/donation-kanban.
# 6. Делает ключ для автодеплоя и печатает, что вписать в секреты GitHub.
set -euo pipefail

if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "Сначала добавь свой SSH-ключ на сервер (см. deploy/README.md), иначе после настройки"
  echo "войти будет нельзя: вход по паролю этот скрипт выключает."
  exit 1
fi

echo "== Обновляю систему и ставлю git, файрвол =="
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq git ufw

echo "== Ставлю Docker =="
if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "== Файрвол: открыты только 22, 80, 443 =="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "== Пользователь deploy =="
if ! id deploy > /dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
# Группа docker: deploy может запускать контейнеры без sudo
usermod -aG docker deploy
# Твой ключ тоже пускает под deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys

echo "== Вход только по ключу =="
cat > /etc/ssh/sshd_config.d/10-donation-kanban.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
CONF
systemctl reload ssh || systemctl reload sshd

echo "== Скачиваю проект =="
if [ ! -d /home/deploy/donation-kanban ]; then
  sudo -u deploy git clone https://github.com/StepanZverev/donation-kanban.git /home/deploy/donation-kanban
fi
# Папка для бэкапов: создаём заранее, чтобы она принадлежала deploy, а не root
sudo -u deploy mkdir -p /home/deploy/donation-kanban/deploy/backups

echo "== Ключ для автодеплоя из GitHub =="
key=/home/deploy/.ssh/github_actions
if [ ! -f "$key" ]; then
  sudo -u deploy ssh-keygen -t ed25519 -N "" -C "github-actions" -f "$key" -q
  cat "$key.pub" >> /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

ip=$(curl -fsS4 https://ifconfig.me || hostname -I | cut -d' ' -f1)
echo
echo "Готово. Впиши в GitHub: Settings → Secrets and variables → Actions → New repository secret"
echo
echo "DEPLOY_HOST:"
echo "$ip"
echo
echo "DEPLOY_KNOWN_HOSTS:"
ssh-keyscan -t ed25519 localhost 2> /dev/null | sed "s/^localhost/$ip/"
echo
echo "DEPLOY_SSH_KEY (всё, включая строки BEGIN и END):"
cat "$key"
echo
echo "Дальше: заполни настройки сайта, как написано в deploy/README.md, шаг «Запуск»."
