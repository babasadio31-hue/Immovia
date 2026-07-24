from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import os
from jose import JWTError, jwt

from . import models, schemas, security, database

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    if current_user.status != "Actif":
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.status != "Actif":
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@router.post("/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user.password)
    import uuid
    from datetime import date
    
    new_user = models.User(
        id=str(uuid.uuid4()),
        name=user.name,
        email=user.email,
        phone=user.phone,
        password_hash=hashed_password,
        role=user.role if user.role else "Administrateur",
        status="Actif",
        permissions=user.permissions,
        date_added=str(date.today())
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Envoi de l'email de confirmation
    try:
        from . import email_service
        subject = "Bienvenue sur Immovi - Confirmation d'inscription"
        html_content = f"""
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto;'>
            <h2 style='color: #2E5BFF;'>Bienvenue sur Immovi, {{user.name}} !</h2>
            <p>Nous sommes ravis de vous compter parmi nous. Votre compte agence a bien été créé.</p>
            <div style='background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;'>
                <p><strong>Vos identifiants :</strong></p>
                <p>Email : {{user.email}}</p>
            </div>
            <p><strong>🎁 Votre essai gratuit de 3 jours vient de commencer !</strong></p>
            <p>Vous avez un accès complet à toutes les fonctionnalités pendant cette période pour découvrir la puissance de notre plateforme de gestion immobilière.</p>
            <p>À l'issue de ces 3 jours, vous serez invité à souscrire à l'un de nos abonnements pour continuer à utiliser le service.</p>
            <br>
            <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
            <p>L'équipe Immovi</p>
        </div>
        """
        email_service.send_email(user.email, subject, html_content)
    except Exception as e:
        print("Erreur envoi email bienvenue:", e)

    return new_user

@router.get("/users", response_model=list[schemas.User])
def read_all_users(current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "Administrateur":
        raise HTTPException(status_code=403, detail="Not authorized to view all users")
    return db.query(models.User).all()

@router.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: str, user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "Administrateur" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")
    
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.name is not None: db_user.name = user_update.name
    if user_update.phone is not None: db_user.phone = user_update.phone
    if user_update.email is not None: db_user.email = user_update.email
    if user_update.role is not None: db_user.role = user_update.role
    if user_update.status is not None: db_user.status = user_update.status
    if user_update.permissions is not None: db_user.permissions = user_update.permissions
    if user_update.password is not None and len(user_update.password) > 0:
        db_user.password_hash = security.get_password_hash(user_update.password)
        
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: models.User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != "Administrateur" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")
        
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted"}
