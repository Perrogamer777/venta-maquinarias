"""
Servicio de Maquinarias - Consultas a Firestore.
"""
import logging
from typing import List, Optional
from firebase_admin import firestore
from app.services.firebase import db

import unicodedata

logger = logging.getLogger(__name__)


def normalize_text(text: str) -> str:
    """Elimina acentos y convierte a minúsculas."""
    if not text:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', text)
                   if unicodedata.category(c) != 'Mn').lower().strip()


def search_maquinarias(query: str, limit: int = 10) -> List[dict]:
    """
    Busca maquinarias por nombre, categoría o tags.
    Soporta búsqueda insensible a acentos y sinónimos básicos.
    """
    try:
        query_norm = normalize_text(query)
        results = []
        
        # Mapa de sinónimos comunes en agricultura
        synonyms = {
            "fertilizador": "fertilizante",
            "abonadora": "fertilizante",
            "sembradora": "siembra",
            "rastra": "grada",
            "fumigadora": "nebulizador",
            "fumigacion": "nebulizador",
            "atomizador": "nebulizador",
            "rociador": "nebulizador",
            "triturador": "trituradora",
            "preparacion": "preparacion", # Mapeo directo para asegurar coincidencia
        }
        
        # Expanded query terms
        search_terms = {query_norm}
        for word in query_norm.split():
            if word in synonyms:
                search_terms.add(synonyms[word])
                # También agregar la versión normalizada del sinónimo
                search_terms.add(normalize_text(synonyms[word]))
        
        # Palabras clave para mostrar todo el catálogo
        generic_keywords = ["todas", "todo", "maquinas", "maquinas", "catalogo", "catalogo", "disponible", "disponibles", "lista"]
        is_generic = any(keyword in query_norm for keyword in generic_keywords) or len(query_norm) < 3
        
        # Obtener todas las maquinarias activas
        docs = db.collection("maquinarias").where("activa", "==", True).stream()
        
        all_docs = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            all_docs.append(data)
            
        logger.info(f"📊 Total maquinarias activas encontradas en BD: {len(all_docs)}")
            
        if is_generic:
            logger.info(f"Búsqueda genérica detectada: '{query}' -> Devolviendo todo")
            return all_docs[:limit]
            
        # Filtrado específico
        for data in all_docs:
            nombre = normalize_text(data.get("nombre", ""))
            categoria = normalize_text(data.get("categoria", ""))
            descripcion = normalize_text(data.get("descripcion", ""))
            tags = [normalize_text(t) for t in data.get("tags", [])]
            
            # Verificar si ALGUNO de los términos de búsqueda está en los campos
            match = False
            for term in search_terms:
                if (term in nombre or 
                    term in categoria or 
                    term in descripcion or
                    any(term in tag for tag in tags)):
                    match = True
                    break
            
            if match:
                results.append(data)
                if len(results) >= limit:
                    break
        
        logger.info(f"🔍 Búsqueda '{query}' (norm: {search_terms}): {len(results)} resultados")
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
    descripcion = maquinaria.get("descripcion", "")
    
    precio_fmt = f"${precio:,.0f}".replace(",", ".") if precio else "Consultar"
    
    return f"""🚜 *{nombre}*
📂 {categoria}
📝 {descripcion}
💰 Precio referencial: {precio_fmt} + IVA"""
