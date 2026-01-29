import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'uploads';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Upload] Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Get backend URL
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://venta-maquinarias-backend-925532912523.us-central1.run.app';
    console.log(`[Upload] Using backend: ${backendUrl}`);

    // Convert File to Blob for FormData
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // Create form data for backend
    const backendFormData = new FormData();
    backendFormData.append('file', blob, file.name);
    backendFormData.append('folder', folder);

    // Forward to backend
    const response = await fetch(`${backendUrl}/api/upload-image`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Upload] Backend error: ${response.status} - ${errorText}`);
      return NextResponse.json({ 
        success: false, 
        error: `Error del servidor: ${response.status}` 
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('[Upload] Backend response:', result);

    if (result.success) {
      return NextResponse.json({ success: true, url: result.url });
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Upload failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('[Upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
