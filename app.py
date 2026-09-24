from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime, date
from pathlib import Path
from contextlib import contextmanager
from typing import Optional
from dotenv import load_dotenv
import os
import shutil
import tempfile

import psycopg2
from psycopg2.extras import RealDictCursor, Json

from pipeline import process_garment_image

load_dotenv()


app = FastAPI(title="TrueFit Vision")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "truefit_vision"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD"),
}


if not DB_CONFIG["password"]:
    raise RuntimeError(
        "DB_PASSWORD is not configured. "
        "Create a .env file and set DB_PASSWORD."
    )


def serialize(value):
    if isinstance(value, list):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


@contextmanager
def get_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(query, params=None):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            return serialize([dict(row) for row in cur.fetchall()])


def fetch_one(query, params=None):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params or ())
            row = cur.fetchone()
            return serialize(dict(row)) if row else None


class FitProfileIn(BaseModel):
    profile_name: str = Field(..., min_length=1)
    reference_garment_name: Optional[str] = None
    preferred_chest_cm: float = Field(..., gt=0)
    preferred_length_cm: float = Field(..., gt=0)
    fit_preference: str = "regular"


class SizeComparisonItem(BaseModel):
    size: str
    chestDiff: float
    lengthDiff: float
    distance: float


class SizeRecommendationIn(BaseModel):
    fit_profile_id: int
    profile_name: str
    product_name: str
    recommended_size: str
    match_quality: str
    similarity_score: float
    chest_diff_cm: float
    length_diff_cm: float
    comparison_data: list[SizeComparisonItem]


@app.post("/measure")
def measure_garment(
    file: UploadFile = File(...),
    reference_object_width_px: Optional[float] = Form(None),
):
    suffix = Path(file.filename or "garment.jpg").suffix or ".jpg"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = Path(temp_file.name)

        return process_garment_image(
            str(temp_path),
            reference_object_width_px,
            29.7,
        )

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not measure garment: {exc}",
        )

    finally:
        try:
            file.file.close()
        except Exception:
            pass

        if temp_path and temp_path.exists():
            temp_path.unlink()


@app.get("/api/garment-measurements")
def list_garment_measurements():
    try:
        return fetch_all(
            """
            SELECT
                id,
                shirt_name,
                actual_chest_cm,
                estimated_chest_cm,
                actual_length_cm,
                estimated_length_cm,
                chest_error_cm,
                length_error_cm
            FROM garment_measurements
            ORDER BY id
            """
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        )


@app.get("/api/fit-profiles")
def list_fit_profiles():
    try:
        return fetch_all(
            """
            SELECT
                id,
                profile_name,
                reference_garment_name,
                preferred_chest_cm,
                preferred_length_cm,
                fit_preference,
                created_at
            FROM fit_profiles
            ORDER BY id DESC
            """
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {exc}",
        )


@app.post("/api/fit-profiles")
def create_fit_profile(payload: FitProfileIn):
    name = payload.profile_name.strip()
    garment_name = (
        payload.reference_garment_name.strip()
        if payload.reference_garment_name
        else None
    )
    fit_preference = payload.fit_preference.lower().strip()

    if not name:
        raise HTTPException(status_code=400, detail="Profile name is required")

    if fit_preference not in {"snug", "regular", "relaxed"}:
        raise HTTPException(
            status_code=400,
            detail="fit_preference must be snug, regular, or relaxed",
        )

    try:
        return fetch_one(
            """
            INSERT INTO fit_profiles (
                profile_name,
                reference_garment_name,
                preferred_chest_cm,
                preferred_length_cm,
                fit_preference
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                id,
                profile_name,
                reference_garment_name,
                preferred_chest_cm,
                preferred_length_cm,
                fit_preference,
                created_at
            """,
            (
                name,
                garment_name,
                payload.preferred_chest_cm,
                payload.preferred_length_cm,
                fit_preference,
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not save fit profile: {exc}",
        )


@app.post("/api/size-recommendations")
def create_size_recommendation(
    payload: SizeRecommendationIn
):
    try:

        comparison_json = Json([
            item.model_dump()
            if hasattr(item, "model_dump")
            else item.dict()
            for item in payload.comparison_data
        ])


        return fetch_one(
            """
            INSERT INTO size_recommendations (
                fit_profile_id,
                profile_name,
                product_name,
                recommended_size,
                match_quality,
                similarity_score,
                chest_diff_cm,
                length_diff_cm,
                comparison_data
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            RETURNING
                id,
                fit_profile_id,
                profile_name,
                product_name,
                recommended_size,
                match_quality,
                similarity_score,
                chest_diff_cm,
                length_diff_cm,
                comparison_data,
                created_at
            """,
            (
                payload.fit_profile_id,
                payload.profile_name.strip(),
                payload.product_name.strip()
                or "Unnamed Product",
                payload.recommended_size.strip().upper(),
                payload.match_quality,
                payload.similarity_score,
                payload.chest_diff_cm,
                payload.length_diff_cm,
                comparison_json,
            ),
        )


    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail=f"Could not save recommendation: {exc}"
        )
@app.get("/api/size-recommendations")
def list_size_recommendations():

    try:

        return fetch_all(
            """
            SELECT
                id,
                fit_profile_id,
                profile_name,
                product_name,
                recommended_size,
                match_quality,
                similarity_score,
                chest_diff_cm,
                length_diff_cm,
                comparison_data,
                created_at
            FROM size_recommendations
            ORDER BY created_at DESC
            """
        )


    except Exception as exc:

        raise HTTPException(
            status_code=503,
            detail=f"Could not load recommendations: {exc}"
        )
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)
