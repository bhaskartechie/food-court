from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional
import asyncio
import json
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.post("/search")
async def multimodal_search(query: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    """
    Mocked multimodal AI search endpoint.

    Accepts optional text `query` and optional `file` (image/audio/video).
    Returns a mocked AI response including flavor profile, suggested recipe, and curated bundles.
    """
    # In a real implementation, this would call an LLM/multimodal model and image/audio encoders.
    example_response = {
        "query": query,
        "file_received": bool(file),
        "flavor_profile": {"Umami": 82, "Acidity": 58, "Richness": 76},
        "suggested_recipe": {
            "title": "Rainy Day Comfort: Wild Mushroom Risotto",
            "eta_minutes": 45,
            "summary": "Creamy Arborio rice, porcini broth, seared wild mushrooms, finished with mascarpone and parsley.",
        },
        "curated_bundles": [
            {"id": "ribeye-01", "title": "Date Night Ribeye Kit", "price": 59},
            {"id": "veg-mezze-01", "title": "Vegetarian Mezze Bundle", "price": 39},
        ],
        "explain": "This is a mocked response. Replace with real model integration.",
    }

    return JSONResponse(status_code=200, content=example_response)



@router.get("/stream")
async def multimodal_stream(query: Optional[str] = None):
    """
    Mocked Server-Sent Events (SSE) endpoint that streams incremental
    JSON 'data' chunks to simulate a streaming multimodal AI response.
    """

    async def event_generator(q: Optional[str] = None):
        # Initial skeletal loading event
        skeleton = {"type": "skeleton", "message": "Preparing personalized recipe..."}
        yield f"data: {json.dumps(skeleton)}\n\n"
        await asyncio.sleep(1.0)

        # Partial: ingredients streaming (multiple events)
        ingredients = ["Arborio", "Porcini", "Mascarpone", "Parsley"]
        for ing in ingredients:
            await asyncio.sleep(0.6)
            chunk = {"type": "ingredient", "ingredient": ing}
            yield f"data: {json.dumps(chunk)}\n\n"

        # Partial recipe step
        await asyncio.sleep(0.8)
        step = {"type": "partial_recipe", "text": "Sear mushrooms on high heat until golden..."}
        yield f"data: {json.dumps(step)}\n\n"

        # Final message with suggested recipe and bundles
        await asyncio.sleep(0.8)
        final = {
            "type": "final",
            "recipe": {
                "title": "Rainy Day Comfort: Wild Mushroom Risotto",
                "eta_minutes": 45,
                "summary": "Creamy Arborio rice, porcini broth, seared wild mushrooms, mascarpone finish.",
            },
            "bundles": [
                {"id": "ribeye-01", "title": "Date Night Ribeye Kit", "price": 59},
                {"id": "veg-mezze-01", "title": "Vegetarian Mezze Bundle", "price": 39},
            ],
        }
        yield f"data: {json.dumps(final)}\n\n"

    return StreamingResponse(event_generator(query), media_type='text/event-stream')
