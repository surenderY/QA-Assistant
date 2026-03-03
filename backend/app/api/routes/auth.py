from fastapi import APIRouter, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from pydantic import BaseModel

from app.core.security import create_access_token, verify_password, hash_password

router = APIRouter()


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    password: str


# ── Temporary in-memory user store (replace with DB in Phase 2) ────────────
# In a real app, query the users table from the DB.
DEMO_USER = {
    "username": "admin",
    "hashed_password": hash_password("admin123"),
}


@router.post("/login", response_model=Token, summary="Get access token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 compatible login. Returns a JWT bearer token.

    Demo credentials:
    - username: admin
    - password: admin123
    """
    if form_data.username != DEMO_USER["username"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not verify_password(form_data.password, DEMO_USER["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    token = create_access_token(subject=form_data.username)
    return Token(access_token=token)


@router.get("/me", summary="Get current user info")
async def me(token_data: dict = Depends(lambda: {"id": "admin"})):
    return {"username": token_data.get("id"), "role": "admin"}
