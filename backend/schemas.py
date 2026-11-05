"""Pydantic request models. Every mutation forbids unknown fields."""

from __future__ import annotations

from datetime import date
from typing import Literal

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

EmploymentType = Literal["FULL_TIME", "CONTRACT"]

# The demo uses the reserved `.test` domain, which EmailStr refuses, so the
# address is checked with a plain pattern instead.
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _check_email(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) > 254 or not EMAIL_PATTERN.match(normalized):
        raise ValueError("Enter a valid email address.")
    return normalized


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(StrictModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class EmployeeCreate(StrictModel):
    full_name: str = Field(min_length=1, max_length=100)
    work_email: str
    job_title: str = Field(min_length=1, max_length=100)
    department: str = Field(min_length=1, max_length=80)
    employment_type: EmploymentType
    date_of_joining: date
    manager_id: int | None = None
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("work_email")
    @classmethod
    def _email(cls, value: str) -> str:
        return _check_email(value)

    @field_validator("full_name", "job_title", "department")
    @classmethod
    def _trimmed(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("This field is required.")
        return trimmed

    @field_validator("date_of_joining")
    @classmethod
    def _not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Enter a date that is not in the future.")
        return value


class EmployeeUpdate(StrictModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    work_email: str | None = None
    job_title: str | None = Field(default=None, min_length=1, max_length=100)
    department: str | None = Field(default=None, min_length=1, max_length=80)
    employment_type: EmploymentType | None = None
    date_of_joining: date | None = None
    manager_id: int | None = None
    phone: str | None = Field(default=None, max_length=30)
    version: int = Field(ge=1)

    @field_validator("work_email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _check_email(value)

    @field_validator("full_name", "job_title", "department")
    @classmethod
    def _trimmed(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("This field is required.")
        return trimmed

    @field_validator("date_of_joining")
    @classmethod
    def _not_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Enter a date that is not in the future.")
        return value


class DeactivateRequest(StrictModel):
    version: int = Field(ge=1)
    anonymise: bool = False


class ProfileUpdate(StrictModel):
    phone: str | None = Field(default=None, max_length=30)
    version: int = Field(ge=1)
