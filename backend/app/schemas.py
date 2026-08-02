from datetime import date

from pydantic import BaseModel, Field, field_validator

from .constants import COLOR_KEYS, ICON_OPTIONS


class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    icon: str
    color_key: str

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: str) -> str:
        if v not in ICON_OPTIONS:
            raise ValueError(f"icon must be one of {ICON_OPTIONS}")
        return v

    @field_validator("color_key")
    @classmethod
    def validate_color_key(cls, v: str) -> str:
        if v not in COLOR_KEYS:
            raise ValueError(f"color_key must be one of {COLOR_KEYS}")
        return v


class TaskOut(BaseModel):
    id: int
    name: str
    icon: str
    color_key: str
    checkins: list[date]


class CheckinsOut(BaseModel):
    dates: list[date]


class CheckinToggleIn(BaseModel):
    date: date


class CheckinToggleOut(BaseModel):
    date: date
    checked: bool
