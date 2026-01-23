"""
Servicio de scraping - Extrae datos de cabañas del sitio web del cliente.
"""
import requests
from bs4 import BeautifulSoup
import logging
import re
from datetime import datetime
from app.services.firebase import db

logger = logging.getLogger(__name__)

# URL base del sitio del cliente
BASE_URL = "https://cipresecolodge.com"
ECOLODGE_URL = f"{BASE_URL}/ecolodgespa/"


def scrape_homepage() -> dict:
    """Extrae información general del homepage."""
    try:
        response = requests.get(BASE_URL, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Buscar descripción principal
        descripcion = ""
        main_content = soup.find('h1')
        if main_content:
            # Buscar párrafos después del h1
            for sibling in main_content.find_next_siblings('p'):
                descripcion += sibling.get_text(strip=True) + " "
        
        return {
            "descripcion_principal": descripcion.strip()[:1000],  # Limitar tamaño
            "url": BASE_URL
        }
    except Exception as e:
        logger.error(f"Error scraping homepage: {e}")
        return {}


def scrape_servicios() -> list:
    """Extrae información de servicios (Spa, paseos, etc)."""
    try:
        response = requests.get(ECOLODGE_URL, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        servicios = []
        
        # Buscar secciones de servicios (h4 con enlaces)
        for h4 in soup.find_all('h4'):
            nombre = h4.get_text(strip=True)
            if nombre and len(nombre) > 2:
                # Buscar descripción siguiente
                desc_elem = h4.find_next('p')
                descripcion = desc_elem.get_text(strip=True) if desc_elem else ""
                
                servicios.append({
                    "nombre": nombre,
                    "descripcion": descripcion[:500]
                })
        
        return servicios
    except Exception as e:
        logger.error(f"Error scraping servicios: {e}")
        return []


def scrape_reviews() -> list:
    """Extrae reseñas visibles en el sitio."""
    try:
        response = requests.get(BASE_URL, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        reviews = []
        # Las reseñas suelen estar en bloques específicos
        # Esto depende de la estructura exacta del sitio
        
        return reviews
    except Exception as e:
        logger.error(f"Error scraping reviews: {e}")
        return []


def save_scraped_data_to_firestore(data: dict) -> bool:
    """Guarda los datos scrapeados en Firestore."""
    try:
        doc_ref = db.collection("configuracion").document("sitio_web")
        doc_ref.set({
            "homepage": data.get("homepage", {}),
            "servicios": data.get("servicios", []),
            "ultima_actualizacion": datetime.now(),
            "fuente": BASE_URL
        }, merge=True)
        
        logger.info("Datos del sitio web guardados en Firestore")
        return True
    except Exception as e:
        logger.error(f"Error guardando en Firestore: {e}")
        return False


def run_full_scrape() -> dict:
    """
    Ejecuta el scraping completo del sitio.
    Retorna un resumen de lo extraído.
    """
    logger.info(f"Iniciando scraping de {BASE_URL}")
    
    resultado = {
        "homepage": scrape_homepage(),
        "servicios": scrape_servicios(),
        "timestamp": datetime.now().isoformat()
    }
    
    # Guardar en Firestore
    if save_scraped_data_to_firestore(resultado):
        resultado["guardado_en_firestore"] = True
    else:
        resultado["guardado_en_firestore"] = False
    
    logger.info(f"Scraping completado: {len(resultado.get('servicios', []))} servicios encontrados")
    
    return resultado


def get_cached_site_data() -> dict:
    """
    Obtiene los datos cacheados del sitio desde Firestore.
    Útil para el bot cuando necesita info actualizada.
    """
    try:
        doc = db.collection("configuracion").document("sitio_web").get()
        if doc.exists:
            return doc.to_dict()
        return {}
    except Exception as e:
        logger.error(f"Error leyendo datos cacheados: {e}")
        return {}
