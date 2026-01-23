import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return NextResponse.json({
                success: false,
                error: 'Se requiere un prompt'
            }, { status: 400 });
        }

        // Get backend URL from environment or use provided URL
        const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://reservas-whatsapp-918499479162.us-central1.run.app';

        if (!backendUrl) {
            // Return mock response for development/testing
            console.log('No BACKEND_URL configured. Returning mock response for prompt:', prompt);

            return NextResponse.json({
                success: true,
                promotion: {
                    titulo: 'Promoción de Prueba',
                    descripcion: 'Esta es una promoción generada localmente porque el backend no está configurado. Configure BACKEND_URL para usar la generación con IA real.',
                    imagenUrl: ''
                },
                message: 'Backend no configurado - respuesta de prueba'
            });
        }

        // Forward request to backend
        const response = await fetch(`${backendUrl}/api/generate-promotion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        const result = await response.json();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in generate-promotion API:', error);
        return NextResponse.json({
            success: false,
            error: 'Error al generar promoción. Inténtalo de nuevo.'
        }, { status: 500 });
    }
}
