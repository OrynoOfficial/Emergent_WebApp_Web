from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    
    # MongoDB Configuration
    # Database name resolution order (Emergent platform-injects `DB_NAME`
    # automatically per app; we keep `MONGO_DB_NAME` as a manual override
    # for local dev). At runtime use `settings.effective_db_name`.
    MONGO_URL: str
    DB_NAME: str = ""                      # ← Emergent-injected (per-app prefix)
    MONGO_DB_NAME: str = "oryno_webapp"    # ← manual fallback (local dev)
    
    # JWT Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # short-lived; refresh token covers the rest
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14    # 2-week sliding window via rotation
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    
    # Stripe Configuration
    STRIPE_PUBLISHABLE_KEY: str
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    
    # MTN MoMo Configuration
    MTN_MOMO_PRIMARY_KEY: str
    MTN_MOMO_SECONDARY_KEY: str
    MTN_MOMO_BASE_URL: str = "https://sandbox.momodeveloper.mtn.com"
    MTN_MOMO_CALLBACK_URL: str
    MTN_MOMO_COLLECTION_USER_ID: str = ""
    MTN_MOMO_COLLECTION_API_KEY: str = ""
    MTN_MOMO_DISBURSEMENT_USER_ID: str = ""
    MTN_MOMO_DISBURSEMENT_API_KEY: str = ""
    
    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-central-1"
    AWS_S3_BUCKET: str = "orynofileserver"
    USE_LOCAL_STORAGE: str = "false"
    LOCAL_STORAGE_PATH: str = "/app/webapp-backend/uploads"
    
    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Oryno Platform"
    SMTP_MOCK_MODE: str = "false"
    
    # Frontend URL
    FRONTEND_URL: str = "http://localhost:3000"
    
    # CORS Origins
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'
    
    # Environment
    ENVIRONMENT: str = "development"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    @property
    def effective_db_name(self) -> str:
        """Database name actually used at runtime.

        Emergent injects `DB_NAME` per deployment (e.g.
        `cinema-management-p0-oryno_webapp`) and the Atlas user is only
        authorized on that prefixed name. When present we MUST use it;
        otherwise (local dev / preview) fall back to `MONGO_DB_NAME`.
        """
        return self.DB_NAME.strip() or self.MONGO_DB_NAME
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()