"""
FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from config import settings
from api.routes import auth, sellers, menus, orders, ratings, admin

# Create FastAPI app
app = FastAPI(
    title="Society Food Platform API",
    description="Home food seller marketplace for residential societies",
    version="1.0.0-alpha.1",
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
)

# CORS Middleware
origins = settings.CORS_ORIGINS.split(",") if isinstance(settings.CORS_ORIGINS, str) else settings.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip Middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Society Food Platform API",
        "version": "1.0.0-alpha.1",
        "docs": "/api/v1/docs",
    }


# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "backend"}


# API v1 routes
app.include_router(auth.router)
app.include_router(sellers.router)
app.include_router(menus.router)
app.include_router(orders.router)
app.include_router(ratings.router)
app.include_router(admin.router)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
    )
