from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class NotificationType(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"
    ORDER = "order"
    BOOKING = "booking"
    PAYMENT = "payment"
    SYSTEM = "system"
    PROMO = "promo"
    REMINDER = "reminder"
    OPERATOR_ALERT = "operator_alert"
    PROMOTION = "promotion"
    PROMOTION_PENDING = "promotion_pending"

class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"

class Notification(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    title: str
    message: str
    notification_type: NotificationType
    channel: NotificationChannel = NotificationChannel.IN_APP
    data: Dict[str, Any] = {}  # Additional data (order_id, booking_id, etc.)
    is_read: bool = False
    read_at: Optional[datetime] = None
    action_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    notification_type: NotificationType
    channel: NotificationChannel = NotificationChannel.IN_APP
    data: Dict[str, Any] = {}
    action_url: Optional[str] = None

class SupportChat(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    user_name: str
    user_email: str
    subject: str
    status: str = "open"  # open, in_progress, resolved, closed
    priority: str = "normal"  # low, normal, high, urgent
    category: Optional[str] = None
    assigned_to: Optional[str] = None
    messages: List[Dict[str, Any]] = []  # [{sender, message, timestamp, attachments}]
    last_message_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class FAQ(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    question: str
    answer: str
    category: str
    order: int = 0
    is_active: bool = True
    helpful_count: int = 0
    not_helpful_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class News(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    title: str
    content: str
    summary: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    is_published: bool = False
    published_at: Optional[datetime] = None
    featured: bool = False
    views: int = 0
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
