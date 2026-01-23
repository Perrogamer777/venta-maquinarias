import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Get backend URL from environment or use default
        const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://reservas-whatsapp-918499479162.us-central1.run.app';

        if (!backendUrl) {
            // If no backend URL configured, return a mock response for now
            console.log('No BACKEND_URL configured. Promotion data:', body);

            return NextResponse.json({
                success: false,
                message: 'Backend URL not configured. Please set BACKEND_URL environment variable.',
                results: body.phones.map((phone: string) => ({
                    phone,
                    status: 'error',
                    error: 'Backend not configured'
                })),
                summary: {
                    total: body.phones.length,
                    sent: 0,
                    failed: body.phones.length
                }
            });
        }

        // Forward request to backend
        const response = await fetch(`${backendUrl}/api/send-promotion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();
        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in send-promotion API:', error);
        return NextResponse.json({
            success: false,
            message: 'Error sending promotion',
            error: String(error),
            summary: {
                total: 0,
                sent: 0,
                failed: 0
            }
        }, { status: 500 });
    }
}
