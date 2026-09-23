"""ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, Float, ForeignKey, Integer, JSON,
                        String, Text, UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.utcnow()


# --------------------------------------------------------------------------
# catalogue
# --------------------------------------------------------------------------
class Ingredient(Base):
    __tablename__ = 'ingredients'

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    emoji: Mapped[str] = mapped_column(String(8), default='')
    voice: Mapped[str] = mapped_column(String(32), nullable=False)   # instrument
    f0: Mapped[float] = mapped_column(Float, default=0.0)
    color: Mapped[str] = mapped_column(String(16), default='#5ee0c8')
    signature: Mapped[str] = mapped_column(Text, default='')
    washable: Mapped[bool] = mapped_column(Boolean, default=False)
    ideal_cutoff: Mapped[float | None] = mapped_column(Float, nullable=True)
    kind: Mapped[str] = mapped_column(String(32), default='generic')
    category: Mapped[str] = mapped_column(String(32), default='Produce')


class Appliance(Base):
    __tablename__ = 'appliances'

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    emoji: Mapped[str] = mapped_column(String(8), default='')
    blurb: Mapped[str] = mapped_column(Text, default='')
    character: Mapped[str] = mapped_column(String(64), default='')


class Recipe(Base):
    __tablename__ = 'recipes'

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(96), nullable=False)
    emoji: Mapped[str] = mapped_column(String(8), default='')
    tagline: Mapped[str] = mapped_column(String(128), default='')
    difficulty: Mapped[str] = mapped_column(String(16), default='Easy')
    tier: Mapped[int] = mapped_column(Integer, default=1)
    story: Mapped[str] = mapped_column(Text, default='')
    prep_time: Mapped[str] = mapped_column(String(32), default='5 mins')
    servings: Mapped[str] = mapped_column(String(64), default='1 serving')
    page_number: Mapped[int] = mapped_column(Integer, default=1)

    ingredients: Mapped[list] = mapped_column(JSON, default=list)   # [ingredient_id]
    washable_ingredients: Mapped[list] = mapped_column(JSON, default=list)
    appliances: Mapped[list] = mapped_column(JSON, default=list)    # ordered chain
    cooking_method: Mapped[str] = mapped_column(String(32), default='grill')

    seasoning: Mapped[float] = mapped_column(Float, default=1.0)
    blend: Mapped[float] = mapped_column(Float, default=1.0)
    marinate: Mapped[float] = mapped_column(Float, default=0.0)
    caramelize_carrier: Mapped[float | None] = mapped_column(Float, nullable=True)
    caramelize_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    chop_factor: Mapped[int | None] = mapped_column(Integer, nullable=True)

    noise_difficulty: Mapped[float] = mapped_column(Float, default=1.0)
    tolerance: Mapped[float] = mapped_column(Float, default=1.0)
    teaches: Mapped[list] = mapped_column(JSON, default=list)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    def as_dict(self) -> dict:
        return {
            'id': self.id, 'name': self.name, 'emoji': self.emoji,
            'tagline': self.tagline, 'difficulty': self.difficulty,
            'tier': self.tier, 'story': self.story,
            'prep_time': self.prep_time, 'servings': self.servings,
            'page_number': self.page_number,
            'ingredients': list(self.ingredients or []),
            'washable_ingredients': list(self.washable_ingredients or []),
            'appliances': list(self.appliances or []),
            'cooking_method': self.cooking_method,
            'seasoning': self.seasoning, 'blend': self.blend,
            'marinate': self.marinate,
            'caramelize_carrier': self.caramelize_carrier,
            'caramelize_depth': self.caramelize_depth,
            'chop_factor': self.chop_factor,
            'noise_difficulty': self.noise_difficulty,
            'tolerance': self.tolerance,
            'teaches': list(self.teaches or []),
            'steps': list(self.steps or []),
        }


# --------------------------------------------------------------------------
# players and play
# --------------------------------------------------------------------------
class Player(Base):
    __tablename__ = 'players'

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    handle: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    token: Mapped[str] = mapped_column(String(64), default=_uuid, index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    unlocked_tier: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    sessions: Mapped[list['GameSession']] = relationship(back_populates='player')
    attempts: Mapped[list['Attempt']] = relationship(back_populates='player')


class GameSession(Base):
    """One attempt in progress. Holds the seed, so the server can always
    regenerate the exact ingredients the player was given."""
    __tablename__ = 'game_sessions'

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    player_id: Mapped[str] = mapped_column(ForeignKey('players.id'), index=True)
    recipe_id: Mapped[str] = mapped_column(ForeignKey('recipes.id'), index=True)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default='active')  # active|served|abandoned
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    served_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    player: Mapped[Player] = relationship(back_populates='sessions')
    recipe: Mapped[Recipe] = relationship()
    items: Mapped[list['SessionIngredient']] = relationship(
        back_populates='session', cascade='all, delete-orphan',
        order_by='SessionIngredient.slot')


class SessionIngredient(Base):
    """Per-ingredient prep state. The filter chain is stored as a
    specification, never as audio, so the server rebuilds it on submit."""
    __tablename__ = 'session_ingredients'
    __table_args__ = (UniqueConstraint('session_id', 'slot'),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey('game_sessions.id'), index=True)
    ingredient_id: Mapped[str] = mapped_column(ForeignKey('ingredients.id'))
    slot: Mapped[int] = mapped_column(Integer, default=0)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    contaminants: Mapped[list] = mapped_column(JSON, default=list)
    bands: Mapped[list] = mapped_column(JSON, default=list)
    tools: Mapped[list] = mapped_column(JSON, default=list)
    prep_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)

    session: Mapped[GameSession] = relationship(back_populates='items')
    ingredient: Mapped[Ingredient] = relationship()


class Attempt(Base):
    """A served dish and its verdict. This is the leaderboard's source table."""
    __tablename__ = 'attempts'

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey('game_sessions.id'), index=True)
    player_id: Mapped[str] = mapped_column(ForeignKey('players.id'), index=True)
    recipe_id: Mapped[str] = mapped_column(ForeignKey('recipes.id'), index=True)

    score: Mapped[float] = mapped_column(Float, default=0.0)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    prep_score: Mapped[float] = mapped_column(Float, default=0.0)
    snr_db: Mapped[float] = mapped_column(Float, default=0.0)
    mse: Mapped[float] = mapped_column(Float, default=0.0)
    correlation: Mapped[float] = mapped_column(Float, default=0.0)
    spectral_similarity: Mapped[float] = mapped_column(Float, default=0.0)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[list] = mapped_column(JSON, default=list)
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)

    player: Mapped[Player] = relationship(back_populates='attempts')
    recipe: Mapped[Recipe] = relationship()
