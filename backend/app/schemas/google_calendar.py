from pydantic import BaseModel
from typing import Optional

class GoogleConnectRequest(BaseModel):
    code: str

class GoogleStatusResponse(BaseModel):
    connected: bool
    email: Optional[str] = None
    enabled: bool = True
