import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { phone, message } = body;

        // Llamar al backend correcto
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://venta-maquinarias-backend-925532912523.us-central1.run.app';

        console.log('🚀 Sending message to backend:', `${backendUrl}/api/send-whatsapp-message`);

        const response = await fetch(`${backendUrl}/api/send-whatsapp-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone, message })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Backend error:', error);
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
