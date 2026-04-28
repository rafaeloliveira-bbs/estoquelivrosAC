from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from typing import Optional

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: int, role: str, filial_id: int, expires_delta: Optional[timedelta] = None) -> tuple[str, int]:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": user_id,
        "role": role,
        "filial_id": filial_id,
        "exp": expire,
        "type": "access"
    }
    
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    expires_in = int((expire - datetime.utcnow()).total_seconds())
    
    return encoded_jwt, expires_in

def create_refresh_token(user_id: int, role: str, filial_id: int) -> str:
    """Create JWT refresh token"""
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": user_id,
        "role": role,
        "filial_id": filial_id,
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role")
        filial_id = payload.get("filial_id")
        token_type = payload.get("type", "access")
        
        if user_id is None:
            return None
        
        return {
            "user_id": user_id,
            "role": role,
            "filial_id": filial_id,
            "type": token_type
        }
    except JWTError:
        return None
