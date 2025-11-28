import sys
import json
import os
import cv2
import time
from ultralytics import YOLO

# Configuración
MODEL_PATH = 'structure_best.pt'
SAVE_DIR = os.path.join('recibidos', 'detecciones_structure')

# Reglas de puntuación (del código original)
PESOS_AVANCE = {
    0: 10.0,  # Techo
    1: 5.0,   # Detalles
    2: 30.0,  # Paredes/Pisos
    3: 20.0,  # Ventanas/Puertas
}

CLASS_NAMES = {
    0: "Techo",
    1: "Detalles",
    2: "Paredes/Pisos",
    3: "Ventanas/Puertas"
}

def generate_narrative_report(score, detections_set):
    report_parts = []
    
    # Contexto general basado en el score
    if score <= 25:
        report_parts.append("El departamento se encuentra en una etapa inicial de obra gruesa.")
    elif score <= 50:
        report_parts.append("La unidad presenta avances parciales en su estructura y obra gruesa.")
    elif score <= 74:
        report_parts.append("Se observan avances significativos en las terminaciones del departamento.")
    else:
        report_parts.append("El departamento se encuentra en etapa de terminaciones finales.")

    # Análisis específico por elementos (simulando estado)
    # ID 2: Paredes/Pisos
    if 2 in detections_set:
        report_parts.append("Las paredes presentan avance en sus revestimientos y el piso se observa con progreso en su nivelación.")
    else:
        report_parts.append("Las paredes y pisos aún se encuentran en estado bruto o sin revestir.")

    # ID 3: Ventanas/Puertas
    if 3 in detections_set:
        report_parts.append("Se verifica la presencia de marcos, puertas o ventanas instaladas.")
    else:
        report_parts.append("Se observa que las puertas y ventanas aún no han sido instaladas.")

    # ID 0: Techo
    if 0 in detections_set:
        report_parts.append("El cielo raso/techo presenta avance en su instalación.")
    
    # ID 1: Detalles
    if 1 in detections_set:
        report_parts.append("Se aprecian detalles de terminaciones finas e instalaciones eléctricas/sanitarias visibles.")

    return " ".join(report_parts)

def get_status_text(max_score):
    if max_score <= 25:
        return "🌱 Fase 1: Proyecto Iniciado"
    elif max_score <= 50:
        return "🏗️ Fase 2: En Desarrollo Temprano"
    elif max_score <= 74:
        return "🚧 Fase 3: Avance Medio"
    else:
        return "🏠 Fase 4: En Etapa Final"

def process_image(model, image_path, output_name):
    # Predicción
    # YOLO guarda en project/name/filename
    # Lowering confidence to 0.25 to catch more features
    results = model.predict(source=image_path, save=True, project='recibidos', name='detecciones_structure', exist_ok=True, conf=0.25)
    
    score_actual = 0.0
    objetos_en_cuadro = set()
    detections_list = []

    # Debug log
    log_path = os.path.join(SAVE_DIR, 'debug_detections.log')
    with open(log_path, 'a') as f:
        f.write(f"\nProcessing {output_name}:\n")

    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        class_name = CLASS_NAMES.get(cls_id, str(cls_id)) # Use mapped name or ID if not found
        detections_list.append(f"{class_name} ({conf:.2f})")
        
        # Log each detection
        with open(log_path, 'a') as f:
            f.write(f"  - Detected: {class_name} (ID: {cls_id}), Conf: {conf:.2f}\n")
        
        if cls_id in PESOS_AVANCE and cls_id not in objetos_en_cuadro:
            score_actual += PESOS_AVANCE[cls_id]
            objetos_en_cuadro.add(cls_id)
    
    score_actual = min(score_actual, 100.0)
    status_text = get_status_text(score_actual)
    
    # Generar explicación narrativa
    explanation = generate_narrative_report(score_actual, objetos_en_cuadro)

    return {
        "type": "image",
        "score": score_actual,
        "status": status_text,
        "explanation": explanation,
        "detections": detections_list,
        "processed_file": os.path.basename(image_path) 
    }

def process_video(model, video_path, output_name):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": "No se pudo abrir el video"}

    # Propiedades del video
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Configurar writer para guardar video procesado
    output_path = os.path.join(SAVE_DIR, output_name)
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    # Codec para MP4 (h.264 es mejor para web, pero mp4v es más compatible por defecto en opencv)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') 
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    max_score_visto = 0.0
    frames_con_deteccion = 0
    total_frames = 0
    all_detections = set()

    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        total_frames += 1
        
        # Predicción en el frame
        # Lowering confidence to 0.25
        results = model(frame, conf=0.25, verbose=False)
        
        score_actual = 0.0
        objetos_en_cuadro = set()
        
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                class_name = CLASS_NAMES.get(cls_id, str(cls_id)) # Use mapped name
                all_detections.add(class_name)
                
                if cls_id in PESOS_AVANCE and cls_id not in objetos_en_cuadro:
                    score_actual += PESOS_AVANCE[cls_id]
                    objetos_en_cuadro.add(cls_id)
        
        score_actual = min(score_actual, 100.0)
        
        if score_actual > 0:
            frames_con_deteccion += 1
        if score_actual > max_score_visto:
            max_score_visto = score_actual

        # Dibujar
        annotated_frame = results[0].plot(line_width=3)
        
        # Panel de datos
        cv2.rectangle(annotated_frame, (0, 0), (350, 80), (0, 0, 0), -1) 
        cv2.putText(annotated_frame, f"Avance: {score_actual:.0f}%", (20, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        
        out.write(annotated_frame)

    cap.release()
    out.release()
    
    status_text = get_status_text(max_score_visto)
    
    # Generar explicación narrativa
    # Reconstruir el set de IDs detectados a partir de los nombres (ya que all_detections tiene nombres)
    # Esto es un poco hacky pero necesario porque no guardamos los IDs en all_detections
    detected_ids = set()
    reverse_class_names = {v: k for k, v in CLASS_NAMES.items()}
    for name in all_detections:
        if name in reverse_class_names:
            detected_ids.add(reverse_class_names[name])
            
    explanation = generate_narrative_report(max_score_visto, detected_ids)

    return {
        "type": "video",
        "score": max_score_visto,
        "status": status_text,
        "explanation": explanation,
        "detections": list(all_detections),
        "processed_file": output_name,
        "stats": {
            "total_frames": total_frames,
            "frames_with_detection": frames_con_deteccion,
            "effective_time_percent": (frames_con_deteccion / total_frames * 100) if total_frames > 0 else 0
        }
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Falta la ruta del archivo"}))
        return

    file_path = sys.argv[1]
    filename = os.path.basename(file_path)
    
    # Cargar modelo
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(json.dumps({"error": f"Error al cargar modelo: {str(e)}"}))
        return

    # Determinar tipo de archivo
    ext = os.path.splitext(filename)[1].lower()
    
    try:
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
            result = process_image(model, file_path, filename)
        elif ext in ['.mp4', '.avi', '.mov', '.mkv']:
            result = process_video(model, file_path, filename)
        else:
            result = {"error": "Formato no soportado"}
            
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Error en procesamiento: {str(e)}"}))

if __name__ == "__main__":
    main()
