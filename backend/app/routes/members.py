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

import anyio.to_thread
from fastapi import APIRouter, Depends, HTTPException, WebSocket

from ..board import MODERATOR, OWNER, get_board_id, get_board_role, get_owned_board_id
from ..db import (
    Connection,
    Row,
    delete_board_setting,
    find_board_by_setting,
    get_board_setting,
    get_db,
    now,
    open_db,
    set_board_setting,
)
from ..realtime import notify_board_changed, send_updates_until_closed
from ..schemas import AcceptInvite, BoardInfo, BoardMember, Invite, InviteSettings, MemberNickname
from ..users import SESSION_COOKIE, find_session_user, get_current_user

router = APIRouter(prefix="/api/boards/{board_id}", tags=["Доска и модераторы"])
invites_router = APIRouter(prefix="/api/invites", tags=["Доска и модераторы"])

# Ключ в board_settings, под которым лежит токен ссылки-приглашения
INVITE_TOKEN_KEY = "invite_token"


def get_owner_name(db: Connection, board_id: int) -> str | None:
    """Имя хозяина доски из DonationAlerts. None — хозяин гость, имени нет."""
    owner = db.execute(
        "SELECT users.name FROM boards JOIN users ON users.id = boards.owner_id WHERE boards.id = %s",
        (board_id,),
    ).fetchone()
    return owner["name"] if owner else None


def get_board_info(db: Connection, board_id: int, user_id: int) -> BoardInfo:
    """Доска глазами пользователя, у которого к ней есть доступ."""
    # Как он представился на этой доске (строка есть только у модераторов)
    member = db.execute(
        "SELECT nickname FROM board_members WHERE board_id = %s AND user_id = %s", (board_id, user_id)
    ).fetchone()
    return BoardInfo(
        id=board_id,
        owner_name=get_owner_name(db, board_id),
        role=get_board_role(db, board_id, user_id),
        my_nickname=member["nickname"] if member else None,
    )


def list_moderated_boards(db: Connection, user_id: int) -> list[BoardInfo]:
    """Чужие доски, где пользователь модератор."""
    rows = db.execute(
        "SELECT board_id FROM board_members WHERE user_id = %s ORDER BY created_at", (user_id,)
    ).fetchall()
    return [get_board_info(db, row["board_id"], user_id) for row in rows]


def clean_nickname(nickname: str | None) -> str | None:
    """Имя модератора без пробелов по краям. Пустое имя или одни пробелы — None: не представился."""
    return (nickname or "").strip() or None


def find_board_by_invite(db: Connection, token: str) -> int:
    """Доска, на которую зовёт ссылка. Неверная или выключенная ссылка — ошибка 404."""
    board_id = find_board_by_setting(db, INVITE_TOKEN_KEY, token)
    if board_id is None:
        raise HTTPException(status_code=404, detail="Приглашение не работает")
    return board_id


@router.get("")
def get_board(
    board_id: int = Depends(get_board_id),
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
) -> BoardInfo:
    """Чья это доска и кто на ней тот, кто спрашивает: от роли зависит, что покажет фронт."""
    return get_board_info(db, board_id, user["id"])


@router.get("/members")
def list_members(
    board_id: int = Depends(get_owned_board_id),
    db: Connection = Depends(get_db),
) -> list[BoardMember]:
    """Модераторы доски, сначала те, кого позвали раньше."""
    rows = db.execute(
        """
        SELECT users.id, users.name, users.avatar_url, board_members.nickname,
               NOT EXISTS (SELECT 1 FROM user_logins WHERE user_logins.user_id = users.id) AS is_guest
        FROM board_members
        JOIN users ON users.id = board_members.user_id
        WHERE board_members.board_id = %s
        ORDER BY board_members.created_at
        """,
        (board_id,),
    ).fetchall()
    return [
        BoardMember(
            user_id=row["id"],
            nickname=row["nickname"],
            name=row["name"],
            avatar_url=row["avatar_url"],
            is_guest=row["is_guest"],
        )
        for row in rows
    ]


@router.put("/members/me")
def change_my_nickname(
    body: MemberNickname,
    board_id: int = Depends(get_board_id),
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
) -> BoardInfo:
    """
    Модератор меняет, как его называть на этой доске. Стример увидит новое имя в списке модераторов.
    У хозяина доски такого имени нет: его зовут по имени из DonationAlerts.
    """
    if get_board_role(db, board_id, user["id"]) != MODERATOR:
        raise HTTPException(status_code=403, detail="Имя на доске есть только у модератора")
    db.execute(
        "UPDATE board_members SET nickname = %s WHERE board_id = %s AND user_id = %s",
        (clean_nickname(body.nickname), board_id, user["id"]),
    )
    # Хозяин в настройках сразу увидит новое имя
    notify_board_changed(db, board_id)
    return get_board_info(db, board_id, user["id"])


@router.delete("/members/{user_id}", status_code=204)
def remove_member(
    user_id: int,
    board_id: int = Depends(get_owned_board_id),
    db: Connection = Depends(get_db),
) -> None:
    """Убрать модератора: доска сразу пропадёт у него из списка, а запросы к ней перестанут работать."""
    db.execute("DELETE FROM board_members WHERE board_id = %s AND user_id = %s", (board_id, user_id))
    notify_board_changed(db, board_id)


@router.get("/invite-link")
def get_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: Connection = Depends(get_db),
) -> InviteSettings:
    return InviteSettings(invite_token=get_board_setting(db, board_id, INVITE_TOKEN_KEY))


@router.post("/invite-link")
def create_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: Connection = Depends(get_db),
) -> InviteSettings:
    """Включает ссылку-приглашение или делает новую вместо старой (старая перестаёт работать)."""
    token = secrets.token_urlsafe(16)
    set_board_setting(db, board_id, INVITE_TOKEN_KEY, token)
    notify_board_changed(db, board_id)
    return InviteSettings(invite_token=token)


@router.delete("/invite-link")
def delete_invite_link(
    board_id: int = Depends(get_owned_board_id),
    db: Connection = Depends(get_db),
) -> InviteSettings:
    """
    Удаляет ссылку-приглашение и убирает всех модераторов доски:
    у них доска сразу пропадёт, а позвать снова можно только новой ссылкой.
    """
    delete_board_setting(db, board_id, INVITE_TOKEN_KEY)
    db.execute("DELETE FROM board_members WHERE board_id = %s", (board_id,))
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
    member = await anyio.to_thread.run_sync(find_board_member, session_token, board_id)
    if member is None:
        # 1008 — стандартный код «нарушены правила»: здесь — нет доступа
        await websocket.close(code=1008)
        return

    user_id, role = member
    # Хозяина отмечаем, чтобы зрители видели, на месте ли стример. Модераторы не в счёт.
    await send_updates_until_closed(websocket, board_id, owner_id=user_id if role == OWNER else None)


def find_board_member(session_token: str | None, board_id: int) -> tuple[int, str] | None:
    """Кто открыл доску: (id пользователя, роль). None — нет сессии или доступа к доске."""
    with open_db() as db:
        user = find_session_user(db, session_token)
        if user is None:
            return None
        role = get_board_role(db, board_id, user["id"])
        return (user["id"], role) if role is not None else None


@invites_router.get("/{token}")
def get_invite(
    token: str,
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
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
    body: AcceptInvite | None = None,
    user: Row = Depends(get_current_user),
    db: Connection = Depends(get_db),
) -> BoardInfo:
    """
    Принять приглашение: стать модератором доски. Хозяину и уже модератору ничего не нужно.
    В body модератор может написать, как его называть (иначе стример увидит «Гость»).
    """
    board_id = find_board_by_invite(db, token)
    nickname = clean_nickname(body.nickname) if body is not None else None
    if get_board_role(db, board_id, user["id"]) is None:
        # ON CONFLICT DO NOTHING: если «Принять» нажали дважды подряд, второй раз ничего не делает
        db.execute(
            """
            INSERT INTO board_members (board_id, user_id, role, created_at, nickname) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (board_id, user_id) DO NOTHING
            """,
            (board_id, user["id"], MODERATOR, now(), nickname),
        )
        # Хозяин в настройках сразу увидит нового модератора
        notify_board_changed(db, board_id)
    return get_board_info(db, board_id, user["id"])
