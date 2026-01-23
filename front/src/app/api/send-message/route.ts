import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message } = body;

        // Hacer la petición al chatbot desde el servidor (sin CORS)
        const chatbotUrl = 'https://reservas-whatsapp-918499479162.us-central1.run.app/api/send-message';

        const response = await fetch(chatbotUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone, message })
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json(
                { error: 'Error al enviar mensaje', details: error },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error) {
        console.error('Error in proxy:', error);
        return NextResponse.json(
            { error: 'Error del servidor', details: String(error) },
            { status: 500 }
        );
    }
}
