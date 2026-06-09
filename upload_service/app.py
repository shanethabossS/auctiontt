from __future__ import annotations

import hashlib
import json
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest
from urllib.request import urlopen

import jwt
import psycopg
from fastapi import Depends, FastAPI, File, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, ImageOps

UPLOAD_DIR = Path(os.getenv("AUCTIONSITE_UPLOAD_DIR", "/opt/auctionsite/uploads"))
PUBLIC_BASE = os.getenv("AUCTIONSITE_PUBLIC_BASE", "/uploads")
MAX_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
VARIANTS = {
    "thumb": 320,
    "card": 640,
    "detail": 1280,
}

DB_DSN = os.getenv(
    "AUCTIONSITE_DB_DSN",
    "postgresql://auction_admin:auction_admin_pass@127.0.0.1:55432/auctionsite",
)
JWT_SECRET = os.getenv("AUCTIONSITE_JWT_SECRET", "dev-only-secret-change-me")
JWT_ALG = "HS256"
ACCESS_TTL_MINUTES = int(os.getenv("AUCTIONSITE_ACCESS_TTL_MINUTES", "20"))
REFRESH_TTL_DAYS = int(os.getenv("AUCTIONSITE_REFRESH_TTL_DAYS", "14"))
ACCESS_COOKIE_NAME = os.getenv("AUCTIONSITE_ACCESS_COOKIE_NAME", "auctiontt_access_token")
REFRESH_COOKIE_NAME = os.getenv("AUCTIONSITE_REFRESH_COOKIE_NAME", "auctiontt_refresh_token")
COOKIE_DOMAIN = os.getenv("AUCTIONSITE_COOKIE_DOMAIN", "").strip() or None
COOKIE_SAMESITE = os.getenv("AUCTIONSITE_COOKIE_SAMESITE", "lax").strip().lower()
COOKIE_SECURE = os.getenv("AUCTIONSITE_COOKIE_SECURE", "true").strip().lower() in {"1", "true", "yes", "on"}
CENTRAL_AUTH_ME_URL = os.getenv(
    "AUCTIONSITE_CENTRAL_AUTH_ME_URL",
    "https://api.sovdigitalgroup.com/api/auth/me",
).strip()
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "AUCTIONSITE_CORS_ORIGINS",
        "https://dealztt.com,https://tpdeals.com,https://www.tpdeals.com",
    ).split(",")
    if origin.strip()
]
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    COOKIE_SAMESITE = "lax"

FYGARO_BUTTON_URL = os.getenv("FYGARO_BUTTON_URL", "").strip()
FYGARO_API_PUBLIC_KEY = os.getenv("FYGARO_API_PUBLIC_KEY", "").strip()
FYGARO_API_SECRET_KEY = os.getenv("FYGARO_API_SECRET_KEY", "").strip()
FYGARO_JWT_KID = os.getenv("FYGARO_JWT_KID", "").strip()
FYGARO_DEFAULT_CURRENCY = os.getenv("FYGARO_DEFAULT_CURRENCY", "TTD").strip().upper()

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AuctionSite Gateway Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "buyer"


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class GoogleCentralAuthRequest(BaseModel):
    token: str
    role: str = "buyer"


class PaymentRequest(BaseModel):
    lot_id: uuid.UUID | None = None
    amount: float
    currency: str | None = None
    client_note: str | None = None
    return_url: str | None = None


class SellerProfileUpsertRequest(BaseModel):
    business_name: str
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    about: str | None = None


class SellerSubmissionRequest(BaseModel):
    category_id: str
    title: str
    description: str
    reserve_price: float = 0
    starting_bid: float = 1
    quantity: int = 1
    image_url: str | None = None
    image_variants: dict[str, Any] | None = None
    city: str | None = None
    state: str | None = None
    shipping_available: bool = False
    pickup_available: bool = True


class WatchlistRequest(BaseModel):
    lot_id: str
    email: str | None = None


class BidRequest(BaseModel):
    lot_id: str
    amount: float


def db_connect() -> psycopg.Connection:
    return psycopg.connect(DB_DSN)


def _normalize_email(raw: str) -> str:
    email = (raw or "").strip().lower()
    if "@" not in email or "." not in email.split("@", 1)[1]:
        raise HTTPException(status_code=422, detail="Email format is invalid")
    return email


def _load_image(file_bytes: bytes) -> Image.Image:
    from io import BytesIO

    try:
        img = Image.open(BytesIO(file_bytes))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        elif img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        return img
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc


def _new_access_token(user: dict[str, Any]) -> tuple[str, str]:
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=ACCESS_TTL_MINUTES)
    claims = {
        "sub": str(user["id"]),
        "email": user["email"],
        "full_name": user["full_name"],
        "role": "authenticated",
        "app_role": user["role"],
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG)
    return token, expires.isoformat()


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_refresh_token(conn: psycopg.Connection, user_id: str) -> str:
    token = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(token)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO api.auth_refresh_tokens(user_id, token_hash, expires_at)
            VALUES (%s, %s, now() + (%s || ' days')::interval)
            """,
            (user_id, token_hash, REFRESH_TTL_DAYS),
        )
    return token


def _revoke_refresh_token(conn: psycopg.Connection, refresh_token: str) -> None:
    token_hash = _hash_refresh_token(refresh_token)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE api.auth_refresh_tokens
            SET revoked_at = now()
            WHERE token_hash = %s
              AND revoked_at IS NULL
            """,
            (token_hash,),
        )


def _session_payload(conn: psycopg.Connection, user: dict[str, Any]) -> dict[str, Any]:
    access_token, expires_at = _new_access_token(user)
    refresh_token = _create_refresh_token(conn, str(user["id"]))
    return {
        "user": {
            "id": str(user["id"]),
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        },
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at,
        "token_type": "Bearer",
    }


def _cookie_kwargs(*, path: str, max_age: int) -> dict[str, Any]:
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": path,
        "max_age": max_age,
        "domain": COOKIE_DOMAIN,
    }


def _set_session_cookies(response: Response, session: dict[str, Any]) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=session["access_token"],
        **_cookie_kwargs(path="/", max_age=ACCESS_TTL_MINUTES * 60),
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=session["refresh_token"],
        **_cookie_kwargs(path="/auth", max_age=REFRESH_TTL_DAYS * 24 * 60 * 60),
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/auth", domain=COOKIE_DOMAIN)


def _resolve_refresh_token(request: Request, payload: RefreshRequest | None) -> str | None:
    from_payload = (payload.refresh_token or "").strip() if payload else ""
    if from_payload:
        return from_payload
    return (request.cookies.get(REFRESH_COOKIE_NAME) or "").strip() or None


def _extract_central_user(raw_payload: dict[str, Any]) -> dict[str, str]:
    candidate = raw_payload.get("user") if isinstance(raw_payload.get("user"), dict) else raw_payload
    if not isinstance(candidate, dict):
        raise HTTPException(status_code=401, detail="Central auth payload is invalid")

    email = str(candidate.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Central auth did not return email")

    full_name = (
        str(candidate.get("full_name") or candidate.get("name") or candidate.get("display_name") or "").strip()
    )
    if not full_name:
        full_name = email.split("@", 1)[0] or "DealzTT User"

    return {"email": email, "full_name": full_name}


def _fetch_central_user(access_token: str) -> dict[str, str]:
    token = access_token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Missing Google token")

    request = UrlRequest(
        CENTRAL_AUTH_ME_URL,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "auctiontt-gateway/1.0",
        },
    )

    try:
        with urlopen(request, timeout=12) as upstream:
            payload = json.loads(upstream.read().decode("utf-8") or "{}")
            if not isinstance(payload, dict):
                raise HTTPException(status_code=401, detail="Central auth response is invalid")
            return _extract_central_user(payload)
    except HTTPError as exc:
        detail = "Central auth rejected token"
        if exc.code >= 500:
            detail = "Central auth is unavailable"
        raise HTTPException(status_code=401, detail=detail) from exc
    except URLError as exc:
        raise HTTPException(status_code=503, detail="Could not reach central auth service") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Central auth response was not valid JSON") from exc


def _require_auth(request: Request, authorization: str = Header(default="")) -> dict[str, Any]:
    token = ""
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    else:
        token = (request.cookies.get(ACCESS_COOKIE_NAME) or "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc
    if claims.get("role") != "authenticated":
        raise HTTPException(status_code=403, detail="Token role not allowed")
    return claims


def _build_fygaro_checkout_url(
    *,
    amount: float,
    currency: str,
    order_id: str,
    user_id: str,
    user_email: str,
    client_note: str | None,
) -> str:
    if not FYGARO_BUTTON_URL:
        raise HTTPException(status_code=503, detail="Fygaro is not configured on server yet")

    amount_text = f"{amount:.2f}"
    note = (client_note or "").strip()

    if FYGARO_API_SECRET_KEY and FYGARO_JWT_KID:
        jwt_payload = {
            "amount": amount_text,
            "currency": currency,
            "client_reference": user_email,
            "custom_reference": order_id,
            "client_note": note,
            "metadata": {"user_id": user_id},
            "iat": int(datetime.now(UTC).timestamp()),
        }
        headers = {"typ": "JWT", "alg": "HS256", "kid": FYGARO_JWT_KID}
        signed = jwt.encode(jwt_payload, FYGARO_API_SECRET_KEY, algorithm="HS256", headers=headers)
        return f"{FYGARO_BUTTON_URL}?jwt={signed}"

    query = urlencode(
        {
            "amount": amount_text,
            "client_reference": user_email,
            "custom_reference": order_id,
            "client_note": note,
        }
    )
    return f"{FYGARO_BUTTON_URL}?{query}"


@app.get("/health-upload")
def health_upload() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/time/now")
def time_now() -> dict[str, str]:
    return {"server_time": datetime.now(UTC).isoformat()}


@app.post("/auth/register")
def auth_register(payload: RegisterRequest, response: Response) -> dict[str, Any]:
    try:
        with db_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, full_name, email, role
                    FROM api.register_user(%s, %s, %s, %s)
                    """,
                    (payload.full_name, _normalize_email(payload.email), payload.password, payload.role),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=400, detail="Unable to register user")
                user = {
                    "id": row[0],
                    "full_name": row[1],
                    "email": row[2],
                    "role": row[3],
                }
                session = _session_payload(conn, user)
                _set_session_cookies(response, session)
                return session
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/auth/login")
def auth_login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, email, role
                FROM api.login_user(%s, %s)
                """,
                (_normalize_email(payload.email), payload.password),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            user = {
                "id": row[0],
                "full_name": row[1],
                "email": row[2],
                "role": row[3],
            }
            session = _session_payload(conn, user)
            _set_session_cookies(response, session)
            return session


@app.post("/auth/google/central")
def auth_google_central(payload: GoogleCentralAuthRequest, response: Response) -> dict[str, Any]:
    profile = _fetch_central_user(payload.token)
    email = _normalize_email(profile["email"])
    full_name = profile["full_name"]
    role = (payload.role or "buyer").strip().lower()
    if role not in {"buyer", "seller"}:
        role = "buyer"

    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, full_name, email, role
                FROM api.site_users
                WHERE lower(email) = lower(%s)
                LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()

            if not row:
                generated_password = secrets.token_urlsafe(24)
                cur.execute(
                    """
                    SELECT id, full_name, email, role
                    FROM api.register_user(%s, %s, %s, %s)
                    """,
                    (full_name, email, generated_password, role),
                )
                row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=500, detail="Could not create session user")

            user = {
                "id": row[0],
                "full_name": row[1],
                "email": row[2],
                "role": row[3],
            }
            session = _session_payload(conn, user)
            _set_session_cookies(response, session)
            return session


@app.post("/auth/refresh")
def auth_refresh(request: Request, response: Response, payload: RefreshRequest | None = None) -> dict[str, Any]:
    refresh_token = _resolve_refresh_token(request, payload)
    if not refresh_token:
        _clear_session_cookies(response)
        raise HTTPException(status_code=401, detail="Missing refresh token")

    token_hash = _hash_refresh_token(refresh_token)
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT rt.id, u.id, u.full_name, u.email, u.role
                FROM api.auth_refresh_tokens rt
                JOIN api.site_users u ON u.id = rt.user_id
                WHERE rt.token_hash = %s
                  AND rt.revoked_at IS NULL
                  AND rt.expires_at > now()
                LIMIT 1
                """,
                (token_hash,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Invalid refresh token")

            refresh_row_id = row[0]
            user = {
                "id": row[1],
                "full_name": row[2],
                "email": row[3],
                "role": row[4],
            }

            cur.execute(
                "UPDATE api.auth_refresh_tokens SET revoked_at = now() WHERE id = %s",
                (refresh_row_id,),
            )
            session = _session_payload(conn, user)
            _set_session_cookies(response, session)
            return session


@app.post("/auth/logout")
def auth_logout(request: Request, response: Response, payload: RefreshRequest | None = None) -> dict[str, str]:
    refresh_token = _resolve_refresh_token(request, payload)
    if refresh_token:
        with db_connect() as conn:
            _revoke_refresh_token(conn, refresh_token)
    _clear_session_cookies(response)
    return {"status": "ok"}


@app.post("/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    _ = claims

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    source = _load_image(content)

    image_id = uuid.uuid4().hex
    variants: dict[str, dict[str, Any]] = {}

    for key, width in VARIANTS.items():
        clone = source.copy()
        clone.thumbnail((width, width * 3), Image.Resampling.LANCZOS)
        filename = f"{image_id}_{key}.webp"
        output = UPLOAD_DIR / filename
        clone.save(output, "WEBP", quality=80, method=6)

        variants[key] = {
            "url": f"{PUBLIC_BASE}/{filename}",
            "width": clone.width,
            "height": clone.height,
            "format": "webp",
            "bytes": output.stat().st_size,
        }

    return {
        "image_id": image_id,
        "image_url": variants["detail"]["url"],
        "image_variants": variants,
    }


@app.post("/payment/fygaro-link")
def payment_fygaro_link(
    payload: PaymentRequest,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    amount = round(float(payload.amount), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    currency = (payload.currency or FYGARO_DEFAULT_CURRENCY).strip().upper()
    user_id = claims.get("sub")
    user_email = claims.get("email", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")

    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api.payment_orders(user_id, lot_id, provider, amount, currency, status, metadata)
                VALUES (%s, %s, 'fygaro', %s, %s, 'pending', %s::jsonb)
                RETURNING id
                """,
                (
                    user_id,
                    str(payload.lot_id) if payload.lot_id else None,
                    amount,
                    currency,
                    '{"source":"web"}',
                ),
            )
            row = cur.fetchone()
            order_id = str(row[0])

            checkout_url = _build_fygaro_checkout_url(
                amount=amount,
                currency=currency,
                order_id=order_id,
                user_id=str(user_id),
                user_email=str(user_email),
                client_note=payload.client_note,
            )

            cur.execute(
                """
                UPDATE api.payment_orders
                SET checkout_url = %s,
                    provider_reference = %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (checkout_url, order_id, order_id),
            )

    return {
        "provider": "fygaro",
        "order_id": order_id,
        "checkout_url": checkout_url,
        "public_key": FYGARO_API_PUBLIC_KEY,
    }


@app.get("/me/seller-profile")
def get_seller_profile(claims: dict[str, Any] = Depends(_require_auth)) -> dict[str, Any]:
    user_id = claims.get("sub")
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, user_id, business_name, phone, city, state, about, verified
                FROM api.seller_profiles
                WHERE user_id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cur.fetchone()
            if not row:
                return {"profile": None}
            return {
                "profile": {
                    "id": str(row[0]),
                    "user_id": str(row[1]),
                    "business_name": row[2],
                    "phone": row[3],
                    "city": row[4],
                    "state": row[5],
                    "about": row[6],
                    "verified": row[7],
                }
            }


@app.post("/me/seller-profile")
def upsert_seller_profile(
    payload: SellerProfileUpsertRequest,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    user_id = claims.get("sub")
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api.seller_profiles (user_id, business_name, phone, city, state, about)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id)
                DO UPDATE SET
                  business_name = EXCLUDED.business_name,
                  phone = EXCLUDED.phone,
                  city = EXCLUDED.city,
                  state = EXCLUDED.state,
                  about = EXCLUDED.about
                RETURNING id, user_id, business_name, phone, city, state, about, verified
                """,
                (
                    user_id,
                    payload.business_name.strip(),
                    payload.phone,
                    payload.city,
                    payload.state,
                    payload.about,
                ),
            )
            row = cur.fetchone()
    return {
        "profile": {
            "id": str(row[0]),
            "user_id": str(row[1]),
            "business_name": row[2],
            "phone": row[3],
            "city": row[4],
            "state": row[5],
            "about": row[6],
            "verified": row[7],
        }
    }


@app.get("/me/submissions")
def list_my_submissions(
    limit: int = 8,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    user_id = claims.get("sub")
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM api.seller_profiles WHERE user_id = %s LIMIT 1", (user_id,))
            profile = cur.fetchone()
            if not profile:
                return {"submissions": []}
            cur.execute(
                """
                SELECT id, title, submission_status, created_at
                FROM api.seller_item_submissions
                WHERE seller_profile_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (profile[0], max(1, min(limit, 50))),
            )
            rows = cur.fetchall()
    return {
        "submissions": [
            {
                "id": str(r[0]),
                "title": r[1],
                "submission_status": r[2],
                "created_at": r[3].isoformat(),
            }
            for r in rows
        ]
    }


@app.post("/me/submissions")
def create_submission(
    payload: SellerSubmissionRequest,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    user_id = claims.get("sub")
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM api.seller_profiles WHERE user_id = %s LIMIT 1", (user_id,))
            profile = cur.fetchone()
            if not profile:
                raise HTTPException(status_code=400, detail="Create seller profile first")

            cur.execute(
                """
                INSERT INTO api.seller_item_submissions (
                  seller_profile_id, category_id, title, description,
                  reserve_price, starting_bid, quantity, image_url, image_variants,
                  city, state, shipping_available, pickup_available
                )
                VALUES (%s, %s::uuid, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s)
                RETURNING id, submission_status, created_at
                """,
                (
                    profile[0],
                    payload.category_id,
                    payload.title.strip(),
                    payload.description.strip(),
                    payload.reserve_price,
                    payload.starting_bid,
                    payload.quantity,
                    payload.image_url,
                    json.dumps(payload.image_variants or {}),
                    payload.city,
                    payload.state,
                    payload.shipping_available,
                    payload.pickup_available,
                ),
            )
            row = cur.fetchone()

    return {
        "submission": {
            "id": str(row[0]),
            "submission_status": row[1],
            "created_at": row[2].isoformat(),
        }
    }


@app.post("/watchlists/add")
def add_watchlist(
    payload: WatchlistRequest,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, str]:
    email = _normalize_email(payload.email or claims.get("email", ""))
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO api.watchlists(email, lot_id)
                VALUES (%s, %s::uuid)
                ON CONFLICT (email, lot_id) DO NOTHING
                """,
                (email, payload.lot_id),
            )
    return {"status": "ok"}


@app.post("/bids/place")
def place_bid(
    payload: BidRequest,
    claims: dict[str, Any] = Depends(_require_auth),
) -> dict[str, Any]:
    bidder_name = (claims.get("full_name") or "Verified bidder").strip()[:120]
    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, current_bid, starting_bid, bid_count
                FROM api.place_bid(%s::uuid, %s::text, %s::numeric)
                """,
                (payload.lot_id, bidder_name, payload.amount),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=400, detail="Bid failed")
    return {
        "lot": {
            "id": str(row[0]),
            "current_bid": float(row[1]),
            "starting_bid": float(row[2]),
            "bid_count": int(row[3]),
        }
    }
