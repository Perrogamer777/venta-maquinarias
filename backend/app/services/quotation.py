"""
Servicio de Cotizaciones - Generación de PDFs.
"""
import logging
import io
import uuid
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from google.cloud import storage

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bucket para almacenar cotizaciones
BUCKET_NAME = "venta-maquinarias-cotizaciones"


def generate_quotation_pdf(
    cliente_nombre: str,
    cliente_email: str,
    cliente_telefono: str,
    maquinaria: dict,
    precio: Optional[float] = None
) -> Optional[str]:
    """
    Genera un PDF de cotización y lo sube a Cloud Storage.
    
    Args:
        cliente_nombre: Nombre del cliente
        cliente_email: Email del cliente
        cliente_telefono: Teléfono del cliente
        maquinaria: Datos de la maquinaria a cotizar
        precio: Precio a cotizar (si None, usa precioReferencia)
    
    Returns:
        URL pública del PDF generado o None si falla
    """
    try:
        # Generar código único de cotización
        codigo = f"COT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        # Usar precio de referencia si no se especifica otro
        precio_final = precio or maquinaria.get("precioReferencia", 0)
        
        # Crear PDF en memoria
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        # Estilos
        styles = getSampleStyleSheet()
        
        # Estilo título empresa
        style_empresa = ParagraphStyle(
            'Empresa',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor("#2E7D32"),  # Verde MACI
            spaceAfter=6
        )
        
        # Estilo subtítulo
        style_subtitulo = ParagraphStyle(
            'Subtitulo',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor("#FF8C00"),  # Naranja
            fontStyle='italic'
        )
        
        # Estilo normal
        style_normal = ParagraphStyle(
            'NormalCustom',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6
        )
        
        # Estilo producto
        style_producto = ParagraphStyle(
            'Producto',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor("#2E7D32"),
            spaceBefore=12,
            spaceAfter=6
        )
        
        # Estilo precio
        style_precio = ParagraphStyle(
            'Precio',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor("#2E7D32"),
            alignment=TA_RIGHT
        )
        
        # Construir contenido
        story = []
        
        # Encabezado
        story.append(Paragraph("INGENIERÍA AGROINDUSTRIAL", style_empresa))
        story.append(Paragraph("Torno – Hidráulica – Estructuras – Repuestos", style_subtitulo))
        story.append(Spacer(1, 0.5*inch))
        
        # Fecha
        fecha = datetime.now().strftime("%d de %B de %Y").replace(
            "January", "Enero").replace("February", "Febrero").replace(
            "March", "Marzo").replace("April", "Abril").replace(
            "May", "Mayo").replace("June", "Junio").replace(
            "July", "Julio").replace("August", "Agosto").replace(
            "September", "Septiembre").replace("October", "Octubre").replace(
            "November", "Noviembre").replace("December", "Diciembre")
        
        story.append(Paragraph(f"San Felipe, {fecha}", ParagraphStyle(
            'Fecha', parent=styles['Normal'], alignment=TA_RIGHT, fontSize=10
        )))
        story.append(Spacer(1, 0.3*inch))
        
        # Datos empresa
        story.append(Paragraph("<b>DE</b>     : INGENIERÍA AGROINDUSTRIAL MACI LTDA.", style_normal))
        story.append(Paragraph(f"<b>PARA</b>  : {cliente_nombre}", style_normal))
        story.append(Paragraph(f"<b>MAIL</b>   : {cliente_email}", style_normal))
        story.append(Paragraph(f"<b>FONO</b>  : {cliente_telefono}", style_normal))
        story.append(Spacer(1, 0.3*inch))
        
        # Introducción
        story.append(Paragraph("De nuestra mayor consideración:", style_normal))
        story.append(Spacer(1, 0.2*inch))
        story.append(Paragraph(
            "Por la presente, tenga a bien recibir nuestra cotización, según vuestra solicitud;",
            style_normal
        ))
        story.append(Spacer(1, 0.3*inch))
        
        # Producto cotizado
        nombre_maquinaria = maquinaria.get("nombre", "Producto")
        story.append(Paragraph(f"❖ {nombre_maquinaria.upper()}", style_producto))
        story.append(Spacer(1, 0.1*inch))
        
        # Especificaciones técnicas
        especificaciones = maquinaria.get("especificacionesTecnicas", "")
        if especificaciones:
            # Dividir por líneas y formatear como lista
            lineas = especificaciones.split("\n")
            for linea in lineas:
                if linea.strip():
                    story.append(Paragraph(f"∴ {linea.strip()}", style_normal))
        
        # Descripción
        descripcion = maquinaria.get("descripcion", "")
        if descripcion:
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph(descripcion, style_normal))
        
        story.append(Spacer(1, 0.4*inch))
        
        # Precio
        precio_formateado = f"$ {precio_final:,.0f}".replace(",", ".")
        
        precio_table = Table([
            [Paragraph("<b>Precio Neto</b>", style_normal), 
             Paragraph(f"<b>{precio_formateado} más IVA</b>", style_precio)]
        ], colWidths=[3*inch, 3*inch])
        
        precio_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        story.append(precio_table)
        story.append(Spacer(1, 0.5*inch))
        
        # Cierre
        story.append(Paragraph(
            "Esperando dar una satisfactoria respuesta a vuestra necesidad y quedando a sus órdenes,",
            style_normal
        ))
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Atte.", style_normal))
        story.append(Spacer(1, 0.5*inch))
        
        # Firma (placeholder sin logo)
        story.append(Paragraph("<b>Ingeniería Agroindustrial Maci Ltda.</b>", ParagraphStyle(
            'Firma', parent=styles['Normal'], alignment=TA_CENTER, fontSize=11
        )))
        story.append(Spacer(1, 0.5*inch))
        
        # Línea separadora
        story.append(HRFlowable(width="100%", thickness=1, color=colors.gray))
        story.append(Spacer(1, 0.1*inch))
        
        # Pie de página
        style_footer = ParagraphStyle(
            'Footer', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9, textColor=colors.gray
        )
        story.append(Paragraph("Fono: 34 - 251 76 89   Celular: 09 – 7648 2333", style_footer))
        story.append(Paragraph("www.maci.cl  -  ventas@maci.cl", style_footer))
        story.append(Spacer(1, 0.2*inch))
        
        # Nota
        style_nota = ParagraphStyle(
            'Nota', parent=styles['Normal'], fontSize=9, textColor=colors.gray
        )
        story.append(Paragraph(
            "<b>Nota:</b> La cotización no considera despacho del equipo, imágenes referenciales. "
            "Cotización válida durante 10 días hábiles.",
            style_nota
        ))
        
        # Generar PDF
        doc.build(story)
        
        # Subir a Cloud Storage
        buffer.seek(0)
        pdf_filename = f"cotizaciones/{codigo}.pdf"
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(pdf_filename)
        
        blob.upload_from_file(buffer, content_type="application/pdf")
        
        # Hacer público
        blob.make_public()
        
        public_url = blob.public_url
        logger.info(f"📄 Cotización generada: {codigo} -> {public_url}")
        
        return public_url
        
    except Exception as e:
        logger.error(f"Error generando cotización PDF: {e}", exc_info=True)
        return None


def save_quotation_to_firestore(
    codigo: str,
    cliente_nombre: str,
    cliente_email: str,
    cliente_telefono: str,
    maquinaria_id: str,
    maquinaria_nombre: str,
    precio: float,
    pdf_url: str
) -> Optional[str]:
    """
    Guarda la cotización en Firestore para seguimiento.
    
    Returns:
        ID del documento creado o None
    """
    try:
        from app.services.firebase import db
        
        doc_ref = db.collection("cotizaciones").document()
        doc_ref.set({
            "codigo_cotizacion": codigo,
            "cliente_nombre": cliente_nombre,
            "cliente_email": cliente_email,
            "cliente_telefono": cliente_telefono,
            "maquinaria_id": maquinaria_id,
            "maquinaria": maquinaria_nombre,
            "precio_cotizado": precio,
            "pdf_url": pdf_url,
            "estado": "NUEVA",
            "origen": "WhatsApp",
            "created_at": datetime.now().isoformat()
        })
        
        logger.info(f"💾 Cotización guardada en Firestore: {doc_ref.id}")
        return doc_ref.id
        
    except Exception as e:
        logger.error(f"Error guardando cotización: {e}")
        return None
