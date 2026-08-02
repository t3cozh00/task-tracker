from calendar import monthrange
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..constants import DEFAULT_USER_ID
from ..database import get_db
from ..models import Checkin, Task
from ..schemas import CheckinsOut, CheckinToggleIn, CheckinToggleOut, TaskCreate, TaskOut

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


async def _get_owned_task(db: AsyncSession, task_id: int) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == DEFAULT_USER_ID)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
):
    year, mon = (int(part) for part in month.split("-"))
    if not (1 <= mon <= 12):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid month")
    start, end = _month_bounds(year, mon)

    tasks_result = await db.execute(
        select(Task).where(Task.user_id == DEFAULT_USER_ID).order_by(Task.id)
    )
    tasks = tasks_result.scalars().all()
    task_ids = [t.id for t in tasks]

    checkins_by_task: dict[int, list[date]] = defaultdict(list)
    if task_ids:
        checkins_result = await db.execute(
            select(Checkin.task_id, Checkin.date).where(
                Checkin.task_id.in_(task_ids),
                Checkin.date >= start,
                Checkin.date <= end,
            )
        )
        for task_id, checkin_date in checkins_result.all():
            checkins_by_task[task_id].append(checkin_date)

    return [
        TaskOut(
            id=t.id,
            name=t.name,
            icon=t.icon,
            color_key=t.color_key,
            checkins=sorted(checkins_by_task.get(t.id, [])),
        )
        for t in tasks
    ]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(
        user_id=DEFAULT_USER_ID,
        name=payload.name,
        icon=payload.icon,
        color_key=payload.color_key,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut(id=task.id, name=task.name, icon=task.icon, color_key=task.color_key, checkins=[])


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    task = await _get_owned_task(db, task_id)
    await db.delete(task)
    await db.commit()


@router.get("/{task_id}/checkins", response_model=CheckinsOut)
async def get_task_checkins(
    task_id: int,
    year: int = Query(..., ge=1900, le=9999),
    month: int | None = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_task(db, task_id)

    if month is not None:
        start, end = _month_bounds(year, month)
    else:
        start, end = date(year, 1, 1), date(year, 12, 31)

    result = await db.execute(
        select(Checkin.date)
        .where(Checkin.task_id == task_id, Checkin.date >= start, Checkin.date <= end)
        .order_by(Checkin.date)
    )
    return CheckinsOut(dates=[row[0] for row in result.all()])


@router.post("/{task_id}/checkins/toggle", response_model=CheckinToggleOut)
async def toggle_checkin(
    task_id: int, payload: CheckinToggleIn, db: AsyncSession = Depends(get_db)
):
    await _get_owned_task(db, task_id)

    if payload.date > date.today():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot check in a future date")

    result = await db.execute(
        select(Checkin).where(Checkin.task_id == task_id, Checkin.date == payload.date)
    )
    existing = result.scalar_one_or_none()

    if existing is not None:
        await db.delete(existing)
        await db.commit()
        return CheckinToggleOut(date=payload.date, checked=False)

    db.add(Checkin(task_id=task_id, date=payload.date))
    await db.commit()
    return CheckinToggleOut(date=payload.date, checked=True)
