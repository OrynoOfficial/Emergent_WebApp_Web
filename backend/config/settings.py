from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    # Server Configuration
    PORT: int = 8001
    HOST: str = "0.0.0.0"
    
    # MongoDB Configuration
    MONGO_URL: str
    MONGO_DB_NAME: str = "oryno_webapp"
    
    # JWT Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for better UX
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30  # 30 days for persistent sessions
    
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()