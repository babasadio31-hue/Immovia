from pydantic import BaseModel
from typing import Optional

class OwnerBase(BaseModel):
    type: str
    name: str
    phone: str

class OwnerCreate(OwnerBase):
    id: str

try:
    owner = OwnerCreate(**{"id": "1", "type": "A", "name": "B", "phone": "C", "commissionRate": 10})
    print(owner.model_dump())
except Exception as e:
    print("Error:", e)
