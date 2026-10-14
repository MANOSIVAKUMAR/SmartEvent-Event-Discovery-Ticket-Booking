from datetime import datetime, date, timedelta
from enum import Enum
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, Date, Enum as SAEnum
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from jose import jwt
from passlib.context import CryptContext

DATABASE_URL = "sqlite:///./smartevent.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

SECRET_KEY = "smartevent-dev-secret-change-in-production"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"

class NotificationType(str, Enum):
    EVENT = "EVENT"
    BOOKING = "BOOKING"
    PAYMENT = "PAYMENT"
    SYSTEM = "SYSTEM"

class BookingStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    category = Column(String(80), nullable=False)
    location = Column(String(150), nullable=False)
    event_date = Column(Date, nullable=False)
    price = Column(Float, nullable=False)
    popularity = Column(Integer, default=0)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Coupon(Base):
    __tablename__ = "coupons"
    id = Column(Integer, primary_key=True)
    coupon_code = Column(String(50), unique=True, nullable=False)
    discount_type = Column(SAEnum(DiscountType), nullable=False)
    discount_value = Column(Float, nullable=False)
    minimum_booking_amount = Column(Float, default=0)
    expiry_date = Column(Date, nullable=False)
    usage_limit = Column(Integer, default=1)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=True)
    discount_amount = Column(Float, default=0)
    final_amount = Column(Float, nullable=False)
    status = Column(SAEnum(BookingStatus), default=BookingStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    payment_method = Column(String(50), nullable=False)
    payment_status = Column(SAEnum(PaymentStatus), default=PaymentStatus.PENDING)
    transaction_id = Column(String(100), nullable=True)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    review_text = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(SAEnum(NotificationType), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SmartEvent Modules 12-17 API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def seed_data(session: Session):
    if not session.query(Event).count():
        session.add_all([
            Event(name="Chennai Tech Summit", category="Tech", location="Chennai",
                  event_date=date.today()+timedelta(days=20), price=499, popularity=95,
                  description="Technology, AI and software development conference."),
            Event(name="Music Night 2026", category="Music", location="Coimbatore",
                  event_date=date.today()+timedelta(days=12), price=799, popularity=90,
                  description="Live music and entertainment event."),
            Event(name="Business Leaders Meet", category="Business", location="Bengaluru",
                  event_date=date.today()+timedelta(days=30), price=999, popularity=80,
                  description="Networking event for business professionals."),
            Event(name="Sports Fest", category="Sports", location="Chennai",
                  event_date=date.today()+timedelta(days=45), price=299, popularity=75,
                  description="Multi-sport community festival.")
        ])
    if not session.query(Coupon).count():
        session.add_all([
            Coupon(coupon_code="SAVE10", discount_type=DiscountType.PERCENTAGE,
                   discount_value=10, minimum_booking_amount=300,
                   expiry_date=date.today()+timedelta(days=60), usage_limit=100),
            Coupon(coupon_code="FLAT100", discount_type=DiscountType.FIXED,
                   discount_value=100, minimum_booking_amount=500,
                   expiry_date=date.today()+timedelta(days=30), usage_limit=50)
        ])
    session.commit()

with SessionLocal() as s:
    seed_data(s)

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: str
    password: str = Field(min_length=6)

class LoginIn(BaseModel):
    username: str
    password: str

class BookingIn(BaseModel):
    event_id: int
    quantity: int = Field(gt=0, le=20)
    coupon_code: Optional[str] = None

class PaymentIn(BaseModel):
    booking_id: int
    payment_method: str = "SIMULATED_CARD"
    simulate_success: bool = True

class ReviewIn(BaseModel):
    event_id: int
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default="", max_length=1000)

class ReviewUpdate(BaseModel):
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default="", max_length=1000)

def create_token(user_id: int):
    return jwt.encode({"sub": str(user_id), "exp": datetime.utcnow()+timedelta(hours=8)},
                      SECRET_KEY, algorithm=ALGORITHM)

def current_user(token: str, session: Session):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = session.get(User, uid)
    if not user:
        raise HTTPException(401, "User not found")
    return user

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
bearer = HTTPBearer()

def auth(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    session: Session = Depends(db)
):
    return current_user(credentials.credentials, session)

@app.get("/")
def root():
    return {"message": "SmartEvent Modules 12-17 API is running"}

@app.post("/auth/register")
def register(data: RegisterIn, session: Session = Depends(db)):
    if session.query(User).filter((User.username == data.username) | (User.email == data.email)).first():
        raise HTTPException(400, "Username or email already exists")
    user = User(username=data.username, email=data.email,
                hashed_password=pwd_context.hash(data.password))
    session.add(user); session.commit(); session.refresh(user)
    return {"message": "Registered successfully", "token": create_token(user.id)}

@app.post("/auth/login")
def login(data: LoginIn, session: Session = Depends(db)):
    user = session.query(User).filter(User.username == data.username).first()
    if not user or not pwd_context.verify(data.password, user.hashed_password):
        raise HTTPException(401, "Invalid username or password")
    return {"token": create_token(user.id), "username": user.username}

@app.get("/events")
def events(
    search: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    sort_by: str = "date",
    session: Session = Depends(db)
):
    q = session.query(Event)
    if search: q = q.filter(Event.name.ilike(f"%{search}%"))
    if category: q = q.filter(Event.category == category)
    if location: q = q.filter(Event.location.ilike(f"%{location}%"))
    if start_date: q = q.filter(Event.event_date >= start_date)
    if end_date: q = q.filter(Event.event_date <= end_date)
    if sort_by == "price": q = q.order_by(Event.price.asc())
    elif sort_by == "popularity": q = q.order_by(Event.popularity.desc())
    else: q = q.order_by(Event.event_date.asc())
    return q.all()

@app.get("/events/{event_id}")
def get_event(event_id: int, session: Session = Depends(db)):
    event = session.get(Event, event_id)
    if not event: raise HTTPException(404, "Event not found")
    return event

@app.post("/bookings")
def create_booking(data: BookingIn, user: User = Depends(auth), session: Session = Depends(db)):
    event = session.get(Event, data.event_id)
    if not event: raise HTTPException(404, "Event not found")
    total = round(event.price * data.quantity, 2)
    discount = 0
    coupon = None
    if data.coupon_code:
        coupon = session.query(Coupon).filter(Coupon.coupon_code == data.coupon_code.upper()).first()
        if not coupon or not coupon.is_active:
            raise HTTPException(400, "Invalid coupon")
        if coupon.expiry_date < date.today():
            raise HTTPException(400, "Coupon expired")
        if coupon.used_count >= coupon.usage_limit:
            raise HTTPException(400, "Coupon usage limit reached")
        if total < coupon.minimum_booking_amount:
            raise HTTPException(400, f"Minimum booking amount is {coupon.minimum_booking_amount}")
        discount = total * coupon.discount_value / 100 if coupon.discount_type == DiscountType.PERCENTAGE else coupon.discount_value
        discount = min(discount, total)
    final = round(total - discount, 2)
    booking = Booking(user_id=user.id, event_id=event.id, quantity=data.quantity,
                      total_amount=total, coupon_id=coupon.id if coupon else None,
                      discount_amount=discount, final_amount=final)
    session.add(booking); session.commit(); session.refresh(booking)
    session.add(Notification(user_id=user.id, title="Booking Created",
                             message=f"Booking #{booking.id} created. Complete payment to confirm.",
                             notification_type=NotificationType.BOOKING))
    session.commit()
    return booking

@app.post("/payments")
def pay(data: PaymentIn, user: User = Depends(auth), session: Session = Depends(db)):
    booking = session.get(Booking, data.booking_id)
    if not booking or booking.user_id != user.id:
        raise HTTPException(404, "Booking not found")
    transaction = f"SIM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{booking.id}"
    status = PaymentStatus.SUCCESS if data.simulate_success else PaymentStatus.FAILED
    payment = Payment(booking_id=booking.id, payment_method=data.payment_method,
                      payment_status=status, transaction_id=transaction,
                      amount=booking.final_amount)
    session.add(payment)
    if status == PaymentStatus.SUCCESS:
        booking.status = BookingStatus.CONFIRMED
        if booking.coupon_id:
            coupon = session.get(Coupon, booking.coupon_id)
            coupon.used_count += 1
        title, msg = "Payment Successful", f"Payment successful for booking #{booking.id}. Transaction: {transaction}"
    else:
        title, msg = "Payment Failed", f"Payment failed for booking #{booking.id}."
    session.add(Notification(user_id=user.id, title=title, message=msg,
                             notification_type=NotificationType.PAYMENT))
    session.commit(); session.refresh(payment)
    return {"payment": payment, "booking_status": booking.status}

@app.get("/bookings")
def my_bookings(user: User = Depends(auth), session: Session = Depends(db)):
    return session.query(Booking).filter(Booking.user_id == user.id).order_by(Booking.id.desc()).all()

@app.post("/reviews")
def create_review(data: ReviewIn, user: User = Depends(auth), session: Session = Depends(db)):
    event = session.get(Event, data.event_id)
    if not event: raise HTTPException(404, "Event not found")
    attended = session.query(Booking).filter(
        Booking.user_id == user.id, Booking.event_id == data.event_id,
        Booking.status == BookingStatus.CONFIRMED
    ).first()
    if not attended:
        raise HTTPException(403, "Only users with a confirmed booking can review this event")
    if session.query(Review).filter(Review.user_id == user.id, Review.event_id == data.event_id).first():
        raise HTTPException(400, "You already reviewed this event")
    review = Review(user_id=user.id, event_id=data.event_id, rating=data.rating, review_text=data.review_text)
    session.add(review); session.commit(); session.refresh(review)
    return review

@app.get("/events/{event_id}/reviews")
def get_reviews(event_id: int, session: Session = Depends(db)):
    reviews = session.query(Review).filter(Review.event_id == event_id).order_by(Review.created_at.desc()).all()
    avg = sum(r.rating for r in reviews) / len(reviews) if reviews else 0
    return {"average_rating": round(avg, 2), "count": len(reviews), "reviews": reviews}

@app.put("/reviews/{review_id}")
def update_review(review_id: int, data: ReviewUpdate, user: User = Depends(auth), session: Session = Depends(db)):
    review = session.get(Review, review_id)
    if not review or review.user_id != user.id: raise HTTPException(404, "Review not found")
    review.rating, review.review_text = data.rating, data.review_text
    session.commit(); session.refresh(review)
    return review

@app.delete("/reviews/{review_id}")
def delete_review(review_id: int, user: User = Depends(auth), session: Session = Depends(db)):
    review = session.get(Review, review_id)
    if not review or review.user_id != user.id: raise HTTPException(404, "Review not found")
    session.delete(review); session.commit()
    return {"message": "Review deleted"}

@app.get("/notifications")
def notifications(user: User = Depends(auth), session: Session = Depends(db)):
    return session.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id.desc()).all()

@app.put("/notifications/{notification_id}/read")
def mark_read(notification_id: int, user: User = Depends(auth), session: Session = Depends(db)):
    n = session.get(Notification, notification_id)
    if not n or n.user_id != user.id: raise HTTPException(404, "Notification not found")
    n.is_read = True; session.commit()
    return {"message": "Marked as read"}

@app.get("/dashboard")
def dashboard(user: User = Depends(auth), session: Session = Depends(db)):
    bookings = session.query(Booking).filter(Booking.user_id == user.id).all()
    notifications_count = session.query(Notification).filter(
        Notification.user_id == user.id, Notification.is_read == False).count()
    return {
        "username": user.username,
        "total_bookings": len(bookings),
        "confirmed_bookings": sum(1 for b in bookings if b.status == BookingStatus.CONFIRMED),
        "total_spent": round(sum(b.final_amount for b in bookings if b.status == BookingStatus.CONFIRMED), 2),
        "unread_notifications": notifications_count
    }
