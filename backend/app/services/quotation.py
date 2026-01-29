"""
Servicio de Cotizaciones - Generación de PDFs.
"""
import logging
import io
import uuid
from datetime import datetime
from typing import Optional

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

from google.cloud import storage, firestore

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bucket para almacenar cotizaciones
BUCKET_NAME = "venta-maquinarias-cotizaciones"


def generate_quotation_pdf(
    cliente_nombre: str,
    cliente_email: str,
    cliente_telefono: str,
    maquinarias: list[dict],
    precios: Optional[list[float]] = None
) -> Optional[str]:
    """
    Genera un PDF de cotización para múltiples productos.
    """
    try:
        # Generar código único de cotización
        codigo = f"COT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
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
            fontSize=14,
            textColor=colors.HexColor("#2E7D32"),
            spaceBefore=12,
            spaceAfter=6
        )
        # Estilo precio
        style_precio = ParagraphStyle(
            'Precio',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor("#2E7D32"),
            alignment=TA_RIGHT
        )

        # Construir contenido
        story = []
        
        # Encabezado con Logo
        logo_path = "app/assets/logo.png"
        try:
            logo = Image(logo_path, width=2.4*inch, height=0.8*inch, kind='proportional')
        except Exception:
            logo = Paragraph("MACI", style_empresa)
            
        header_text = [
            Paragraph("INGENIERÍA AGROINDUSTRIAL", style_empresa),
            Paragraph("Torno – Hidráulica – Estructuras – Repuestos", style_subtitulo)
        ]
        
        header_table = Table([
            [logo, header_text]
        ], colWidths=[2.5*inch, 4.5*inch])
        
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,0), 'LEFT'),
            ('LEFTPADDING', (1,0), (1,0), 6),
        ]))
        
        story.append(header_table)
        story.append(Spacer(1, 0.4*inch))
        
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
        
        # Datos empresa y cliente
        story.append(Paragraph("<b>DE</b>     : INGENIERÍA AGROINDUSTRIAL MACI LTDA.", style_normal))
        story.append(Paragraph(f"<b>PARA</b>  : {cliente_nombre}", style_normal))
        story.append(Paragraph(f"<b>MAIL</b>   : {cliente_email}", style_normal))
        story.append(Paragraph(f"<b>FONO</b>  : {cliente_telefono}", style_normal))
        story.append(Spacer(1, 0.3*inch))
        
        story.append(Paragraph("De nuestra mayor consideración:", style_normal))
        story.append(Paragraph("Por la presente, tenga a bien recibir nuestra cotización, según vuestra solicitud;", style_normal))
        story.append(Spacer(1, 0.3*inch))
        
        total_neto = 0
        
        # ITERAR PRODUCTOS
        for idx, maq in enumerate(maquinarias):
            precio_unitario = maq.get("precioReferencia", 0)
            if precios and len(precios) > idx:
                precio_unitario = precios[idx]
            
            total_neto += precio_unitario
            
            # Nombre Producto
            nombre_maquinaria = maq.get("nombre", f"Producto {idx+1}")
            story.append(Paragraph(f"Item {idx+1}: {nombre_maquinaria.upper()}", style_producto))
            story.append(Spacer(1, 0.1*inch))
            
            # Descripción
            descripcion = maq.get("descripcion", "")
            if descripcion:
                story.append(Paragraph(descripcion, style_normal))
                story.append(Spacer(1, 0.1*inch))
                
            # Imagen
            imagenes = maq.get("imagenes", [])
            if imagenes:
                img_url = imagenes[0]
                try:
                    response = requests.get(img_url, timeout=10)
                    if response.status_code == 200:
                        img_buffer = io.BytesIO(response.content)
                        prod_img = Image(img_buffer, width=4*inch, height=3*inch, kind='proportional')
                        story.append(prod_img)
                        story.append(Spacer(1, 0.1*inch))
                except Exception:
                    pass

            # Spec
            specs = maq.get("especificacionesTecnicas", "")
            if specs:
                for linea in specs.splitlines():
                    if linea.strip():
                        story.append(Paragraph(f"∴ {linea.strip()}", style_normal))
            
            # Precio individual
            p_fmt = f"$ {precio_unitario:,.0f}".replace(",", ".")
            story.append(Paragraph(f"Valor Neto: {p_fmt}", ParagraphStyle('P', parent=styles['Normal'], alignment=TA_RIGHT)))
            
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
            story.append(Spacer(1, 0.2*inch))

        # TOTALES
        total_formateado = f"$ {total_neto:,.0f}".replace(",", ".")
        iva = total_neto * 0.19
        total_iva = total_neto + iva
        
        t_neto = f"$ {total_neto:,.0f}".replace(",", ".")
        t_iva = f"$ {iva:,.0f}".replace(",", ".")
        t_total = f"$ {total_iva:,.0f}".replace(",", ".")
        
        totales_data = [
            ["Subtotal Neto", t_neto],
            ["IVA (19%)", t_iva],
            ["TOTAL", t_total]
        ]
        
        t_tabla = Table(totales_data, colWidths=[4*inch, 2*inch])
        t_tabla.setStyle(TableStyle([
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('FONTNAME', (0,2), (1,2), 'Helvetica-Bold'),
            ('LINEABOVE', (0,2), (1,2), 1, colors.black),
        ]))
        story.append(Spacer(1, 0.2*inch))
        story.append(t_tabla)
        story.append(Spacer(1, 0.4*inch))
        
        # Cierre y Firma (igual que antes)
        story.append(Paragraph("Esperando dar una satisfactoria respuesta...", style_normal))
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Atte.", style_normal))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("<b>Berardo Cortez López</b>", style_normal))
        story.append(Paragraph("Gerente General", style_normal))
        story.append(Paragraph("<b>Ingeniería Agroindustrial Maci Ltda.</b>", style_normal))
        story.append(Spacer(1, 0.5*inch))
        
        story.append(HRFlowable(width="100%", thickness=1, color=colors.gray))
        
        # Footer
        style_footer = ParagraphStyle('Footer', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9, textColor=colors.gray)
        story.append(Paragraph("Fono: 34 - 251 76 89   Celular: 09 – 7648 2333", style_footer))
        story.append(Paragraph("www.maci.cl  -  ventas@maci.cl", style_footer))
        
        # Build
        doc.build(story)
        
        # Generar nombre del archivo con formato: Cotizacion{Maquina}{Fecha}
        fecha = datetime.now().strftime('%Y%m%d')
        # Usar el nombre de la primera maquinaria (o "Multiple" si hay varias)
        nombre_maquina = maquinarias[0].get('nombre', 'Producto').replace(' ', '_') if len(maquinarias) == 1 else 'Multiple'
        # Limpiar caracteres especiales del nombre
        nombre_maquina = ''.join(c for c in nombre_maquina if c.isalnum() or c == '_')[:30]  # Limitar a 30 chars
        
        pdf_filename = f"cotizaciones/Cotizacion{nombre_maquina}{fecha}_{codigo}.pdf"
        
        # Upload
        buffer.seek(0)
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(pdf_filename)
        blob.upload_from_file(buffer, content_type="application/pdf")
        blob.make_public()
        
        logger.info(f"📄 Cotización generada: {codigo}")
        return blob.public_url
        
    except Exception as e:
        logger.error(f"Error generando cotización PDF: {e}", exc_info=True)
        return None


def save_quotation_to_firestore(
    codigo: str,
    cliente_nombre: str,
    cliente_email: str,
    cliente_telefono: str,
    maquinaria_ids: list,
    maquinaria_nombres: list,
    precio_total: float,
    pdf_url: str,
    estado: str = "CONTACTADO"
) -> Optional[str]:
    """
    Guarda la cotización multi-producto en Firestore.
    """
    try:
        from app.services.firebase import db
        
        doc_ref = db.collection("cotizaciones").document()
        doc_ref.set({
            "codigo_cotizacion": codigo,
            "cliente_nombre": cliente_nombre,
            "cliente_email": cliente_email,
            "cliente_telefono": cliente_telefono,
            "maquinaria_ids": maquinaria_ids,
            "maquinarias": maquinaria_nombres,
            "precio_total": precio_total,
            "pdf_url": pdf_url,
            "estado": estado,
            "origen": "WhatsApp",
            "created_at": datetime.now().isoformat()
        })
        
        logger.info(f"💾 Cotización guardada en Firestore: {doc_ref.id}")
        return doc_ref.id
        
    except Exception as e:
        logger.error(f"Error guardando cotización: {e}")
        return None

def update_quotation_status(cliente_telefono: str, nuevo_estado: str) -> bool:
    """
    Actualiza el estado de la ÚLTIMA cotización activa del cliente.
    Estados válidos: NEGOCIANDO, VENDIDA, PERDIDA
    """
    try:
        from app.services.firebase import db
        
        # Buscar la última cotización de este teléfono
        # Firestore requiere índice compuesto para where + order_by.
        # Para evitarlo, traemos todas las de este teléfono y ordenamos en memoria.
        docs = db.collection("cotizaciones")\
            .where("cliente_telefono", "==", cliente_telefono)\
            .stream()
            
        all_docs = list(docs)
        if not all_docs:
             logger.warning(f"⚠️ No se encontró cotización para {cliente_telefono}")
             return False

        # Ordenar por created_at descendente (string ISO 8601 ordena bien lexicográficamente)
        all_docs.sort(key=lambda x: x.to_dict().get("created_at", ""), reverse=True)
        found_doc = all_docs[0]
            
        if found_doc:
            doc_ref = db.collection("cotizaciones").document(found_doc.id)
            doc_ref.update({"estado": nuevo_estado})
            logger.info(f"🔄 Estado actualizado a {nuevo_estado} para cotización {found_doc.id}")
            return True
            
        logger.warning(f"⚠️ No se encontró cotización para actualizar estado a {cliente_telefono}")
        return False
        
    except Exception as e:
        logger.error(f"Error actualizando estado cotización: {e}")
        return False
