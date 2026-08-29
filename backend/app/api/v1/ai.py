"""Multimodal AI API routes for dish analysis and intelligent meal advisory."""

from typing import Any
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.db.models import User, Menu
from app.services import ai_service

router = APIRouter(prefix="/api/v1/ai", tags=["Multimodal AI"])



class DishAnalysisRequest(BaseModel):
    title: str
    description: str = ""
    image_url: str | None = None


class MealAdviceRequest(BaseModel):
    prompt: str
    preferences: list[str] = []


@router.post("/analyze-dish", status_code=status.HTTP_200_OK)
def analyze_dish(
    request: DishAnalysisRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Multimodal dish analysis: extracts dietary badges, allergens, caloric metrics, and suggested price ranges.
    """
    result = ai_service.analyze_dish_multimodal(
        title=request.title,
        description=request.description,
        image_url=request.image_url,
    )
    return {"status": "success", "data": result}


@router.post("/meal-advisor", status_code=status.HTTP_200_OK)
def get_meal_advice(
    request: MealAdviceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Conversational AI meal advisor: matches resident requests with available neighbor menus.
    """
    active_menus = db.query(Menu).filter(Menu.is_available == True).limit(10).all()
    serialized_menus = [
        {"id": m.id, "name": m.name, "category": m.category, "price": float(m.price)}
        for m in active_menus
    ]
    advice = ai_service.generate_meal_advice(
        prompt=request.prompt,
        active_menu_items=serialized_menus,
    )
    return {"status": "success", "data": advice}
