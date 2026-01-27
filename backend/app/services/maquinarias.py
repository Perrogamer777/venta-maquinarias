"""
Servicio de Maquinarias - Consultas a Firestore.
"""
import logging
from typing import List, Optional
from firebase_admin import firestore
from app.services.firebase import db

logger = logging.getLogger(__name__)


def search_maquinarias(query: str, limit: int = 10) -> List[dict]:
    """
    Busca maquinarias por nombre, categoría o tags.
    Si el query es genérico ("todas", "catalogo"), devuelve las últimas agregadas.
    
    Args:
        query: Término de búsqueda
        limit: Máximo de resultados (default 10)
    
    Returns:
        Lista de maquinarias que coinciden
    """
    try:
        query_lower = query.lower().strip()
        results = []
        
        # Palabras clave para mostrar todo el catálogo
        generic_keywords = ["todas", "todo", "maquinas", "máquinas", "catalogo", "catálogo", "disponible", "disponibles", "lista", "ver", "conocer"]
        is_generic = any(keyword in query_lower for keyword in generic_keywords) or len(query_lower) < 3
        
        # Obtener todas las maquinarias activas
        docs = db.collection("maquinarias").where("activa", "==", True).stream()
        
        all_docs = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            all_docs.append(data)
            
        logger.info(f"📊 Total maquinarias activas encontradas en BD: {len(all_docs)}")
            
        if is_generic:
            # Si es búsqueda genérica, devolver las últimas agregadas (o random si prefieres)
            logger.info(f"Búsqueda genérica detectada: '{query}' -> Devolviendo todo")
            return all_docs[:limit]
            
        # Filtrado específico
        for data in all_docs:
            # Buscar en nombre, categoría, descripción y tags
            nombre = data.get("nombre", "").lower()
            categoria = data.get("categoria", "").lower()
            descripcion = data.get("descripcion", "").lower()
            tags = [t.lower() for t in data.get("tags", [])]
            
            # Coincidencia en cualquier campo
            if (query_lower in nombre or 
                query_lower in categoria or 
                query_lower in descripcion or
                any(query_lower in tag for tag in tags)):
                results.append(data)
                
                if len(results) >= limit:
                    break
        
        # Si no hubo resultados textuales pero tenemos docs, y la query no era basura total
        if not results and len(query_lower) > 2:
            logger.info(f"Sin resultados exactos para '{query}'. Probando coincidencia parcial laxa.")
            pass # Podríamos agregar lógica fuzzy aquí, pero por ahora devolvemos vacío
            
        logger.info(f"🔍 Búsqueda '{query}': {len(results)} resultados")
        return results
        
    except Exception as e:
        logger.error(f"Error buscando maquinarias: {e}")
        return []


def get_maquinaria(maquinaria_id: str) -> Optional[dict]:
    """
    Obtiene una maquinaria por su ID.
    
    Args:
        maquinaria_id: ID del documento en Firestore
    
    Returns:
        Datos de la maquinaria o None
    """
    try:
        doc = db.collection("maquinarias").document(maquinaria_id).get()
        
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            logger.info(f"Maquinaria obtenida: {data.get('nombre')}")
            return data
        else:
            logger.warning(f"Maquinaria no encontrada: {maquinaria_id}")
            return None
            
    except Exception as e:
        logger.error(f"Error obteniendo maquinaria: {e}")
        return None


def get_maquinarias_by_category(category: str, limit: int = 10) -> List[dict]:
    """
    Obtiene maquinarias por categoría.
    
    Args:
        category: Nombre de la categoría
        limit: Máximo de resultados
    
    Returns:
        Lista de maquinarias de esa categoría
    """
    try:
        results = []
        docs = (
            db.collection("maquinarias")
            .where("activa", "==", True)
            .where("categoria", "==", category)
            .limit(limit)
            .stream()
        )
        
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        
        logger.info(f"Categoría '{category}': {len(results)} maquinarias")
        return results
        
    except Exception as e:
        logger.error(f"Error obteniendo por categoría: {e}")
        return []


def get_all_categories() -> List[str]:
    """
    Obtiene todas las categorías disponibles.
    
    Returns:
        Lista de nombres de categorías
    """
    try:
        categories = set()
        docs = db.collection("maquinarias").where("activa", "==", True).stream()
        
        for doc in docs:
            data = doc.to_dict()
            if "categoria" in data:
                categories.add(data["categoria"])
        
        return sorted(list(categories))
        
    except Exception as e:
        logger.error(f"Error obteniendo categorías: {e}")
        return []


def format_maquinaria_for_chat(maquinaria: dict) -> str:
    """
    Formatea una maquinaria para mostrar en chat.
    
    Args:
        maquinaria: Datos de la maquinaria
    
    Returns:
        Texto formateado para WhatsApp
    """
    nombre = maquinaria.get("nombre", "Sin nombre")
    precio = maquinaria.get("precioReferencia", 0)
    categoria = maquinaria.get("categoria", "")
    descripcion = maquinaria.get("descripcion", "")[:150]
    
    precio_fmt = f"${precio:,.0f}".replace(",", ".") if precio else "Consultar"
    
    return f"""🚜 *{nombre}*
📂 {categoria}
📝 {descripcion}...
💰 Precio referencial: {precio_fmt} + IVA"""
