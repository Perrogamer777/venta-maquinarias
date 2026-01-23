import asyncio
import main
from unittest.mock import MagicMock
from vertexai.generative_models import Part

# Mock enviar_mensaje_whatsapp
main.enviar_mensaje_whatsapp = MagicMock(side_effect=lambda tel, msg: print(f"🤖 BOT a {tel}: {msg}"))

# Mock Vertex AI Model
mock_chat = MagicMock()
mock_model = MagicMock()
mock_model.start_chat.return_value = mock_chat
main.model = mock_model

# Helper to create a mock response
def create_mock_response(text=None, function_call=None):
    response = MagicMock()
    response.text = text
    if function_call:
        fc = MagicMock()
        fc.name = function_call["name"]
        fc.args = function_call["args"]
        response.candidates = [MagicMock(function_calls=[fc])]
    else:
        response.candidates = [MagicMock(function_calls=[])]
    return response

async def run_test():
    user_phone = "56912345678"
    
    print("--- TEST 1: Saludo inicial (Sin herramientas) ---")
    mock_chat.send_message.return_value = create_mock_response(text="Hola! Soy Chocolate.")
    await main.procesar_cerebro_ia("Hola", user_phone)
    
    # Verificar que se creó la sesión
    assert user_phone in main.chat_sessions
    print("Sesión creada correctamente.")

    # Resetear mock para el siguiente test
    mock_chat.reset_mock()

    print("\n--- TEST 2: Consulta de disponibilidad (Tool Call -> Respuesta) ---")
    # Simulamos que la PRIMERA llamada devuelve una FunctionCall
    # Y la SEGUNDA llamada (con el resultado de la tool) devuelve texto final
    
    response_tool = create_mock_response(function_call={
        "name": "check_availability",
        "args": {"fecha_inicio": "10/10/2025", "fecha_fin": "12/10/2025"}
    })
    response_final = create_mock_response(text="Hay disponibilidad: Cabaña Lago $100.000")
    
    # Configurar el side_effect del send_message para devolver primero tool, luego texto
    mock_chat.send_message.side_effect = [response_tool, response_final]
    
    await main.procesar_cerebro_ia("Quiero ir el 10 de octubre", user_phone)
    
    # Verificar que se llamó a send_message 2 veces (1 con prompt usuario, 1 con resultado tool)
    assert mock_chat.send_message.call_count == 2
    print("Tool Call manejado correctamente (Bucle funcionó).")

    print("\n--- TEST 3: Memoria (Misma sesión) ---")
    # Resetear mock pero mantener sesión en main.chat_sessions
    mock_chat.send_message.reset_mock()
    mock_model.reset_mock() # Resetear modelo para verificar que no llama start_chat de nuevo
    mock_chat.send_message.side_effect = None
    mock_chat.send_message.return_value = create_mock_response(text="Sí, tiene piscina.")
    
    await main.procesar_cerebro_ia("Tiene piscina?", user_phone)
    
    # Verificar que NO se llamó a start_chat de nuevo (usó la misma sesión)
    mock_model.start_chat.assert_not_called() 
    print("Se reutilizó la sesión de chat (Memoria activa).")

if __name__ == "__main__":
    asyncio.run(run_test())
