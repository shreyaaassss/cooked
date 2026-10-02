from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.models.database import get_db
from backend.models.mandate import SpendMandate
from backend.models.pantry import PantryStaple
from backend.models.user import User
from backend.services.auth import AuthError, hash_pin, validate_pin, validate_username, verify_pin

router = APIRouter()

DEFAULT_PANTRY_STAPLES = ["salt", "turmeric", "cumin seeds", "black pepper", "cooking oil", "sugar"]


class SignupRequest(BaseModel):
    username: str
    pin: str


class LoginRequest(BaseModel):
    username: str
    pin: str


class AuthResponse(BaseModel):
    user_id: str
    username: str


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: Session = Depends(get_db)):
    try:
        username = validate_username(req.username)
        pin = validate_pin(req.pin)
    except AuthError as e:
        raise HTTPException(400, str(e))

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(409, "That username is taken.")

    user = User(name=username, username=username, pin_hash=hash_pin(pin))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That username is taken.")
    db.refresh(user)

    # New accounts start with the same sensible defaults the old single-user
    # demo seed had, so a fresh signup isn't a cold, empty pantry/no-limits
    # account with nothing to compare against.
    for staple in DEFAULT_PANTRY_STAPLES:
        db.add(PantryStaple(user_id=user.id, ingredient_name=staple, always_have=True))
    db.add(SpendMandate(user_id=user.id, platform_scope="both", cap_amount=800, auto_approve_threshold=500))
    db.commit()

    return AuthResponse(user_id=str(user.id), username=username)


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        username = validate_username(req.username)
        pin = validate_pin(req.pin)
    except AuthError as e:
        raise HTTPException(400, str(e))

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.pin_hash or not verify_pin(pin, user.pin_hash):
        raise HTTPException(401, "Wrong username or PIN.")

    return AuthResponse(user_id=str(user.id), username=username)
