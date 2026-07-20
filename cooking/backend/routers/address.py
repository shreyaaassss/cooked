from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.zepto_service import ZeptoService
from backend.services.swiggy_service import SwiggyInstamartService

router = APIRouter()

zepto = ZeptoService()
swiggy = SwiggyInstamartService()


@router.get("/zepto")
async def list_zepto_addresses():
    """List saved Zepto delivery addresses."""
    try:
        result = await zepto.get_addresses()
        addresses = result.get("addresses", []) if isinstance(result, dict) else result
        return {"platform": "zepto", "addresses": addresses if isinstance(addresses, list) else []}
    except Exception as e:
        raise HTTPException(502, f"Zepto address fetch failed: {e}")


@router.post("/zepto/select")
async def select_zepto_address(address_id: str):
    """Select a Zepto delivery address."""
    try:
        result = await zepto.select_address(address_id)
        return {"platform": "zepto", "selected": address_id, "result": result}
    except Exception as e:
        raise HTTPException(502, f"Zepto address select failed: {e}")


class ZeptoAddressRequest(BaseModel):
    type: str = Field(default="HOME", description="HOME, WORK, or OTHER")
    name: str = Field(..., description="Label like 'My Home'")
    flat_details: str = Field(..., description="Flat/house number")
    building_name: str = Field(..., description="Building or society name")
    landmark: str = Field(default="", description="Nearby landmark")
    latitude: float = Field(...)
    longitude: float = Field(...)
    formatted_address: str = Field(..., description="Full address string")
    short_address: str = Field(..., description="Short area, city")
    contact_name: str = Field(default="")
    contact_number: str = Field(default="")


@router.post("/zepto/add")
async def add_zepto_address(req: ZeptoAddressRequest):
    """Add a new Zepto delivery address."""
    try:
        args = {
            "type": req.type,
            "name": req.name,
            "flatDetails": req.flat_details,
            "buildingName": req.building_name,
            "latitude": req.latitude,
            "longitude": req.longitude,
            "formattedAddress": req.formatted_address,
            "shortAddress": req.short_address,
        }
        if req.landmark:
            args["landmark"] = req.landmark
        if req.contact_name:
            args["contactName"] = req.contact_name
        if req.contact_number:
            args["contactNumber"] = req.contact_number

        result = zepto._run_mcp("add_saved_address", args)
        return {"platform": "zepto", "result": result}
    except Exception as e:
        raise HTTPException(502, f"Zepto address add failed: {e}")


@router.get("/zepto/serviceability")
async def check_zepto_serviceability(latitude: float, longitude: float):
    """Check if Zepto services a location."""
    try:
        result = zepto._run_mcp("get_location_serviceability", {
            "latitude": latitude,
            "longitude": longitude,
        })
        return {"platform": "zepto", "serviceable": True, "result": result}
    except Exception as e:
        raise HTTPException(502, f"Zepto serviceability check failed: {e}")


@router.get("/swiggy")
async def list_swiggy_addresses():
    """List saved Swiggy delivery addresses."""
    try:
        result = await swiggy.get_addresses()
        addresses = result.get("addresses", []) if isinstance(result, dict) else result
        return {"platform": "swiggy", "addresses": addresses if isinstance(addresses, list) else []}
    except Exception as e:
        raise HTTPException(502, f"Swiggy address fetch failed: {e}")
