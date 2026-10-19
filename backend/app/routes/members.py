"""
Модераторы: помощники стримера, которые работают с его доской.

Как модератор попадает на доску:
1. Хозяин включает в настройках ссылку-приглашение (/invite/<токен>) и отправляет её.
2. Модератор открывает ссылку и нажимает «Принять». Входить через DonationAlerts
   не обязательно: гость тоже может быть модератором.
3. Теперь доска есть у него в списке, и он может двигать, править и убирать карточки.
   Настройки, колонки, сброс доски и приглашения остаются только у хозяина.

Хозяин видит список модераторов и может убрать любого. Новая ссылка-приглашение
заменяет старую: старая сразу перестаёт работать (уже принятые приглашения остаются).
А если ссылку удалить совсем, вместе с ней убираются и все модераторы.
"""

import secrets
import sqlite3

import anyio.to_thread
from fastapi import APIRouter, Depends, HTTPException, WebSocket

from ..board import MODERATOR, get_board_id, get_board_role, get_owned_board_id
from ..db import delete_board_setting, get_board_setting, get_db, now, open_db, set_board_setting
from ..realtime import notify_board_changed, send_updates_until_closed
from ..schemas import BoardInfo, BoardMember, Invite, InviteSettings
from ..users import SESSION_COOKIE, find_session_user, get_current_user

router = APIRouter(prefix="/api/boards/{board_id}", tags=["Доска и модераторы"])
invites_router = APIRouter(prefix="/api/invites", tags=["Доска и модераторы"])

# Ключ в board_settings, под которым лежит токен ссылки-приглашения
INVITE_TOKEN_KEY = "invite_token"


def get_owner_name(db: sqlite3.Connection, board_id: int) -> str | None:
    """Имя хозяина доски из DonationAlerts. None — хозяин гость, имени нет."""
    owner = db.execute(
        "SELECT users.name FROM boards JOIN users ON users.id = boards.owner_id WHERE boards.id = ?",
        (board_id,),
    ).fetchone()
    return owner["name"] if owner else None


def get_board_info(db: sqlite3.Connection, board_id: int, user_id: int) -> BoardInfo:
    """Доска глазами пользователя, у которого к ней есть доступ."""
    return BoardInfo(
        id=board_id,
        owner_name=get_owner_name(db, board_id),
        role=get_board_role(db, board_id, user_id),
    )


def list_moderated_boards(db: sqlite3.Connection, user_id: int) -> list[BoardInfo]:
    """Чужие доски, где пользователь модератор."""
    rows = db.execute(
        "SELECT board_id FROM board_members WHERE user_id = ? ORDER BY created_at", (user_id,)
    ).fetchall()
    return [get_board_info(db, row["board_id"], user_id) for row in rows]


def find_board_by_invite(db: sqlite3.Connection, token: str) -> int:
    """Доска, на которую зовёт ссылка. Неверная или выключенная ссылка — ошибка 404."""
    row = db.execute(
        "SELECT board_id FROM board_settings WHERE key = ? AND value = ?", (INVITE_TOKEN_KEY, token)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Приглашение не работает")
    return row["board_id"]


@router.get("")
def get_board(
    board_id: int = Depends(get_board_id),
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> BoardInfo:
    """Чья это доска и кто на ней тот, кто спрашивает: от роли зависит, что покажет фронт."""
    return get_board_info(db, board_id, user["id"])


@router.get("/members")
def list_members(
    board_id: int = Depends(get_owned_board_id),
    db: sqlite3.Connection = Depends(get_db),
) -> list[BoardMember]:
    """Модераторы доски, сначала те, кого позвали раньше."""
    rows = db.execute(
        """
        SELECT users.id, users.name, users.avatar_url,
               NOT EXISTS (SELECT 1 FROM user_logins WHERE user_logins.user_id = users.id) AS is_guest
        FROM board_members
        JOIN users ON users.id = board_members.user_id
        WHERE board_members.board_id = ?
        ORDER BY board_members.created_at
        """,
        (board_id,),
    ).fetchall()
    return [
        BoardMember(user_id=row["id"], name=row["name"], avatar_url=row["avatar_url"], is_guest=row["is_guest"])
        for row in rows
    ]


@router.delete("/members/{user_id}", status_code=204)
def remove_member(
    user_id: int,
    board_id: int = Depends(get_owned_board_id),
    db: sqlite3.Connection = Depends(get_db),
) -> None:
    """Убрать модератора: доска сразу пропадёт у него из списка, а запросы к ней перестанут работать."""
    db.execute("DELETE FROM board_members WHERE board_id = ? AND user_id = ?", (board_id, user_id))
    notify_board_changed(db, board_id)


@router.get("/invite-link")
def get_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: sqlite3.Connection = Depends(get_db),
) -> InviteSettings:
    return InviteSettings(invite_token=get_board_setting(db, board_id, INVITE_TOKEN_KEY))


@router.post("/invite-link")
def create_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: sqlite3.Connection = Depends(get_db),
) -> InviteSettings:
    """Включает ссылку-приглашение или делает новую вместо старой (старая перестаёт работать)."""
    token = secrets.token_urlsafe(16)
    set_board_setting(db, board_id, INVITE_TOKEN_KEY, token)
    notify_board_changed(db, board_id)
    return InviteSettings(invite_token=token)


@router.delete("/invite-link")
def delete_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: sqlite3.Connection = Depends(get_db),
) -> InviteSettings:
    """
    Удаляет ссылку-приглашение и убирает всех модераторов доски:
    у них доска сразу пропадёт, а позвать снова можно только новой ссылкой.
    """
    delete_board_setting(db, board_id, INVITE_TOKEN_KEY)
    db.execute("DELETE FROM board_members WHERE board_id = ?", (board_id,))
    notify_board_changed(db, board_id)
    return InviteSettings(invite_token=None)


@router.websocket("/ws")
async def board_updates_socket(websocket: WebSocket, board_id: int) -> None:
    """
    Живые обновления доски: фронт ждёт здесь сообщений {"type": "board_changed"}.

    Кто подключился, узнаём по той же cookie сессии, что и в обычных запросах.
    Нет сессии или нет доступа к доске — закрываем соединение.
    """
    # Работа с базой может подождать, пока другой запрос допишет свои изменения.
    # Ждём в отдельном потоке: иначе сервер замрёт и тот запрос не сможет закончиться.
    session_token = websocket.cookies.get(SESSION_COOKIE)
    has_access = await anyio.to_thread.run_sync(can_open_board, session_token, board_id)
    if not has_access:
        # 1008 — стандартный код «нарушены правила»: здесь — нет доступа
        await websocket.close(code=1008)
        return

    await send_updates_until_closed(websocket, board_id)


def can_open_board(session_token: str | None, board_id: int) -> bool:
    with open_db() as db:
        user = find_session_user(db, session_token)
        return user is not None and get_board_role(db, board_id, user["id"]) is not None


@invites_router.get("/{token}")
def get_invite(
    token: str,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Invite:
    """Чья доска за приглашением и принято ли оно уже."""
    board_id = find_board_by_invite(db, token)
    return Invite(
        board_id=board_id,
        owner_name=get_owner_name(db, board_id),
        role=get_board_role(db, board_id, user["id"]),
    )


@invites_router.post("/{token}/accept")
def accept_invite(
    token: str,
    user: sqlite3.Row = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> BoardInfo:
    """Принять приглашение: стать модератором доски. Хозяину и уже модератору ничего не нужно."""
    board_id = find_board_by_invite(db, token)
    if get_board_role(db, board_id, user["id"]) is None:
        db.execute(
            "INSERT INTO board_members (board_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
            (board_id, user["id"], MODERATOR, now()),
        )
        # Хозяин в настройках сразу увидит нового модератора
        notify_board_changed(db, board_id)
    return get_board_info(db, board_id, user["id"])
