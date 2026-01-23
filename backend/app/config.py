"""
Configuración centralizada del bot.
Todas las variables de entorno y settings van aquí.
"""
import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass
class Settings:
    """Configuración del bot cargada desde variables de entorno."""
    
    # Google Cloud / Vertex AI
    project_id: str = os.getenv("GCP_PROJECT_ID", "silken-fortress-479315-b0")
    location: str = os.getenv("GCP_LOCATION", "us-central1")
    model_name: str = os.getenv("MODEL_NAME", "gemini-2.5-flash")
    
    # WhatsApp / Meta
    meta_token: str = os.getenv("META_TOKEN", "EAAMGeGUHHVcBQAmFT6hKMVzrinHkHdFZAboMXZBDKHrKsZC3hmaF5MsPc5PLcOMUOHHBfEpvPitssg839eR2raslr6mOSwio41oMcutBIyOkorw6szTKFJbo3B8B8MJbWxmzMYF8VsxvtqPvhX4oiEEgphcpuP2NL2AYy6eA1ifKMQZC6gNoJCVi0TUNgwZDZD")
    phone_number_id: str = os.getenv("PHONE_NUMBER_ID", "916289234901254")
    verify_token: str = os.getenv("VERIFY_TOKEN", "cabañas123")
    
    # WuBook (para API real cuando esté lista)
    wubook_user: str = os.getenv("ZAK_USER", "")
    wubook_pass: str = os.getenv("ZAK_PASS", "")
    wubook_rib: str = os.getenv("ZAK_RIB", "")
    use_mock_mode: bool = os.getenv("USE_MOCK_MODE", "true").lower() == "true"
    
    # Agent Settings
    max_tool_turns: int = int(os.getenv("MAX_TOOL_TURNS", "5"))
    history_limit: int = int(os.getenv("HISTORY_LIMIT", "30"))
    
    # Timezone
    timezone: str = os.getenv("TIMEZONE", "America/Santiago")


@lru_cache()
def get_settings() -> Settings:
    """
    Singleton para obtener la configuración.
    Se cachea para no leer env vars múltiples veces.
    """
    return Settings()


# Acceso directo para imports más limpios
settings = get_settings()
