from pydantic import BaseModel
from typing import List, Optional, Any

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserBase(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    role: str
    permissions: Any = []

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: str
    status: str
    date_added: str

    class Config:
        from_attributes = True

class OwnerBase(BaseModel):
    type: str
    name: str
    cni: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: str
    notes: Optional[str] = None
    avatar_url: Optional[str] = None

class OwnerCreate(OwnerBase):
    id: str

class Owner(OwnerBase):
    id: str

    class Config:
        from_attributes = True

class PropertyBase(BaseModel):
    owner_id: str
    name: str
    type: str
    address: str
    surface: int
    units: int
    status: str
    transaction_type: str = "Location"
    price: Optional[float] = None
    caution_amount: Optional[float] = None
    commission_rate: Optional[float] = None
    tenant_name: Optional[str] = None
    tenant_phone: Optional[str] = None

class PropertyCreate(PropertyBase):
    id: str

class Property(PropertyBase):
    id: str

    class Config:
        from_attributes = True

class TenantBase(BaseModel):
    property_id: str
    name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    rent_amount: float
    caution_amount: float
    entry_date: Optional[str] = None

class TenantCreate(TenantBase):
    id: str

class Tenant(TenantBase):
    id: str

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    property_id: Optional[str] = None
    type: str
    amount: float
    date: str
    description: str
    motif: Optional[str] = None

class TransactionCreate(TransactionBase):
    id: str

class Transaction(TransactionBase):
    id: str

    class Config:
        from_attributes = True

class AgencySettingsBase(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    currency: Optional[str] = None
    commission_rate: Optional[float] = None
    nif: Optional[str] = None
    slogan: Optional[str] = None
    logo_base64: Optional[str] = None

class AgencySettings(AgencySettingsBase):
    id: int

    class Config:
        from_attributes = True
