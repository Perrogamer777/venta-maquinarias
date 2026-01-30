"""
API endpoints para gestión de reuniones/llamadas programadas.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from app.services.firebase import (
    get_all_meetings,
    get_meeting_by_id,
    update_meeting_status,
    add_meeting_notes,
    schedule_meeting
)

router = APIRouter()


class MeetingUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class MeetingCreate(BaseModel):
    phone: str
    email: str
    preferred_time: str
    type: str = "videollamada"


@router.get("/meetings")
async def get_meetings(
    status: Optional[str] = Query(None, description="Filtrar por estado: pendiente, confirmada, completada, cancelada"),
    limit: int = Query(100, description="Número máximo de reuniones a retornar")
):
    """
    Obtiene todas las reuniones programadas.
    
    Query params:
    - status: Filtrar por estado (opcional)
    - limit: Número máximo de resultados (default: 100)
    """
    try:
        meetings = get_all_meetings(status_filter=status, limit=limit)
        return {"success": True, "meetings": meetings, "count": len(meetings)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    """Obtiene los detalles de una reunión específica."""
    try:
        meeting = get_meeting_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Reunión no encontrada")
        return {"success": True, "meeting": meeting}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, update_data: MeetingUpdate):
    """
    Actualiza una reunión.
    
    Body params:
    - status: Nuevo estado (pendiente, confirmada, completada, cancelada)
    - notes: Notas adicionales
    """
    try:
        # Verificar que la reunión existe
        meeting = get_meeting_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Reunión no encontrada")
        
        # Actualizar estado si se proporciona
        if update_data.status:
            valid_statuses = ["pendiente", "confirmada", "completada", "cancelada"]
            if update_data.status not in valid_statuses:
                raise HTTPException(
                    status_code=400,
                    detail=f"Estado inválido. Debe ser uno de: {', '.join(valid_statuses)}"
                )
            success = update_meeting_status(meeting_id, update_data.status)
            if not success:
                raise HTTPException(status_code=500, detail="Error actualizando estado")
        
        # Actualizar notas si se proporcionan
        if update_data.notes is not None:
            success = add_meeting_notes(meeting_id, update_data.notes)
            if not success:
                raise HTTPException(status_code=500, detail="Error actualizando notas")
        
        # Retornar reunión actualizada
        updated_meeting = get_meeting_by_id(meeting_id)
        return {"success": True, "meeting": updated_meeting}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/meetings")
async def create_meeting(meeting_data: MeetingCreate):
    """
    Crea una nueva reunión manualmente.
    
    Body params:
    - phone: Teléfono del cliente
    - email: Email del cliente
    - preferred_time: Horario preferido
    - type: Tipo de reunión (videollamada o llamada telefónica)
    """
    try:
        success = schedule_meeting(
            phone=meeting_data.phone,
            client_email=meeting_data.email,
            meeting_time=meeting_data.preferred_time,
            meeting_type=meeting_data.type
        )
        
        if success:
            return {"success": True, "message": "Reunión creada exitosamente"}
        else:
            raise HTTPException(status_code=500, detail="Error creando reunión")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/meetings/{meeting_id}")
async def cancel_meeting(meeting_id: str):
    """Cancela una reunión (cambia su estado a 'cancelada')."""
    try:
        meeting = get_meeting_by_id(meeting_id)
        if not meeting:
            raise HTTPException(status_code=404, detail="Reunión no encontrada")
        
        success = update_meeting_status(meeting_id, "cancelada")
        if success:
            return {"success": True, "message": "Reunión cancelada"}
        else:
            raise HTTPException(status_code=500, detail="Error cancelando reunión")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
